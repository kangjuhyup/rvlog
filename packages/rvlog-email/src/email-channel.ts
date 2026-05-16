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

export interface EmailTransport {
  send(message: EmailMessage): Promise<void> | void;
}

interface EmailChannelBaseOptions {
  to: string | string[];
  from?: string;
  subject?: string | ((level: LogLevel, message: string, context: LogContext) => string);
  format?: (level: LogLevel, message: string, context: LogContext) => EmailContent;
}

export type EmailChannelOptions = EmailChannelBaseOptions & (
  | {
      sendMail: EmailSendMail;
      transport?: never;
    }
  | {
      transport: EmailTransport;
      sendMail?: never;
    }
);

export class EmailChannel implements NotificationChannel {
  constructor(private readonly options: EmailChannelOptions) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const content = this.options.format?.(level, message, context) ?? {
      subject: this.resolveSubject(level, message, context),
      text: this.formatText(level, message, context),
    };

    await this.resolveSendMail()({
      to: this.options.to,
      from: this.options.from,
      ...content,
    });
  }

  private resolveSendMail(): EmailSendMail {
    if ('sendMail' in this.options && this.options.sendMail) {
      return this.options.sendMail;
    }

    if ('transport' in this.options && this.options.transport) {
      const { transport } = this.options;
      return (message) => transport.send(message);
    }

    throw new Error('EmailChannel requires either sendMail or transport');
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
