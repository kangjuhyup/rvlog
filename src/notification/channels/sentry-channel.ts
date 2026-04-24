import { LogLevel, LOG_LEVEL_PRIORITY } from '../../log/log-level';
import type { LogContext, NotificationChannel } from '../notification-channel';
import {
  buildSentryLogAttributes,
  includesSentryLevel,
  mapSentryLevel,
} from './sentry-channel.utils';

/**
 * Sentry severity level strings accepted by `captureMessage` / `Scope.setLevel`.
 * Matches `@sentry/types` `SeverityLevel` shape without importing it.
 */
export type SentrySeverityLevel =
  | 'fatal'
  | 'error'
  | 'warning'
  | 'log'
  | 'info'
  | 'debug';

export interface SentryScopeLike {
  setLevel(level: SentrySeverityLevel): void;
  setTag(key: string, value: string): void;
  setExtra(key: string, value: unknown): void;
}

export interface SentryStructuredLoggerLike {
  trace(message: string, attributes?: Record<string, unknown>): void;
  debug(message: string, attributes?: Record<string, unknown>): void;
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, attributes?: Record<string, unknown>): void;
  fatal(message: string, attributes?: Record<string, unknown>): void;
}

/**
 * Minimal subset of the `@sentry/browser` module surface that `SentryChannel`
 * needs. Declared structurally so consumers can pass either the real SDK
 * module or a custom wrapper.
 */
export interface SentryLike {
  captureException(error: unknown): string;
  captureMessage(message: string, level?: SentrySeverityLevel): string;
  withScope(callback: (scope: SentryScopeLike) => void): void;
  logger?: SentryStructuredLoggerLike;
}

export type SentryChannelMode = 'event' | 'log';

export interface SentryChannelOptions {
  /**
   * Pre-initialized Sentry client. In browser apps, pass the imported
   * `* as Sentry from '@sentry/browser'` namespace after calling
   * `Sentry.init({ dsn })` at the app entry point.
   */
  client: SentryLike;
  /** Minimum level that will be forwarded to Sentry. Defaults to ERROR. */
  minLevel?: LogLevel;
  /**
   * `event`: uses captureMessage/captureException and surfaces in issue/event flows.
   * `log`: uses Sentry Logs API (`Sentry.logger.*`) when available.
   */
  mode?: SentryChannelMode;
  /**
   * Explicit levels to send as Sentry events/issues.
   * When set, this takes precedence over `mode`.
   */
  eventLevels?: LogLevel[];
  /**
   * Explicit levels to send as Sentry logs.
   * When set, this takes precedence over `mode`.
   */
  logLevels?: LogLevel[];
  /**
   * When `logLevels` are configured but `Sentry.logger` is unavailable at runtime,
   * fall back to event delivery instead of dropping the log.
   * Defaults to true.
   */
  fallbackLogsToEvents?: boolean;
  /**
   * When true, prints diagnostic logs to the console describing how each entry
   * is routed to Sentry.
   */
  debug?: boolean;
}

export class SentryChannel implements NotificationChannel {
  private hasWarnedAboutMissingLogger = false;

  constructor(private readonly options: SentryChannelOptions) {}

  private debugLog(message: string, meta?: Record<string, unknown>): void {
    if (!this.options.debug) {
      return;
    }

    if (meta) {
      console.info(`[rvlog:sentry] ${message}`, meta);
      return;
    }

    console.info(`[rvlog:sentry] ${message}`);
  }

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const minLevel = this.options.minLevel ?? LogLevel.ERROR;

    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      this.debugLog('skipped by minLevel', {
        level,
        minLevel,
        message,
        className: context.className,
        methodName: context.methodName,
      });
      return;
    }

    const { client } = this.options;
    const hasExplicitRouting =
      this.options.eventLevels !== undefined || this.options.logLevels !== undefined;
    const shouldSendEvent = hasExplicitRouting
      ? includesSentryLevel(this.options.eventLevels, level)
      : (this.options.mode ?? 'event') === 'event';
    const shouldSendLog = hasExplicitRouting
      ? includesSentryLevel(this.options.logLevels, level)
      : (this.options.mode ?? 'event') === 'log';
    const fallbackLogsToEvents = this.options.fallbackLogsToEvents ?? true;

    this.debugLog('routing decision', {
      level,
      message,
      className: context.className,
      methodName: context.methodName,
      shouldSendEvent,
      shouldSendLog,
      hasLogger: Boolean(client.logger),
      fallbackLogsToEvents,
    });

    if (shouldSendLog && client.logger) {
      const attributes = buildSentryLogAttributes(context);

      switch (level) {
        case LogLevel.DEBUG:
          client.logger.debug(message, attributes);
          break;
        case LogLevel.INFO:
          client.logger.info(message, attributes);
          break;
        case LogLevel.WARN:
          client.logger.warn(message, attributes);
          break;
        case LogLevel.ERROR:
          client.logger.error(message, attributes);
          break;
      }

      this.debugLog('sent via Sentry.logger', {
        level,
        message,
        className: context.className,
        methodName: context.methodName,
      });

      if (!shouldSendEvent) {
        return;
      }
    }

    if (shouldSendLog && !client.logger) {
      if (!this.hasWarnedAboutMissingLogger) {
        this.hasWarnedAboutMissingLogger = true;
        console.warn(
          '[rvlog] Sentry.logger is unavailable at runtime. Falling back to event delivery for configured log levels.',
        );
      }

      this.debugLog('logger missing, evaluating fallback', {
        level,
        message,
        className: context.className,
        methodName: context.methodName,
        fallbackLogsToEvents,
      });

      if (!shouldSendEvent && !fallbackLogsToEvents) {
        this.debugLog('dropped because logger is unavailable and fallback is disabled', {
          level,
          message,
          className: context.className,
          methodName: context.methodName,
        });
        return;
      }
    }

    if (!shouldSendEvent && !(shouldSendLog && fallbackLogsToEvents)) {
      this.debugLog('skipped because no event/log route matched', {
        level,
        message,
        className: context.className,
        methodName: context.methodName,
      });
      return;
    }

    const sentryLevel = mapSentryLevel(level);

    client.withScope((scope) => {
      scope.setLevel(sentryLevel);
      scope.setTag('className', context.className);
      scope.setTag('methodName', context.methodName);

      if (context.duration) {
        scope.setTag('duration', context.duration);
      }

      scope.setExtra('args', context.args);
      scope.setExtra('timestamp', context.timestamp.toISOString());
      scope.setExtra('message', message);

      if (context.error) {
        client.captureException(context.error);
      } else {
        client.captureMessage(message, sentryLevel);
      }
    });

    this.debugLog('sent via captureMessage/captureException', {
      level,
      sentryLevel,
      message,
      className: context.className,
      methodName: context.methodName,
      hasError: Boolean(context.error),
    });
  }
}
