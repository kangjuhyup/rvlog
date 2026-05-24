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
  type RvlogHttpLoggingOptions,
} from './rvlog-http.options';
import {
  resolveHttpLoggingOptions,
  resolveRequestId,
} from './rvlog-http.utils';
import {
  installRvlogRequestContextResolver,
  runWithRvlogRequestContext,
} from './rvlog-request-context';

type HttpLikeRequest = {
  headers?: Record<string, unknown>;
};

type HttpLikeResponse = {
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

    if (this.options.setResponseHeader) {
      response.setHeader?.(this.options.requestIdHeader, requestId);
    }

    runWithRvlogRequestContext({ requestId }, next);
  }
}
