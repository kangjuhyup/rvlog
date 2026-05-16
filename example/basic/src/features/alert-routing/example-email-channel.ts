import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';

export interface ExampleEmailChannelOptions {
  to: string;
  from: string;
}

export class ExampleEmailChannel implements NotificationChannel {
  constructor(private readonly options: ExampleEmailChannelOptions) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info('[email notification example]', {
      to: this.options.to,
      from: this.options.from,
      subject: `[rvlog:${level}] ${context.className}.${context.methodName}`,
      text: message,
    });
  }
}
