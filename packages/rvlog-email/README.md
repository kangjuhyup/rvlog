# @kangjuhyup/rvlog-email

Email notification channel for `@kangjuhyup/rvlog`.

`EmailChannel` does not force a mail SDK. Pass your own `sendMail` function, or use one of the lightweight adapters for sendMail-compatible SMTP/Nodemailer transports, Resend, or AWS SES.

```ts
import { LogLevel, NotificationManager } from '@kangjuhyup/rvlog';
import { EmailChannel, createNodemailerAdapter } from '@kangjuhyup/rvlog-email';

const notification = new NotificationManager()
  .addResource('email', new EmailChannel({
    to: 'ops@example.com',
    transport: createNodemailerAdapter(mailer),
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

## Provider adapters

### SMTP

Use `createSmtpAdapter()` with any SMTP transporter that exposes `sendMail()`. It shares the same internal adapter contract as `createNodemailerAdapter()`, so use the name that best matches your app code.

```ts
import nodemailer from 'nodemailer';
import { EmailChannel, createSmtpAdapter } from '@kangjuhyup/rvlog-email';

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

new EmailChannel({
  to: 'ops@example.com',
  from: 'rvlog@example.com',
  transport: createSmtpAdapter(smtpTransporter),
});
```

### Nodemailer

```ts
import { EmailChannel, createNodemailerAdapter } from '@kangjuhyup/rvlog-email';

new EmailChannel({
  to: 'ops@example.com',
  from: 'rvlog@example.com',
  transport: createNodemailerAdapter(nodemailerTransporter),
});
```

For a generic `sendMail()` transporter, `createSendMailAdapter()` is also available.

### Resend

```ts
import { EmailChannel, createResendAdapter } from '@kangjuhyup/rvlog-email';

new EmailChannel({
  to: 'ops@example.com',
  from: 'rvlog@example.com',
  transport: createResendAdapter(resend),
});
```

### AWS SES

`rvlog-email` does not import `@aws-sdk/client-ses`. Create the command in your app and pass it through the adapter.

```ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EmailChannel,
  createSesAdapter,
  toSesEmailInput,
} from '@kangjuhyup/rvlog-email';

const ses = new SESClient({ region: 'ap-northeast-2' });

new EmailChannel({
  to: 'ops@example.com',
  from: 'rvlog@example.com',
  transport: createSesAdapter(
    ses,
    (message) => new SendEmailCommand(toSesEmailInput(message)),
  ),
});
```

You can still pass a custom function directly when another provider has a different SDK shape.

```ts
new EmailChannel({
  to: 'ops@example.com',
  sendMail: (message) => customMailer.deliver(message),
});
```
