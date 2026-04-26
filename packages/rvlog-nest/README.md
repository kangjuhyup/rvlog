# rvlog-nest

`rvlog-nest` adds NestJS-friendly HTTP request/response logging on top of `rvlog`.

## Features

- Global HTTP logging via Nest interceptor
- Request body/query/params logging
- Sensitive field masking through `rvlog`'s `@MaskLog` metadata
- Plain-object masking support for NestJS `@Body()` payloads
- Shared `requestId` propagation across HTTP and service logs
- Duration and status code logging
- Shared payload truncation using core `rvlog` serialization rules
- Path exclusion for health checks or noisy routes

## Install

```bash
npm install @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
pnpm add @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
yarn add @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
```

## Usage

```ts
import { Module } from '@nestjs/common';
import { LogLevel, NotificationManager, SlackChannel } from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';
import { RvlogNestModule } from '@kangjuhyup/rvlog-nest';

@Module({
  imports: [
    RvlogNestModule.forRoot({
      logger: {
        minLevel: LogLevel.INFO,
        pretty: true,
        notification: new NotificationManager().addRule({
          channel: new SlackChannel(process.env.SLACK_WEBHOOK_URL ?? 'https://hooks.slack.com/services/example'),
          levels: [LogLevel.ERROR],
          cooldownMs: 60_000,
        }),
        transports: [
          new FileTransport({
            enabled: true,
            dirPath: 'logs',
            fileName: 'nestjs.log',
            rotate: { type: 'daily' },
          }),
        ],
      },
      http: {
        excludePaths: ['/health'],
      },
    }),
  ],
})
export class AppModule {}
```

`RvlogNestModule.forRoot()` configures the core `rvlog` logger and registers the global HTTP interceptor in one place.

## Request Flow

`rvlog-nest` creates or reuses a request id from `x-request-id` and propagates it into both HTTP logs and service logs produced by `@Logging`.

```txt
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users called {"body":{"name":"강*협","email":"ab***@abc.com"}}
[INF] 2026:04:23 16:48:11 [req-123] UserService :: create() called {"name":"강*협","email":"ab***@abc.com"}
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users completed 201 (10.25ms)
```

## HTTP Options

```ts
RvlogNestModule.forRoot({
  http: {
    context: 'HTTP',
    logBody: true,
    logQuery: true,
    logParams: true,
    logHeaders: false,
    logResponseBody: false,
    excludePaths: ['/health'],
    requestIdHeader: 'x-request-id',
    setResponseHeader: true,
  },
})
```

## Payload Truncation

HTTP logs follow the same core serialization policy as `Logger.info(...)`, `@Logging`, and `withLogging()`.

```ts
RvlogNestModule.forRoot({
  logger: {
    pretty: true,
    serialize: {
      maxStringLength: 200,
      maxArrayLength: 20,
      maxObjectKeys: 30,
      maxDepth: 4,
      truncateSuffix: '...<truncated>',
    },
  },
})
```
# Using LoggerSystem in NestJS

`RvlogNestModule.forRoot(...)` can still configure the global `Logger`, but you
can also inject an isolated `LoggerSystem`.

```ts
import { createLoggerSystem, LogLevel } from 'rvlog';
import { RvlogNestModule } from 'rvlog-nest';

const system = createLoggerSystem({
  minLevel: LogLevel.INFO,
});

@Module({
  imports: [
    RvlogNestModule.forRoot({
      loggerSystem: system,
      logger: { minLevel: LogLevel.INFO },
      http: { context: 'HTTP' },
    }),
  ],
})
export class AppModule {}
```

When `loggerSystem` is provided:
- Nest HTTP logging uses that isolated runtime
- `stringify`, `notify`, and context resolution also use that runtime
- global `Logger.configure(...)` is not required
