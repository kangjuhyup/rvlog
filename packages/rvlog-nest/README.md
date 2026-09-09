# rvlog-nest

`rvlog-nest` adds NestJS-friendly HTTP request/response logging on top of `rvlog`.

## Features

- Request context propagation via Nest middleware before guards and filters
- Final response status logging across guards, pipes, controllers, and exception filters
- Global HTTP call and successful completion logging via Nest interceptor
- Request body/query/params logging
- Sensitive field masking through `rvlog`'s `@MaskLog` metadata
- Plain-object masking support for NestJS `@Body()` payloads
- Shared `requestId` and `traceId` propagation across HTTP and service logs
- Tenant/principal enrichment for HTTP guards and worker jobs
- Injectable context-bound logger providers for services and tests
- Duration and status code logging
- Shared payload truncation using core `rvlog` serialization rules
- Path exclusion for health checks or noisy routes
- Payload-free WARN/ERROR terminal logs for failed requests

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
        level: LogLevel.INFO,
        excludePaths: ['/health'],
      },
    }),
  ],
})
export class AppModule {}
```

`RvlogNestModule.forRoot()` configures the core `rvlog` logger, registers request context and final-response middleware, and registers the global HTTP interceptor in one place.

## Request Flow

`rvlog-nest` creates or reuses a request id from `x-request-id` and a trace id
from `x-trace-id` or W3C `traceparent` in middleware, before guards and route
handlers run. Both values are propagated into middleware, guard, filter, HTTP,
and service logs produced by `@Logging`.

The middleware also observes the response `finish` boundary. This records the status written after guards, pipes, controllers, and exception filters have run, including a 401/403 response that never enters the HTTP interceptor.

```txt
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users called {"body":{"name":"강*협","email":"ab***@abc.com"}}
[INF] 2026:04:23 16:48:11 [req-123] AuthGuard :: canActivate() called
[INF] 2026:04:23 16:48:11 [req-123] UserService :: create() called {"name":"강*협","email":"ab***@abc.com"}
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users completed 201 (10.25ms)
```

Terminal HTTP log levels are determined by the final response status:

- 2XX/3XX: the configured HTTP `level`
- 4XX: `WARN`
- 5XX: `ERROR`

```txt
[WRN] 2026:04:23 16:48:11 [req-401] HTTP :: POST /votes failed 401 (2.15ms)
[ERR] 2026:04:23 16:48:11 [req-500] HTTP :: POST /votes failed 500 (8.40ms)
```

Each request produces at most one terminal HTTP log. A failed terminal log contains only the method, normalized path, final status, and duration. URL query strings, request/response payloads, headers, tokens, exception messages, and exception stacks are not included. Existing payload options still apply to request call logs and successful completion logs for backward compatibility.

`excludePaths` suppresses both call and terminal HTTP logs. Request context propagation and the configured request-id response header remain active for excluded paths.

## HTTP Options

```ts
RvlogNestModule.forRoot({
  http: {
    context: 'HTTP',
    level: LogLevel.INFO,
    logBody: true,
    logQuery: true,
    logParams: true,
    logHeaders: false,
    logResponseBody: false,
    excludePaths: ['/health'],
    requestIdHeader: 'x-request-id',
    traceIdHeader: 'x-trace-id',
    setResponseHeader: true,
    contextEnricher: (request) => {
      const tenantId = request.headers?.['x-tenant-id'];
      return typeof tenantId === 'string' ? { tenantId } : undefined;
    },
  },
})
```

## Injectable Structured Logger and Authorization Audit

Register a context-bound logger with a service-owned token. The service depends
on `StructuredLoggerLike`, so tests can replace the provider or configure an
`InMemoryLogTransport` without spying on global prototypes.

```ts
import { Inject, Injectable, Module } from '@nestjs/common';
import { LogLevel, type StructuredLoggerLike } from '@kangjuhyup/rvlog';
import {
  createRvlogLoggerProvider,
  enrichRvlogContext,
} from '@kangjuhyup/rvlog-nest';

const VOTE_AUDIT_LOGGER = Symbol('VOTE_AUDIT_LOGGER');

@Injectable()
class VoteAuthorizationAudit {
  constructor(
    @Inject(VOTE_AUDIT_LOGGER)
    private readonly logger: StructuredLoggerLike,
  ) {}

  recordDecision(userPrincipalId: string, tenantId: string, allowed: boolean) {
    enrichRvlogContext({ userPrincipalId, tenantId });
    this.logger.event(
      'authorization.decision',
      { action: 'vote.read', resourceType: 'vote', allowed },
      allowed ? LogLevel.INFO : LogLevel.WARN,
    );
  }
}

@Module({
  providers: [
    createRvlogLoggerProvider(VOTE_AUDIT_LOGGER, 'VoteAuthorization'),
    VoteAuthorizationAudit,
  ],
})
class VoteModule {}
```

Do not place authorization headers, cookies, credentials, passwords, or tokens
in event metadata. Sensitive key families are recursively masked as a defense
in depth measure, but identifiers and authorization outcomes are preferable for
audit events.

For a worker, establish the same context around each job:

```ts
import {
  enrichRvlogContext,
  runWithRvlogContext,
} from '@kangjuhyup/rvlog-nest';

await runWithRvlogContext(
  { requestId: job.id, traceId: job.traceId },
  async () => {
    enrichRvlogContext({
      tenantId: job.tenantId,
      userPrincipalId: job.requestedBy,
    });
    logger.event('vote.count.completed', { voteId: job.voteId });
  },
);
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
import { createLoggerSystem, LogLevel } from '@kangjuhyup/rvlog';
import { RvlogNestModule } from '@kangjuhyup/rvlog-nest';

const system = createLoggerSystem({
  minLevel: LogLevel.INFO,
});

@Module({
  imports: [
    RvlogNestModule.forRoot({
      loggerSystem: system,
      logger: { minLevel: LogLevel.INFO },
      http: { context: 'HTTP', level: LogLevel.DEBUG },
    }),
  ],
})
export class AppModule {}
```

When `loggerSystem` is provided:
- Nest HTTP logging uses that isolated runtime
- `stringify`, `notify`, and context resolution also use that runtime
- global `Logger.configure(...)` is not required
