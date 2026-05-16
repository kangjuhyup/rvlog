import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';
import { type FetchLike, postJson } from './webhook.utils';

interface SlackPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

export class SlackChannel implements NotificationChannel {
  constructor(private readonly webhookUrl: string) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const payload: SlackPayload = {
      text: `[${level}] ${context.className}.${context.methodName} ${message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${level}* ${context.className}.${context.methodName}\n${message}`,
          },
        },
      ],
    };

    const fetcher = (globalThis as typeof globalThis & { fetch: FetchLike }).fetch;
    await postJson(fetcher, this.webhookUrl, payload, 'Slack notification');
  }
}
