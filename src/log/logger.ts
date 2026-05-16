import { LogLevel, LOG_LEVEL_PRIORITY } from './log-level';
import {
  sanitizeLogValue,
  stringifyLogValue,
  type LogSerializeOptions,
  type SerializedError,
} from './log-serializer';
import { defaultTimestamp, resolveFormatter } from './logger.utils';
import type { LogContext, LogFields, LogTags } from '../notification/notification-channel';
import type { NotificationManager } from '../notification/notification-manager';
import type { PrettyLogFormatterOptions } from '../formatters/pretty-formatter';

/** A normalized log entry passed through formatters and transports. */
export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  args: unknown[];
  requestId?: string;
  tags?: LogTags;
  fields?: LogFields;
}

/** Formats a log record into a string for console or transport output. */
export type LogFormatter = (record: LogRecord) => string;

/** Context values resolved at log time, such as request IDs. */
export interface LoggerContextValue {
  requestId?: string;
  tags?: LogTags;
  fields?: LogFields;
}

export type LoggerContextResolver = () => LoggerContextValue | undefined;

/** Destination that receives formatted log records after console output. */
export interface LogTransport {
  write(record: LogRecord, formatted: string): Promise<void> | void;
}

export interface LoggerLike {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Global logger configuration shared by all `Logger` instances. */
export interface LoggerOptions {
  /** Minimum level that will be emitted. Defaults to `DEBUG`. */
  minLevel?: LogLevel;
  /** Custom timestamp generator used for each log record. */
  timestamp?: () => string;
  /** Enables or customizes the built-in pretty formatter when no custom formatter is provided. */
  pretty?: boolean | PrettyLogFormatterOptions;
  /** Custom formatter that overrides the built-in default/pretty formatters. */
  formatter?: LogFormatter;
  /** Optional transports that receive each emitted record. */
  transports?: LogTransport[];
  /** Resolver for request-scoped metadata appended to each record. */
  contextResolver?: LoggerContextResolver;
  /** Serialization limits used when sanitizing and stringifying arguments. */
  serialize?: LogSerializeOptions;
  /** Default tags added to every emitted record from this runtime. */
  defaultTags?: LogTags;
  /** Default structured fields added to every emitted record from this runtime. */
  defaultFields?: LogFields;
}

export type LoggerConfiguration = LoggerOptions & { notification?: NotificationManager };

class LoggerRuntime {
  private notificationManager: NotificationManager | null = null;
  private transports: LogTransport[] = [];
  private options: LoggerOptions = {};
  private contextResolver: LoggerContextResolver | null = null;

  configure(options: LoggerConfiguration): void {
    const { notification, contextResolver, ...loggerOptions } = options;

    if (notification) {
      this.notificationManager = notification;
    }

    this.transports = loggerOptions.transports ?? [];
    this.options = loggerOptions;

    if (contextResolver !== undefined) {
      this.contextResolver = contextResolver;
    }
  }

  getNotificationManager(): NotificationManager | null {
    return this.notificationManager;
  }

  getOptions(): LoggerOptions {
    return this.options;
  }

  getTransports(): LogTransport[] {
    return this.transports;
  }

  setContextResolver(resolver: LoggerContextResolver | null): void {
    this.contextResolver = resolver;
  }

  getContextResolver(): LoggerContextResolver | null {
    return this.contextResolver;
  }

  sanitize(value: unknown): unknown {
    return sanitizeLogValue(value, this.options.serialize);
  }

  stringify(value: unknown): string {
    return stringifyLogValue(value, this.options.serialize);
  }

  notify(level: LogLevel, message: string, context: LogContext): void {
    this.forwardNotification(level, message, context);
  }

  reset(): void {
    this.notificationManager = null;
    this.transports = [];
    this.options = {};
    this.contextResolver = null;
  }

  emit(
    context: string,
    level: LogLevel,
    message: string,
    args: unknown[],
    boundTags: LogTags = {},
    boundFields: LogFields = {},
  ): void {
    const minLevel = this.options.minLevel ?? LogLevel.DEBUG;

    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const timestamp = (this.options.timestamp ?? defaultTimestamp)();
    const runtimeContext = this.contextResolver?.();
    const sanitizedArgs = args.map((arg) => this.sanitize(arg));
    const formattedMessage = level === LogLevel.ERROR
      ? appendErrorStack(message, sanitizedArgs)
      : message;
    const tags = this.mergeTags(this.options.defaultTags, runtimeContext?.tags, boundTags);
    const fields = this.mergeFields(
      this.options.defaultFields,
      runtimeContext?.fields ? this.sanitize(runtimeContext.fields) as LogFields : undefined,
      Object.keys(boundFields).length > 0 ? this.sanitize(boundFields) as LogFields : undefined,
    );
    const record: LogRecord = {
      timestamp,
      level,
      context,
      message: formattedMessage,
      args: sanitizedArgs,
      requestId: runtimeContext?.requestId,
      tags,
      fields,
    };
    const formatter = resolveFormatter(this.options);
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

    for (const transport of this.transports) {
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
      this.forwardNotification(level, message, {
        className: context,
        methodName: 'log',
        args: sanitizedArgs,
        tags,
        fields,
        timestamp: new Date(),
      });
    }
  }

  private mergeTags(...parts: Array<LogTags | undefined>): LogTags | undefined {
    const merged = Object.assign({}, ...parts.filter(Boolean));
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private mergeFields(...parts: Array<LogFields | undefined>): LogFields | undefined {
    const merged = Object.assign({}, ...parts.filter(Boolean));
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private forwardNotification(level: LogLevel, message: string, context: LogContext): void {
    if (!this.notificationManager) {
      return;
    }

    this.notificationManager.notify(level, message, context).catch(() => {});
  }
}

function appendErrorStack(message: string, args: unknown[]): string {
  const error = args.find(isSerializedError);

  if (!error?.stack) {
    return message;
  }

  return `${message}\n${error.stack}`;
}

function isSerializedError(value: unknown): value is SerializedError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SerializedError>;
  return typeof candidate.name === 'string'
    && typeof candidate.message === 'string'
    && (candidate.stack === undefined || typeof candidate.stack === 'string');
}

const globalRuntime = new LoggerRuntime();

/** Logger instance bound to a specific runtime configuration and context name. */
export class ScopedLogger {
  constructor(
    private readonly runtime: LoggerRuntime,
    private readonly context: string,
    private readonly tags: LogTags = {},
    private readonly fields: LogFields = {},
  ) {}

  debug(message: string, ...args: unknown[]): void {
    this.runtime.emit(this.context, LogLevel.DEBUG, message, args, this.tags, this.fields);
  }

  info(message: string, ...args: unknown[]): void {
    this.runtime.emit(this.context, LogLevel.INFO, message, args, this.tags, this.fields);
  }

  warn(message: string, ...args: unknown[]): void {
    this.runtime.emit(this.context, LogLevel.WARN, message, args, this.tags, this.fields);
  }

  error(message: string, ...args: unknown[]): void {
    this.runtime.emit(this.context, LogLevel.ERROR, message, args, this.tags, this.fields);
  }

  withTags(tags: LogTags): ScopedLogger {
    return new ScopedLogger(this.runtime, this.context, { ...this.tags, ...tags }, this.fields);
  }

  withFields(fields: LogFields): ScopedLogger {
    return new ScopedLogger(this.runtime, this.context, this.tags, { ...this.fields, ...fields });
  }

  child(options: { context?: string; tags?: LogTags; fields?: LogFields } = {}): ScopedLogger {
    return new ScopedLogger(
      this.runtime,
      options.context ?? this.context,
      { ...this.tags, ...(options.tags ?? {}) },
      { ...this.fields, ...(options.fields ?? {}) },
    );
  }
}

/**
 * Isolated logger factory that owns its own configuration, transports, and
 * notification manager without mutating global `Logger` state.
 */
export class LoggerSystem {
  private readonly runtime = new LoggerRuntime();

  constructor(options?: LoggerConfiguration) {
    if (options) {
      this.configure(options);
    }
  }

  configure(options: LoggerConfiguration): void {
    this.runtime.configure(options);
  }

  createLogger(context: string): ScopedLogger {
    return new ScopedLogger(this.runtime, context);
  }

  getNotificationManager(): NotificationManager | null {
    return this.runtime.getNotificationManager();
  }

  getOptions(): LoggerOptions {
    return this.runtime.getOptions();
  }

  getTransports(): LogTransport[] {
    return this.runtime.getTransports();
  }

  setContextResolver(resolver: LoggerContextResolver | null): void {
    this.runtime.setContextResolver(resolver);
  }

  getContextResolver(): LoggerContextResolver | null {
    return this.runtime.getContextResolver();
  }

  sanitize(value: unknown): unknown {
    return this.runtime.sanitize(value);
  }

  stringify(value: unknown): string {
    return this.runtime.stringify(value);
  }

  notify(level: LogLevel, message: string, context: LogContext): void {
    this.runtime.notify(level, message, context);
  }
}

/**
 * Main global logger entry point.
 * Uses shared process-wide configuration via `Logger.configure(...)`.
 */
export class Logger extends ScopedLogger {
  static configure(options: LoggerConfiguration): void {
    globalRuntime.configure(options);
  }

  static getNotificationManager(): NotificationManager | null {
    return globalRuntime.getNotificationManager();
  }

  static getOptions(): LoggerOptions {
    return globalRuntime.getOptions();
  }

  static getTransports(): LogTransport[] {
    return globalRuntime.getTransports();
  }

  static setContextResolver(resolver: LoggerContextResolver | null): void {
    globalRuntime.setContextResolver(resolver);
  }

  static getContextResolver(): LoggerContextResolver | null {
    return globalRuntime.getContextResolver();
  }

  static sanitize(value: unknown): unknown {
    return globalRuntime.sanitize(value);
  }

  static stringify(value: unknown): string {
    return globalRuntime.stringify(value);
  }

  static notify(level: LogLevel, message: string, context: LogContext): void {
    globalRuntime.notify(level, message, context);
  }

  static resetForTesting(): void {
    globalRuntime.reset();
  }

  constructor(context: string) {
    super(globalRuntime, context);
  }
}

/** Creates an isolated logger system with its own configuration scope. */
export function createLoggerSystem(options?: LoggerConfiguration): LoggerSystem {
  return new LoggerSystem(options);
}

/** Gives reusable logger option objects contextual typing without changing them at runtime. */
export function defineLoggerOptions<T extends LoggerConfiguration>(options: T): T {
  return options;
}
