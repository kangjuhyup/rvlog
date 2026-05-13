import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import type { ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LogLevel, maskObject } from '@kangjuhyup/rvlog';
import type { RvlogHttpLoggingOptions } from './rvlog-http.interceptor';

type HttpLikeRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: Record<string, unknown>;
};

type RouteHandlerMetadataType = { prototype?: object | null };
type RouteArgumentMetadata = Record<string, { index: number }>;

const DEFAULT_MASKED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

export function defaultMaskedHeaders(): string[] {
  return DEFAULT_MASKED_HEADERS;
}

export function isPrimitiveWrapperPrototype(prototype: object | null | undefined): boolean {
  if (!prototype) {
    return false;
  }

  const constructor = (prototype as { constructor?: unknown }).constructor;
  return (
    constructor === String ||
    constructor === Number ||
    constructor === Boolean ||
    constructor === Array ||
    constructor === Object ||
    constructor === Date
  );
}

export function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excluded) => path === excluded || path.startsWith(`${excluded}/`));
}

export function buildDuration(startTime: number): string {
  return `${(performance.now() - startTime).toFixed(2)}ms`;
}

export function normalizeHeaders(
  headers: Record<string, unknown> | undefined,
  maskHeaders: string[],
): Record<string, unknown> | undefined {
  if (!headers) {
    return undefined;
  }

  const masked = new Set(maskHeaders.map((header) => header.toLowerCase()));
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = masked.has(key.toLowerCase()) ? '******' : value;
  }

  return normalized;
}

export function resolveRequestId(
  request: HttpLikeRequest,
  headerName: string,
): string {
  const rawHeader = request.headers?.[headerName] ?? request.headers?.[headerName.toLowerCase()];

  if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
    return rawHeader;
  }

  if (Array.isArray(rawHeader) && rawHeader.length > 0 && typeof rawHeader[0] === 'string') {
    return rawHeader[0];
  }

  return randomUUID();
}

export function getHandlerParameterTypes(context: ExecutionContext): RouteHandlerMetadataType[] {
  const controllerPrototype = context.getClass().prototype;
  const handlerName = context.getHandler().name;

  return (
    (Reflect.getMetadata('design:paramtypes', controllerPrototype, handlerName) as
      | RouteHandlerMetadataType[]
      | undefined) ?? []
  );
}

export function getBodyParameterIndex(context: ExecutionContext): number | undefined {
  const routeArgs = Reflect.getMetadata(ROUTE_ARGS_METADATA, context.getHandler()) as
    | RouteArgumentMetadata
    | undefined;

  if (!routeArgs) {
    return undefined;
  }

  for (const [key, value] of Object.entries(routeArgs)) {
    const [routeParamtype] = key.split(':');

    if (Number(routeParamtype) === RouteParamtypes.BODY) {
      return value.index;
    }
  }

  return undefined;
}

export function findBodyMetadataPrototype(
  context: ExecutionContext,
  parameterTypes: RouteHandlerMetadataType[],
): object | null | undefined {
  const bodyParameterIndex = getBodyParameterIndex(context);

  if (bodyParameterIndex !== undefined) {
    const bodyPrototype = parameterTypes[bodyParameterIndex]?.prototype;

    if (bodyPrototype && !isPrimitiveWrapperPrototype(bodyPrototype)) {
      return bodyPrototype;
    }
  }

  return parameterTypes
    .map((type) => type?.prototype)
    .find((prototype) => prototype && !isPrimitiveWrapperPrototype(prototype));
}

export function assignPrototype<T extends object>(value: T, prototype?: object | null): T {
  if (!prototype) {
    return value;
  }

  return Object.assign(Object.create(prototype), value) as T;
}

export function parseJsonBody(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed || !['{', '['].includes(trimmed[0] ?? '')) {
      return value;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return value;
    }
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return parseJsonBody(value.toString('utf8'));
  }

  return value;
}

export function maskRequestBody(body: unknown, metadataPrototype?: object | null): unknown {
  const parsedBody = parseJsonBody(body);

  if (typeof parsedBody === 'object' && parsedBody !== null) {
    return maskObject(parsedBody, undefined, metadataPrototype);
  }

  return parsedBody;
}

export function buildRequestPayload(
  context: ExecutionContext,
  request: HttpLikeRequest,
  parameterTypes: RouteHandlerMetadataType[],
  options: Required<RvlogHttpLoggingOptions>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (options.logParams && request.params && Object.keys(request.params as object).length > 0) {
    payload.params = maskObject(request.params);
  }

  if (options.logQuery && request.query && Object.keys(request.query as object).length > 0) {
    payload.query = maskObject(request.query);
  }

  if (options.logBody && request.body !== undefined) {
    const bodyMetadataPrototype = findBodyMetadataPrototype(context, parameterTypes);
    payload.body = maskRequestBody(request.body, bodyMetadataPrototype);
  }

  if (options.logHeaders) {
    const headers = normalizeHeaders(request.headers, options.maskHeaders);

    if (headers && Object.keys(headers).length > 0) {
      payload.headers = headers;
    }
  }

  return payload;
}

export function buildResponsePayload(
  responseBody: unknown,
  options: Required<RvlogHttpLoggingOptions>,
): Record<string, unknown> | undefined {
  if (!options.logResponseBody || responseBody === undefined) {
    return undefined;
  }

  return {
    response: typeof responseBody === 'object' && responseBody !== null ? maskObject(responseBody) : responseBody,
  };
}

export function resolveHttpLoggingOptions(
  options?: RvlogHttpLoggingOptions,
): Required<RvlogHttpLoggingOptions> {
  return {
    context: options?.context ?? 'HTTP',
    logBody: options?.logBody ?? true,
    logQuery: options?.logQuery ?? true,
    logParams: options?.logParams ?? true,
    logHeaders: options?.logHeaders ?? false,
    logResponseBody: options?.logResponseBody ?? false,
    level: options?.level ?? LogLevel.INFO,
    excludePaths: options?.excludePaths ?? [],
    maskHeaders: options?.maskHeaders ?? defaultMaskedHeaders(),
    requestIdHeader: options?.requestIdHeader ?? 'x-request-id',
    setResponseHeader: options?.setResponseHeader ?? true,
  };
}
