import { LogLevel } from '@kangjuhyup/rvlog';

export interface RvlogHttpLoggingOptions {
  context?: string;
  logBody?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
  logHeaders?: boolean;
  logResponseBody?: boolean;
  level?: LogLevel;
  excludePaths?: string[];
  maskHeaders?: string[];
  requestIdHeader?: string;
  setResponseHeader?: boolean;
}

export const RVLOG_HTTP_LOGGING_OPTIONS = Symbol('RVLOG_HTTP_LOGGING_OPTIONS');
export const RVLOG_HTTP_LOGGER_SYSTEM = Symbol('RVLOG_HTTP_LOGGER_SYSTEM');
