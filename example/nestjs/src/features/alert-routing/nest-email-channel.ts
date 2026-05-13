import type { LogContext, NotificationChannel } from "@kangjuhyup/rvlog";
import { LogLevel } from "@kangjuhyup/rvlog";

export interface NestExampleEmailChannelOptions {
  to: string;
  from: string;
}

export class NestExampleEmailChannel implements NotificationChannel {
  constructor(private readonly options: NestExampleEmailChannelOptions) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info("[nest email notification example]", {
      to: this.options.to,
      from: this.options.from,
      subject: `[rvlog-nest:${level}] ${context.className}.${context.methodName}`,
      text: message,
    });
  }
}
