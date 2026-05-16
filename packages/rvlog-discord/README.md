# @kangjuhyup/rvlog-discord

Discord notification channel for `@kangjuhyup/rvlog`.

```ts
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { DiscordChannel } from '@kangjuhyup/rvlog-discord';

const notification = new NotificationManager()
  .addResource('discord', new DiscordChannel(process.env.DISCORD_WEBHOOK_URL ?? ''))
  .addRoute({
    resources: ['discord'],
    levels: [LogLevel.ERROR],
  });
```
