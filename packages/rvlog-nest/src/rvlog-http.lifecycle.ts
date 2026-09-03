import {
  LogLevel,
  Logger,
  LoggerSystem,
  logAtLevel,
} from '@kangjuhyup/rvlog';
import type { RvlogHttpLoggingOptions } from './rvlog-http.options';
import { buildDuration } from './rvlog-http.utils';
import { runWithRvlogRequestContext } from './rvlog-request-context';

type HttpRequestLoggingState = {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
  excluded: boolean;
  interceptorEntered: boolean;
  observerInstalled: boolean;
  terminalLogged: boolean;
  responsePayload?: Record<string, unknown>;
};

type HttpResponseEventTarget = {
  statusCode?: number;
  once?: (event: string, listener: () => void) => unknown;
};

export type HttpLifecycleResponse = HttpResponseEventTarget & {
  raw?: HttpResponseEventTarget;
};

type InitializeHttpRequestLoggingInput = Pick<
  HttpRequestLoggingState,
  'requestId' | 'method' | 'path' | 'startTime' | 'excluded'
>;

type LogHttpFailureInput = {
  level: LogLevel.WARN | LogLevel.ERROR;
  context: string;
  method: string;
  path: string;
  statusCode: number;
  duration: string;
  loggerSystem?: LoggerSystem | null;
};

const requestLoggingStates = new WeakMap<object, HttpRequestLoggingState>();

export function initializeHttpRequestLogging(
  request: object,
  input: InitializeHttpRequestLoggingInput,
): void {
  const requestKey = resolveRequestKey(request);

  if (requestLoggingStates.has(requestKey)) {
    return;
  }

  requestLoggingStates.set(requestKey, {
    ...input,
    interceptorEntered: false,
    observerInstalled: false,
    terminalLogged: false,
  });
}

export function observeHttpResponseFinish(
  request: object,
  response: HttpLifecycleResponse,
  options: Required<RvlogHttpLoggingOptions>,
  loggerSystem?: LoggerSystem | null,
): boolean {
  const state = requestLoggingStates.get(resolveRequestKey(request));

  if (!state || state.excluded || state.observerInstalled) {
    return state?.observerInstalled ?? false;
  }

  const eventTarget = resolveResponseEventTarget(response);

  if (!eventTarget?.once) {
    return false;
  }

  state.observerInstalled = true;
  eventTarget.once('finish', () => {
    runWithRvlogRequestContext({ requestId: state.requestId }, () => {
      finalizeHttpResponse(state, response, options, loggerSystem);
    });
  });

  return true;
}

export function enterHttpInterceptor(request: object): boolean {
  const state = requestLoggingStates.get(resolveRequestKey(request));

  if (!state) {
    return false;
  }

  state.interceptorEntered = true;
  return state.observerInstalled;
}

export function captureHttpResponsePayload(
  request: object,
  payload: Record<string, unknown> | undefined,
): void {
  const state = requestLoggingStates.get(resolveRequestKey(request));

  if (state) {
    state.responsePayload = payload;
  }
}

export function resolveHttpFailureStatus(
  error: unknown,
  responseStatus?: number,
): number {
  try {
    const getStatus = (error as { getStatus?: unknown } | null)?.getStatus;

    if (typeof getStatus === 'function') {
      const statusCode = getStatus.call(error) as unknown;

      if (isHttpStatusCode(statusCode)) {
        return statusCode;
      }
    }
  } catch {
    // A malformed exception must not prevent payload-free fallback logging.
  }

  return isHttpStatusCode(responseStatus) && responseStatus >= 400
    ? responseStatus
    : 500;
}

export function logHttpFailure(input: LogHttpFailureInput): void {
  const runtime = input.loggerSystem ?? Logger;
  const logger =
    input.loggerSystem?.createLogger(input.context) ??
    new Logger(input.context);
  const message = buildFailureMessage(input);

  if (input.level === LogLevel.WARN) {
    logger.warn(message);
    return;
  }

  logger.error(message);
  runtime.notify(LogLevel.ERROR, message, {
    className: input.context,
    methodName: input.method,
    args: [],
    duration: input.duration,
    timestamp: new Date(),
  });
}

function finalizeHttpResponse(
  state: HttpRequestLoggingState,
  response: HttpLifecycleResponse,
  options: Required<RvlogHttpLoggingOptions>,
  loggerSystem?: LoggerSystem | null,
): void {
  if (state.terminalLogged) {
    return;
  }

  state.terminalLogged = true;
  const statusCode = resolveFinalStatusCode(response);
  const duration = buildDuration(state.startTime);

  if (statusCode >= 500) {
    logHttpFailure({
      level: LogLevel.ERROR,
      context: options.context,
      method: state.method,
      path: state.path,
      statusCode,
      duration,
      loggerSystem,
    });
    return;
  }

  if (statusCode >= 400) {
    logHttpFailure({
      level: LogLevel.WARN,
      context: options.context,
      method: state.method,
      path: state.path,
      statusCode,
      duration,
      loggerSystem,
    });
    return;
  }

  if (!state.interceptorEntered) {
    return;
  }

  const runtime = loggerSystem ?? Logger;
  const logger =
    loggerSystem?.createLogger(options.context) ??
    new Logger(options.context);
  const responseSuffix = state.responsePayload
    ? ` ${runtime.stringify(state.responsePayload)}`
    : '';

  logAtLevel(
    logger,
    options.level,
    `${state.method} ${state.path} completed ${statusCode} (${duration})${responseSuffix}`,
  );
}

function resolveResponseEventTarget(
  response: HttpLifecycleResponse,
): HttpResponseEventTarget | undefined {
  if (typeof response.once === 'function') {
    return response;
  }

  if (typeof response.raw?.once === 'function') {
    return response.raw;
  }

  return undefined;
}

function resolveRequestKey(request: object): object {
  const rawRequest = (request as { raw?: unknown }).raw;

  return typeof rawRequest === 'object' && rawRequest !== null
    ? rawRequest
    : request;
}

function resolveFinalStatusCode(response: HttpLifecycleResponse): number {
  if (isHttpStatusCode(response.statusCode)) {
    return response.statusCode;
  }

  if (isHttpStatusCode(response.raw?.statusCode)) {
    return response.raw.statusCode;
  }

  return 200;
}

function isHttpStatusCode(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 100
    && value < 1000;
}

function buildFailureMessage(
  input: Pick<LogHttpFailureInput, 'method' | 'path' | 'statusCode' | 'duration'>,
): string {
  return `${input.method} ${input.path} failed ${input.statusCode} (${input.duration})`;
}
