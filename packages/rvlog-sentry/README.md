# @kangjuhyup/rvlog-sentry

Sentry notification channel for `@kangjuhyup/rvlog`.

```ts
import * as Sentry from '@sentry/browser';
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { SentryChannel } from '@kangjuhyup/rvlog-sentry';

const notification = new NotificationManager()
  .addResource('sentry', new SentryChannel({ client: Sentry, minLevel: LogLevel.ERROR }))
  .addRoute({
    resources: ['sentry'],
    levels: [LogLevel.ERROR],
  });
```
