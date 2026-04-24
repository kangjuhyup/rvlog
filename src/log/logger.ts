import { LogLevel, LOG_LEVEL_PRIORITY } from './log-level';
import { sanitizeLogValue, stringifyLogValue, type LogSerializeOptions } from './log-serializer';
import { defaultTimestamp, resolveFormatter } from './logger.utils';
import type { LogContext } from '../notification/notification-channel';
import type { NotificationManager } from '../notification/notification-manager';

/** A normalized log entry passed through formatters and transports. */
export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  args: unknown[];
  requestId?: string;
}

/** Formats a log record into a string for console or transport output. */
export type LogFormatter = (record: LogRecord) => string;

/** Context values resolved at log time, such as request IDs. */
export interface LoggerContextValue {
  requestId?: string;
}

type LoggerContextResolver = () => LoggerContextValue | undefined;

/** Destination that receives formatted log records after console output. */
export interface LogTransport {
  write(record: LogRecord, formatted: string): Promise<void> | void;
}

/** Global logger configuration shared by all `Logger` instances. */
export interface LoggerOptions {
  /** Minimum level that will be emitted. Defaults to `DEBUG`. */
  minLevel?: LogLevel;
  /** Custom timestamp generator used for each log record. */
  timestamp?: () => string;
  /** Enables the built-in pretty formatter when no custom formatter is provided. */
  pretty?: boolean;
  /** Custom formatter that overrides the built-in default/pretty formatters. */
  formatter?: LogFormatter;
  /** Optional transports that receive each emitted record. */
  transports?: LogTransport[];
  /** Resolver for request-scoped metadata appended to each record. */
  contextResolver?: LoggerContextResolver;
  /** Serialization limits used when sanitizing and stringifying arguments. */
  serialize?: LogSerializeOptions;
}

/**
 * Main logging entry point.
 * Create instances per context and configure shared behavior via `Logger.configure(...)`.
 */
export class Logger {
  private static notificationManager: NotificationManager | null = null;
  private static transports: LogTransport[] = [];
  private static globalOptions: LoggerOptions = {};
  private static contextResolver: LoggerContextResolver | null = null;

  /** Configures global logger behavior shared by all future instances. */
  static configure(options: LoggerOptions & { notification?: NotificationManager }): void {
    const { notification, contextResolver, ...loggerOptions } = options;

    if (notification) {
      Logger.notificationManager = notification;
    }

    Logger.transports = loggerOptions.transports ?? [];
    Logger.globalOptions = loggerOptions;

    if (contextResolver) {
      Logger.contextResolver = contextResolver;
    }
  }

  /** Returns the currently configured notification manager, if any. */
  static getNotificationManager(): NotificationManager | null {
    return Logger.notificationManager;
  }

  /** Returns the current global logger options. */
  static getOptions(): LoggerOptions {
    return Logger.globalOptions;
  }

  /** Returns the currently configured transports. */
  static getTransports(): LogTransport[] {
    return Logger.transports;
  }

  /** Overrides the runtime context resolver used for request-scoped metadata. */
  static setContextResolver(resolver: LoggerContextResolver | null): void {
    Logger.contextResolver = resolver;
  }

  /** Returns the current runtime context resolver. */
  static getContextResolver(): LoggerContextResolver | null {
    return Logger.contextResolver;
  }

  /** Sanitizes a value using the configured serialization limits. */
  static sanitize(value: unknown): unknown {
    return sanitizeLogValue(value, Logger.globalOptions.serialize);
  }

  /** Stringifies a value using the configured serialization limits. */
  static stringify(value: unknown): string {
    return stringifyLogValue(value, Logger.globalOptions.serialize);
  }

  /** Sends a log event directly through the configured notification manager. */
  static notify(level: LogLevel, message: string, context: LogContext): void {
    Logger.forwardNotification(level, message, context);
  }

  private static forwardNotification(level: LogLevel, message: string, context: LogContext): void {
    if (!Logger.notificationManager) {
      return;
    }

    Logger.notificationManager.notify(level, message, context).catch(() => {});
  }

  /** Resets static state for tests. Not intended for normal application code. */
  static resetForTesting(): void {
    Logger.notificationManager = null;
    Logger.transports = [];
    Logger.globalOptions = {};
    Logger.contextResolver = null;
  }

  /** Creates a logger that writes under the given context name. */
  constructor(private readonly context: string) {}

  /** Emits a `DEBUG` log entry. */
  debug(message: string, ...args: unknown[]): void {
    this.print(LogLevel.DEBUG, message, args);
  }

  /** Emits an `INFO` log entry. */
  info(message: string, ...args: unknown[]): void {
    this.print(LogLevel.INFO, message, args);
  }

  /** Emits a `WARN` log entry. */
  warn(message: string, ...args: unknown[]): void {
    this.print(LogLevel.WARN, message, args);
  }

  /** Emits an `ERROR` log entry. */
  error(message: string, ...args: unknown[]): void {
    this.print(LogLevel.ERROR, message, args);
  }

  private print(level: LogLevel, message: string, args: unknown[]): void {
    const minLevel = Logger.globalOptions.minLevel ?? LogLevel.DEBUG;

    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const timestamp = (Logger.globalOptions.timestamp ?? defaultTimestamp)();
    const runtimeContext = Logger.contextResolver?.();
    const sanitizedArgs = args.map((arg) => Logger.sanitize(arg));
    const record: LogRecord = {
      timestamp,
      level,
      context: this.context,
      message,
      args: sanitizedArgs,
      requestId: runtimeContext?.requestId,
    };
    const formatter = resolveFormatter(Logger.globalOptions);
    const formatted = formatter(record);
    const payload = sanitizedArgs.length > 0 ? [formatted, ...sanitizedArgs] : [formatted];

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(...payload);
        break;
      case LogLevel.INFO:
        console.info(...payload);
        break;
      case LogLevel.WARN:
        console.warn(...payload);
        break;
      case LogLevel.ERROR:
        console.error(...payload);
        break;
    }

    for (const transport of Logger.transports) {
      try {
        const result = transport.write(record, formatted);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // transport errors must never break caller
      }
    }

    if (level !== LogLevel.ERROR) {
      Logger.forwardNotification(level, message, {
        className: this.context,
        methodName: 'log',
        args: sanitizedArgs,
        timestamp: new Date(),
      });
    }
  }
}
