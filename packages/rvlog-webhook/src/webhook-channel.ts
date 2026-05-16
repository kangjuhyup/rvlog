import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';
import { type FetchLike, postJson } from './webhook.utils';

export class WebhookChannel implements NotificationChannel {
  constructor(
    private readonly webhookUrl: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const fetcher = (globalThis as typeof globalThis & { fetch: FetchLike }).fetch;
    await postJson(
      fetcher,
      this.webhookUrl,
      {
        level,
        message,
        context,
      },
      'Webhook notification',
      this.headers,
    );
  }
}
