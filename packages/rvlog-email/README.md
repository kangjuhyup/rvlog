# @kangjuhyup/rvlog-email

Email notification channel for `@kangjuhyup/rvlog`.

`EmailChannel` does not force a mail SDK. Pass your own `sendMail` function from Nodemailer, SES, Resend, or another provider.

```ts
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { EmailChannel } from '@kangjuhyup/rvlog-email';

const notification = new NotificationManager()
  .addResource('email', new EmailChannel({
    to: 'ops@example.com',
    sendMail: (message) => mailer.sendMail(message),
  }))
  .addRoute({
    resources: ['email'],
    levels: [LogLevel.ERROR],
    when: {
      threshold: { count: 10, windowMs: 60_000 },
      cooldownMs: 60_000,
    },
  });
```
