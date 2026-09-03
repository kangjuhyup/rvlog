import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from "@nestjs/common";
import { Observable } from "rxjs";
import {
  LogLevel,
  Logger,
  LoggerSystem,
  logAtLevel,
} from "@kangjuhyup/rvlog";
import {
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpLoggingOptions,
} from './rvlog-http.options';
import {
  buildDuration,
  buildRequestPayload,
  buildResponsePayload,
  getHandlerParameterTypes,
  resolveHttpLoggingOptions,
  resolveHttpRequestPath,
  resolveRequestId,
  shouldExcludePath,
} from "./rvlog-http.utils";
import {
  getRvlogRequestContext,
  installRvlogRequestContextResolver,
  runWithRvlogRequestContext,
} from './rvlog-request-context';
import {
  captureHttpResponsePayload,
  enterHttpInterceptor,
  logHttpFailure,
  resolveHttpFailureStatus,
} from './rvlog-http.lifecycle';

export {
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpLoggingOptions,
} from './rvlog-http.options';

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
    installRvlogRequestContextResolver(this.loggerSystem ?? Logger);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<"http">() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpLikeRequest>();
    const response = http.getResponse<HttpLikeResponse>();
    const path = resolveHttpRequestPath(request.originalUrl, request.url);

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
    const existingContext = getRvlogRequestContext();
    const requestId =
      existingContext?.requestId ??
      resolveRequestId(request, this.options.requestIdHeader);

    if (this.options.setResponseHeader) {
      response.setHeader?.(this.options.requestIdHeader, requestId);
    }

    const observesFinalResponse = enterHttpInterceptor(request);

    return new Observable((subscriber) => {
      const run = (callback: () => void) => {
        if (existingContext?.requestId) {
          callback();
          return;
        }

        runWithRvlogRequestContext({ requestId }, callback);
      };

      run(() => {
        logAtLevel(logger, this.options.level, `${method} ${path} called${requestSuffix}`);

        const subscription = next.handle().subscribe({
          next: (responseBody) => {
            const responsePayload = buildResponsePayload(
              responseBody,
              this.options,
            );

            if (observesFinalResponse) {
              captureHttpResponsePayload(request, responsePayload);
              subscriber.next(responseBody);
              return;
            }

            const duration = buildDuration(startTime);
            const statusCode = response.statusCode ?? 200;

            if (responsePayload) {
              logAtLevel(
                logger,
                this.options.level,
                `${method} ${path} completed ${statusCode} (${duration}) ${runtime.stringify(responsePayload)}`,
              );
            } else {
              logAtLevel(
                logger,
                this.options.level,
                `${method} ${path} completed ${statusCode} (${duration})`,
              );
            }

            subscriber.next(responseBody);
          },
          error: (error: unknown) => {
            if (!observesFinalResponse) {
              const statusCode = resolveHttpFailureStatus(
                error,
                response.statusCode,
              );

              logHttpFailure({
                level:
                  statusCode >= 400 && statusCode < 500
                    ? LogLevel.WARN
                    : LogLevel.ERROR,
                context: this.options.context,
                method,
                path,
                statusCode,
                duration: buildDuration(startTime),
                loggerSystem: this.loggerSystem,
              });
            }

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
