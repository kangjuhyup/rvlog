import { LogLevel, type LoggerContextValue } from '@kangjuhyup/rvlog';

export interface RvlogHttpContextRequest {
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

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
  traceIdHeader?: string;
  setResponseHeader?: boolean;
  /** Adds tenant or principal context available before Nest guards run. */
  contextEnricher?: (
    request: RvlogHttpContextRequest,
  ) => LoggerContextValue | undefined;
}

export const RVLOG_HTTP_LOGGING_OPTIONS = Symbol('RVLOG_HTTP_LOGGING_OPTIONS');
export const RVLOG_HTTP_LOGGER_SYSTEM = Symbol('RVLOG_HTTP_LOGGER_SYSTEM');
/** Stable injection token for the LoggerSystem configured by RvlogNestModule. */
export const RVLOG_LOGGER_SYSTEM = RVLOG_HTTP_LOGGER_SYSTEM;
