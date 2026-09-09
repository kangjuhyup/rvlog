import {
  Inject,
  Injectable,
  type NestMiddleware,
  Optional,
} from '@nestjs/common';
import { Logger, LoggerSystem } from '@kangjuhyup/rvlog';
import {
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpContextRequest,
  type RvlogHttpLoggingOptions,
} from './rvlog-http.options';
import {
  resolveHttpRequestPath,
  resolveHttpLoggingOptions,
  resolveRequestId,
  resolveTraceId,
  shouldExcludePath,
} from './rvlog-http.utils';
import {
  installRvlogRequestContextResolver,
  runWithRvlogContext,
} from './rvlog-request-context';
import {
  initializeHttpRequestLogging,
  observeHttpResponseFinish,
  type HttpLifecycleResponse,
} from './rvlog-http.lifecycle';

type HttpLikeRequest = RvlogHttpContextRequest & {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, unknown>;
};

type HttpLikeResponse = HttpLifecycleResponse & {
  setHeader?: (name: string, value: string) => void;
};

type NextFunction = () => void;

@Injectable()
export class RvlogRequestContextMiddleware implements NestMiddleware {
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

  use(request: HttpLikeRequest, response: HttpLikeResponse, next: NextFunction): void {
    const requestId = resolveRequestId(request, this.options.requestIdHeader);
    const traceId = resolveTraceId(request, this.options.traceIdHeader);
    const path = resolveHttpRequestPath(request.originalUrl, request.url);
    const method = request.method ?? 'HTTP';
    const excluded = shouldExcludePath(path, this.options.excludePaths);

    if (this.options.setResponseHeader) {
      response.setHeader?.(this.options.requestIdHeader, requestId);
      response.setHeader?.(this.options.traceIdHeader, traceId);
    }

    let enrichedContext = {};
    try {
      enrichedContext = this.options.contextEnricher(request) ?? {};
    } catch {
      // Context enrichment must not interrupt request processing.
    }

    runWithRvlogContext({ ...enrichedContext, requestId, traceId }, () => {
      initializeHttpRequestLogging(request, {
        requestId,
        method,
        path,
        startTime: performance.now(),
        excluded,
      });
      observeHttpResponseFinish(
        request,
        response,
        this.options,
        this.loggerSystem,
      );
      next();
    });
  }
}
