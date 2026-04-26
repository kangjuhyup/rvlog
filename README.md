# rvlog

Framework-agnostic TypeScript logging library with decorators, field masking, and error notifications.

## Features

- `@Logging` decorator for entry/exit/error/duration logging
- `withLogging()` for standalone functions and browser-friendly code
- `@MaskLog` for masking sensitive fields like name, email, phone, and passwords
- `@NoLog` to exclude hot paths or health checks
- `NotificationManager` with Slack, Discord, Webhook, and Sentry channels
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

Optional integrations:

```bash
npm install @sentry/browser
pnpm add @sentry/browser
yarn add @sentry/browser
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

## Function-First Usage

Use `withLogging()` when you want the same automatic logging behavior without class decorators.

```ts
import { MaskLog, withLogging } from '@kangjuhyup/rvlog';

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

You can forward logs with `NotificationManager` and built-in channels:

- `SentryChannel`
- `SlackChannel`
- `DiscordChannel`
- `WebhookChannel`

`SentryChannel` supports two delivery modes:

- `mode: 'event'` for `captureMessage` / `captureException`
- `mode: 'log'` for Sentry Logs via `Sentry.logger.*` with `enableLogs: true`

It also supports split routing with:

- `eventLevels` for issue/event collection
- `logLevels` for Sentry Logs collection

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
