import { LogLevel } from './log-level';
import { Logger, type LoggerLike, type LoggerSystem } from './logger';
import { maskObject } from '../masker/masker';
import type { LogContext } from '../notification/notification-channel';

type MetadataType = { prototype?: object | null };

/** Builds a millisecond duration string from a `performance.now()` start time. */
export function buildLogDuration(startTime: number): string {
  return `${(performance.now() - startTime).toFixed(2)}ms`;
}

/** Serializes already-masked arguments into the standard call suffix format. */
export function serializeLoggedArgs(args: unknown[]): string {
  if (args.length === 0) {
    return '';
  }

  return args.map((arg) => Logger.stringify(arg)).join(', ');
}

/** Builds the standard `name() called ...` entry log message. */
export function buildCalledLogMessage(name: string, args: unknown[]): string {
  if (args.length === 0) {
    return `${name}() called`;
  }

  return `${name}() called ${serializeLoggedArgs(args)}`;
}

/** Builds the standard `name() completed (...)` completion message. */
export function buildCompletedLogMessage(name: string, startTime: number): string {
  return `${name}() completed (${buildLogDuration(startTime)})`;
}

/** Builds the standard `name() failed (...)` error message prefix. */
export function buildFailedLogMessage(name: string, startTime: number): string {
  return `${name}() failed (${buildLogDuration(startTime)})`;
}

/** Applies masking rules to a value before it is logged. */
export function maskLoggingValue<T>(value: T, parameterType?: MetadataType): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return maskObject(value, undefined, parameterType?.prototype);
}

/** Stringifies a value after applying masking rules. */
export function stringifyLoggingValue(value: unknown): string {
  const maskedValue = maskLoggingValue(value);

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(maskedValue);
  } catch {
    return String(maskedValue);
  }
}

/** Dispatches a message to the corresponding logger method for the given level. */
export function logAtLevel(
  logger: LoggerLike,
  level: LogLevel,
  message: string,
  ...args: unknown[]
): void {
  switch (level) {
    case LogLevel.DEBUG:
      logger.debug(message, ...args);
      return;
    case LogLevel.INFO:
      logger.info(message, ...args);
      return;
    case LogLevel.WARN:
      logger.warn(message, ...args);
      return;
    case LogLevel.ERROR:
      logger.error(message, ...args);
      return;
  }
}

/** Emits the shared error notification payload used by decorators and wrappers. */
export function notifyLoggedError(
  context: string,
  name: string,
  args: unknown[],
  error: Error,
  duration: string,
  notifier: Pick<typeof Logger, 'notify'> | Pick<LoggerSystem, 'notify'> = Logger,
): void {
  const payload: LogContext = {
    className: context,
    methodName: name,
    args,
    error,
    duration,
    timestamp: new Date(),
  };

  notifier.notify(LogLevel.ERROR, `${name}() failed (${duration}) ${error.name}: ${error.message}`, payload);
}
