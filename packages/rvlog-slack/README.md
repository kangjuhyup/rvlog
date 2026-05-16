# @kangjuhyup/rvlog-slack

Slack notification channel for `@kangjuhyup/rvlog`.

```ts
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { SlackChannel } from '@kangjuhyup/rvlog-slack';

const notification = new NotificationManager()
  .addResource('slack', new SlackChannel(process.env.SLACK_WEBHOOK_URL ?? ''))
  .addRoute({
    resources: ['slack'],
    levels: [LogLevel.ERROR],
  });
```
