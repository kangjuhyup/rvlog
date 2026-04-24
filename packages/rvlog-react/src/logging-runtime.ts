import { LogLevel, Logger, maskObject } from 'rvlog';

export function buildLogDuration(startTime: number): string {
  return `${(performance.now() - startTime).toFixed(2)}ms`;
}

export function buildCompletedLogMessage(name: string, startTime: number): string {
  return `${name}() completed (${buildLogDuration(startTime)})`;
}

export function buildFailedLogMessage(name: string, startTime: number): string {
  return `${name}() failed (${buildLogDuration(startTime)})`;
}

export function maskLoggingValue<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return maskObject(value);
}

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

export function logAtLevel(
  logger: Logger,
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

export function notifyLoggedError(
  context: string,
  name: string,
  args: unknown[],
  error: Error,
  duration: string,
): void {
  Logger.notify(LogLevel.ERROR, `${name}() failed (${duration}) ${error.name}: ${error.message}`, {
    className: context,
    methodName: name,
    args,
    error,
    duration,
    timestamp: new Date(),
  });
}
