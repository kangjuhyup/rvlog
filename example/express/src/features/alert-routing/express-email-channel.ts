import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';

export interface ExpressExampleEmailChannelOptions {
  to: string;
  from: string;
}

export class ExpressExampleEmailChannel implements NotificationChannel {
  constructor(private readonly options: ExpressExampleEmailChannelOptions) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info('[express email notification example]', {
      to: this.options.to,
      from: this.options.from,
      subject: `[rvlog-express:${level}] ${context.className}.${context.methodName}`,
      text: message,
    });
  }
}
