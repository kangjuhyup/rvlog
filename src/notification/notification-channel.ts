import type { LogLevel } from '../log/log-level';

export type LogTags = Record<string, string>;
export type LogFields = Record<string, unknown>;

export interface LogContext {
  className: string;
  methodName: string;
  args: unknown[];
  tags?: LogTags;
  fields?: LogFields;
  error?: Error;
  duration?: string;
  timestamp: Date;
}

export interface NotificationChannel {
  send(level: LogLevel, message: string, context: LogContext): Promise<void>;
}
