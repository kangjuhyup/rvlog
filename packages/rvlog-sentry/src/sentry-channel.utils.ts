import type { LogContext } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';
import type { SentrySeverityLevel } from './sentry-channel';

export function mapSentryLevel(level: LogLevel): SentrySeverityLevel {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warning';
    case LogLevel.ERROR:
      return 'error';
  }
}

export function buildSentryLogAttributes(context: LogContext): Record<string, unknown> {
  return {
    className: context.className,
    methodName: context.methodName,
    args: context.args,
    tags: context.tags,
    fields: context.fields,
    timestamp: context.timestamp.toISOString(),
    duration: context.duration,
    errorName: context.error?.name,
    errorMessage: context.error?.message,
    errorStack: context.error?.stack,
  };
}

export function includesSentryLevel(levels: LogLevel[] | undefined, level: LogLevel): boolean {
  return levels?.includes(level) ?? false;
}
