import type { LogLevel } from '../log/log-level';

export interface LogContext {
  className: string;
  methodName: string;
  args: unknown[];
  error?: Error;
  duration?: string;
  timestamp: Date;
}

export interface NotificationChannel {
  send(level: LogLevel, message: string, context: LogContext): Promise<void>;
}
