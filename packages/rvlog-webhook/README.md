# @kangjuhyup/rvlog-webhook

Generic JSON webhook notification channel for `@kangjuhyup/rvlog`.

```ts
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { WebhookChannel } from '@kangjuhyup/rvlog-webhook';

const notification = new NotificationManager()
  .addResource('webhook', new WebhookChannel('https://collector.example.com/ingest'))
  .addRoute({
    resources: ['webhook'],
    levels: [LogLevel.ERROR, LogLevel.WARN],
  });
```
