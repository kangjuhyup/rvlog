import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';

export interface EmailContent {
  subject: string;
  text: string;
  html?: string;
}

export interface EmailMessage extends EmailContent {
  to: string | string[];
  from?: string;
}

export type EmailSendMail = (message: EmailMessage) => Promise<void> | void;

export interface EmailChannelOptions {
  to: string | string[];
  from?: string;
  sendMail: EmailSendMail;
  subject?: string | ((level: LogLevel, message: string, context: LogContext) => string);
  format?: (level: LogLevel, message: string, context: LogContext) => EmailContent;
}

export class EmailChannel implements NotificationChannel {
  constructor(private readonly options: EmailChannelOptions) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const content = this.options.format?.(level, message, context) ?? {
      subject: this.resolveSubject(level, message, context),
      text: this.formatText(level, message, context),
    };

    await this.options.sendMail({
      to: this.options.to,
      from: this.options.from,
      ...content,
    });
  }

  private resolveSubject(level: LogLevel, message: string, context: LogContext): string {
    if (typeof this.options.subject === 'function') {
      return this.options.subject(level, message, context);
    }

    return this.options.subject ?? `[rvlog:${level}] ${context.className}.${context.methodName}`;
  }

  private formatText(level: LogLevel, message: string, context: LogContext): string {
    const lines = [
      `Level: ${level}`,
      `Source: ${context.className}.${context.methodName}`,
      `Message: ${message}`,
      `Timestamp: ${context.timestamp.toISOString()}`,
    ];

    if (context.duration) {
      lines.push(`Duration: ${context.duration}`);
    }

    if (context.error) {
      lines.push(`Error: ${context.error.name}: ${context.error.message}`);
    }

    if (context.tags && Object.keys(context.tags).length > 0) {
      lines.push(`Tags: ${JSON.stringify(context.tags)}`);
    }

    if (context.fields && Object.keys(context.fields).length > 0) {
      lines.push(`Fields: ${JSON.stringify(context.fields)}`);
    }

    return lines.join('\n');
  }
}
