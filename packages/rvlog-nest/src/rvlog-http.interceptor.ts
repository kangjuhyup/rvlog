import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import { Observable } from "rxjs";
import {
  LogLevel,
  Logger,
  LoggerSystem,
  type LoggerContextValue,
} from "@kangjuhyup/rvlog";
import {
  buildDuration,
  buildRequestPayload,
  buildResponsePayload,
  getHandlerParameterTypes,
  resolveHttpLoggingOptions,
  resolveRequestId,
  shouldExcludePath,
} from "./rvlog-http.utils";

export interface RvlogHttpLoggingOptions {
  context?: string;
  logBody?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
  logHeaders?: boolean;
  logResponseBody?: boolean;
  excludePaths?: string[];
  maskHeaders?: string[];
  requestIdHeader?: string;
  setResponseHeader?: boolean;
}

export const RVLOG_HTTP_LOGGING_OPTIONS = Symbol("RVLOG_HTTP_LOGGING_OPTIONS");
export const RVLOG_HTTP_LOGGER_SYSTEM = Symbol("RVLOG_HTTP_LOGGER_SYSTEM");

type HttpLikeRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: Record<string, unknown>;
};

type HttpLikeResponse = {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
};
const requestContextStorage = new AsyncLocalStorage<LoggerContextValue>();

@Injectable()
export class RvlogHttpInterceptor implements NestInterceptor {
  private readonly options: Required<RvlogHttpLoggingOptions>;

  constructor(
    @Optional()
    @Inject(RVLOG_HTTP_LOGGING_OPTIONS)
    options?: RvlogHttpLoggingOptions,
    @Optional()
    @Inject(RVLOG_HTTP_LOGGER_SYSTEM)
    private readonly loggerSystem?: LoggerSystem | null,
  ) {
    this.options = resolveHttpLoggingOptions(options);
    const runtime = this.loggerSystem ?? Logger;
    const previousResolver = runtime.getContextResolver();

    runtime.setContextResolver(() => ({
      ...previousResolver?.(),
      ...requestContextStorage.getStore(),
    }));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<"http">() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpLikeRequest>();
    const response = http.getResponse<HttpLikeResponse>();
    const path = request.originalUrl ?? request.url ?? "";

    if (shouldExcludePath(path, this.options.excludePaths)) {
      return next.handle();
    }

    const runtime = this.loggerSystem ?? Logger;
    const logger =
      this.loggerSystem?.createLogger(this.options.context) ??
      new Logger(this.options.context);
    const startTime = performance.now();
    const method = request.method ?? "HTTP";
    const parameterTypes = getHandlerParameterTypes(context);
    const requestPayload = buildRequestPayload(
      context,
      request,
      parameterTypes,
      this.options,
    );
    const requestSuffix =
      Object.keys(requestPayload).length > 0
        ? ` ${runtime.stringify(requestPayload)}`
        : "";
    const requestId = resolveRequestId(request, this.options.requestIdHeader);

    if (this.options.setResponseHeader) {
      response.setHeader?.(this.options.requestIdHeader, requestId);
    }

    return new Observable((subscriber) => {
      requestContextStorage.run({ requestId }, () => {
        logger.info(`${method} ${path} called${requestSuffix}`);

        const subscription = next.handle().subscribe({
          next: (responseBody) => {
            const duration = buildDuration(startTime);
            const statusCode = response.statusCode ?? 200;
            const responsePayload = buildResponsePayload(
              responseBody,
              this.options,
            );

            if (responsePayload) {
              logger.info(
                `${method} ${path} completed ${statusCode} (${duration}) ${runtime.stringify(responsePayload)}`,
              );
            } else {
              logger.info(
                `${method} ${path} completed ${statusCode} (${duration})`,
              );
            }

            subscriber.next(responseBody);
          },
          error: (error: unknown) => {
            const normalizedError =
              error instanceof Error ? error : new Error(String(error));
            const duration = buildDuration(startTime);
            const statusCode = response.statusCode ?? 500;

            logger.error(
              `${method} ${path} failed ${statusCode} (${duration})`,
              normalizedError,
            );
            runtime.notify(
              LogLevel.ERROR,
              `${method} ${path} failed ${statusCode} (${duration})`,
              {
                className: this.options.context,
                methodName: method,
                args: [requestPayload],
                error: normalizedError,
                duration,
                timestamp: new Date(),
              },
            );
            subscriber.error(error);
          },
          complete: () => {
            subscriber.complete();
          },
        });

        subscriber.add(() => subscription.unsubscribe());
      });
    });
  }
}
