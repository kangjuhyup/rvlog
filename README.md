# rvlog

Framework-agnostic TypeScript logging library with decorators, field masking, and error notifications.

## Features

- `@Logging` decorator for entry/exit/error/duration logging
- `withLogging()` for standalone functions and browser-friendly code
- `@MaskLog` for masking sensitive fields like name, email, phone, and passwords
- `@NoLog` to exclude hot paths or health checks
- `NotificationManager` with route-based fan-out, lazy notification resources, cooldowns, and thresholds
- `FileTransport` for Node.js file logging with rotation

## Install

Minimum requirements for the core package:

- `Node.js 18+`
- `TypeScript 5.7+`

```bash
npm install @kangjuhyup/rvlog reflect-metadata
pnpm add @kangjuhyup/rvlog reflect-metadata
yarn add @kangjuhyup/rvlog reflect-metadata
```

Optional notification channel packages:

```bash
npm install @kangjuhyup/rvlog-slack @kangjuhyup/rvlog-discord @kangjuhyup/rvlog-webhook @kangjuhyup/rvlog-sentry @kangjuhyup/rvlog-email
pnpm add @kangjuhyup/rvlog-slack @kangjuhyup/rvlog-discord @kangjuhyup/rvlog-webhook @kangjuhyup/rvlog-sentry @kangjuhyup/rvlog-email
yarn add @kangjuhyup/rvlog-slack @kangjuhyup/rvlog-discord @kangjuhyup/rvlog-webhook @kangjuhyup/rvlog-sentry @kangjuhyup/rvlog-email
```

Related packages:

```bash
npm install @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
pnpm add @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
yarn add @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
```

Notes:

- `reflect-metadata` is required when using metadata-driven features such as `@Logging`, `@MaskLog`, and `rvlog-nest`.
- Framework adapters may have their own runtime requirements in addition to the core `rvlog` minimums.

## Basic Usage

Import `reflect-metadata` once at app startup before using decorators.

```ts
import 'reflect-metadata';
import { Logger, Logging, LogLevel, MaskLog, NoLog } from '@kangjuhyup/rvlog';

Logger.configure({
  minLevel: LogLevel.INFO,
  pretty: true,
  serialize: {
    maxStringLength: 200,
    maxArrayLength: 20,
    maxObjectKeys: 30,
    maxDepth: 4,
  },
});

class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;
}

@Logging
class UserService {
  declare logger: Logger;

  async create(dto: CreateUserDto) {
    this.logger.info('manual log before create');
    return { id: 1, ...dto };
  }

  @NoLog
  healthCheck() {
    return 'ok';
  }
}
```

Automatic entry and completion logs are emitted at `LogLevel.INFO` by default. Pass `level` when a service should log those lifecycle messages at another level; failures are still logged as `ERROR`.

```ts
@Logging({ level: LogLevel.WARN })
class BillingService {
  charge() {
    return 'ok';
  }
}
```

## Pretty Output

Use `pretty: true` for the built-in compact console format, or pass an object when you only want to adjust a few parts without writing a full custom formatter.

```ts
import { defineLoggerOptions, Logger, LogLevel } from '@kangjuhyup/rvlog';

const loggerOptions = defineLoggerOptions({
  pretty: {
    separator: '->',
    showTimestamp: false,
    levelLabels: {
      [LogLevel.INFO]: 'info',
      [LogLevel.ERROR]: 'error',
    },
    levelColors: {
      [LogLevel.INFO]: 'cyan',
      [LogLevel.WARN]: 'yellow',
      [LogLevel.ERROR]: 'brightRed',
    },
  },
});

Logger.configure(loggerOptions);
```

For complete control over the output string, pass `formatter`.

## Function-First Usage

Use `withLogging()` when you want the same automatic logging behavior without class decorators.

```ts
import { LogLevel, MaskLog, withLogging } from '@kangjuhyup/rvlog';

class SignupInput {
  @MaskLog({ type: 'email' })
  email!: string;

  @MaskLog({ type: 'full' })
  password!: string;
}

async function signupImpl(input: SignupInput) {
  return { id: crypto.randomUUID() };
}

export const signup = withLogging(signupImpl, {
  context: 'signup',
  level: LogLevel.DEBUG,
});
```

## Node.js File Logging

Use `@kangjuhyup/rvlog/node` only in Node runtimes.

```ts
import 'reflect-metadata';
import { Logger, LogLevel } from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';

Logger.configure({
  minLevel: LogLevel.INFO,
  pretty: true,
  transports: [
    new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'rvlog.log',
      rotate: {
        type: 'size',
        maxSizeBytes: 1024 * 1024,
        maxFiles: 3,
      },
    }),
  ],
});
```

## Payload Truncation

Large payloads can make logs noisy and expensive. `rvlog` can truncate strings, arrays, objects, and deeply nested values before they are written.

```ts
Logger.configure({
  pretty: true,
  serialize: {
    maxStringLength: 200,
    maxArrayLength: 20,
    maxObjectKeys: 30,
    maxDepth: 4,
    truncateSuffix: '...<truncated>',
  },
});
```

The same serialization policy is shared by:

- `Logger.info(...)`
- `@Logging`
- `withLogging()`

## Notifications

`NotificationManager` owns the core routing policy. Actual delivery channels live in optional packages so apps only install and load the resources they enable.

```ts
import { Logger, LogLevel, NotificationManager } from '@kangjuhyup/rvlog';

const notification = new NotificationManager()
  .addLazyResource('slack', async () => {
    const { SlackChannel } = await import('@kangjuhyup/rvlog-slack');
    return new SlackChannel(process.env.SLACK_WEBHOOK_URL ?? '');
  })
  .addLazyResource('email', async () => {
    const { EmailChannel, createNodemailerAdapter } = await import('@kangjuhyup/rvlog-email');
    return new EmailChannel({
      to: 'ops@example.com',
      transport: createNodemailerAdapter(mailer),
    });
  })
  .addRoute({
    resources: ['slack', 'email'],
    levels: [LogLevel.ERROR],
    when: {
      threshold: { count: 10, windowMs: 60_000 },
      cooldownMs: 60_000,
    },
  });

Logger.configure({ notification });
```

Channel packages:

- `@kangjuhyup/rvlog-slack`
- `@kangjuhyup/rvlog-discord`
- `@kangjuhyup/rvlog-webhook`
- `@kangjuhyup/rvlog-sentry`
- `@kangjuhyup/rvlog-email`

The legacy `addRule({ channel, levels, cooldownMs })` API remains available for existing code.

See related package docs for integration patterns:

- [packages/rvlog-react/README.md](./packages/rvlog-react/README.md)
- [packages/rvlog-nest/README.md](./packages/rvlog-nest/README.md)

## Examples

- [example/README.md](./example/README.md)
- `example/basic` for plain TypeScript + decorators
- `example/express` for Express
- `example/nestjs` for NestJS
- `example/react` for React + hooks
- `example/vanilla` for browser TypeScript + `withLogging()`

Troubleshooting:

- [FAQ.md](./FAQ.md)

## Benchmark Report

Performance results are documented here:

- [benchmark/REPORT.md](./benchmark/REPORT.md)
# Isolated Logger Systems

`Logger.configure(...)` is still the default global setup for simple apps.

When you need isolated logger state per app, test, tenant, or integration boundary,
use `createLoggerSystem(...)` instead.

```ts
import {
  createLoggerSystem,
  LogLevel,
  Logger,
  withLogging,
} from 'rvlog';

const system = createLoggerSystem({
  minLevel: LogLevel.INFO,
});

const logger = system.createLogger('UserService');
logger.info('hello from isolated runtime');

const wrapped = withLogging(
  async (userId: string) => userId,
  {
    context: 'user-flow',
    system,
  },
);
```

Use the global `Logger` when:
- one process-wide configuration is enough
- you want the simplest setup

Use `LoggerSystem` when:
- tests must not mutate global logger state
- multiple apps or tenants share the same runtime
- framework adapters should use isolated transports or notification channels
