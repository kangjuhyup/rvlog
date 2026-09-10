import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import {
  Logger,
  type LoggerSystem,
  type StructuredLoggerLike,
} from '@kangjuhyup/rvlog';
import { RVLOG_LOGGER_SYSTEM } from './rvlog-http.options';

/** Creates a Nest provider for a context-bound rvlog logger. */
export function createRvlogLoggerProvider(
  token: InjectionToken,
  context: string,
): FactoryProvider<StructuredLoggerLike> {
  return {
    provide: token,
    inject: [RVLOG_LOGGER_SYSTEM],
    useFactory: (loggerSystem: LoggerSystem | null): StructuredLoggerLike =>
      loggerSystem?.createLogger(context) ?? new Logger(context),
  };
}
