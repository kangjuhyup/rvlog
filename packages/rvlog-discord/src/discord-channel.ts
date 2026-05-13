import type { LogContext, NotificationChannel } from '@kangjuhyup/rvlog';
import { LogLevel } from '@kangjuhyup/rvlog';
import { levelColor } from './discord-channel.utils';
import { type FetchLike, postJson } from './webhook.utils';

export class DiscordChannel implements NotificationChannel {
  constructor(private readonly webhookUrl: string) {}

  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const fetcher = (globalThis as typeof globalThis & { fetch: FetchLike }).fetch;

    await postJson(fetcher, this.webhookUrl, {
      embeds: [
        {
          title: `${context.className}.${context.methodName}`,
          description: message,
          color: levelColor(level),
          timestamp: context.timestamp.toISOString(),
        },
      ],
    }, 'Discord notification');
  }
}
