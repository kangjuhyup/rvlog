import 'reflect-metadata';

/**
 * Core logging primitives and runtime helpers.
 * Use these to create loggers, format payloads, serialize values,
 * and share consistent log message conventions across adapters.
 */
export {
  Logger,
  type LoggerLike,
  LoggerSystem,
  ScopedLogger,
  createLoggerSystem,
  type LoggerOptions,
  type LoggerContextResolver,
  type LoggerContextValue,
  type LogRecord,
  type LogFormatter,
  type LogTransport,
  sanitizeLogValue,
  stringifyLogValue,
  type LogSerializeOptions,
  LogLevel,
  buildCalledLogMessage,
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  logAtLevel,
  maskLoggingValue,
  notifyLoggedError,
  serializeLoggedArgs,
  stringifyLoggingValue,
} from './log';

/** Default single-line formatter for machine-friendly log output. */
export { defaultLogFormatter } from './formatters/default-formatter';

/** Pretty formatter for human-friendly console output. */
export { prettyLogFormatter } from './formatters/pretty-formatter';

/** Class decorator that adds automatic method entry/exit/error logging. */
export { Logging } from './decorators/logging.decorator';

/** Opt-out decorator for methods that should not be auto-logged. */
export { NoLog } from './decorators/no-log.decorator';

/** Property decorator that marks fields to be masked in logs. */
export { MaskLog } from './decorators/mask-log.decorator';

/** Function wrapper that applies the same logging conventions without decorators. */
export { withLogging, type WithLoggingOptions } from './with-logging';

/** Low-level masking helpers for objects and primitive-like values. */
export { maskObject, maskValue } from './masker/masker';

/** Notification rule registry that routes logs to external channels. */
export { NotificationManager, type NotificationRule } from './notification/notification-manager';

/** Shared notification channel contract and emitted log context shape. */
export { type NotificationChannel, type LogContext } from './notification/notification-channel';

/** Circuit breaker used to protect noisy or failing notification channels. */
export { CircuitBreaker, CircuitState, type CircuitBreakerOptions } from './notification/circuit-breaker';

/** Slack webhook notification channel. */
export { SlackChannel } from './notification/channels/slack-channel';

/** Discord webhook notification channel. */
export { DiscordChannel } from './notification/channels/discord-channel';

/** Generic JSON webhook notification channel. */
export { WebhookChannel } from './notification/channels/webhook-channel';

/** Sentry notification channel for issue/event and logs delivery. */
export {
  SentryChannel,
  type SentryChannelOptions,
  type SentryLike,
  type SentryScopeLike,
  type SentrySeverityLevel,
} from './notification/channels/sentry-channel';
