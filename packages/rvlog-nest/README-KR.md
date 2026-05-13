# rvlog-nest

`rvlog-nest`는 `rvlog` 위에 NestJS 친화적인 HTTP 요청/응답 로깅을 얹는 패키지입니다.

## 주요 기능

- Nest interceptor 기반 전역 HTTP 로깅
- request body, query, params 로깅
- `rvlog`의 `@MaskLog` 메타데이터를 이용한 민감정보 마스킹
- NestJS `@Body()` plain object payload 마스킹 지원
- HTTP 로그와 서비스 로그 사이 `requestId` 전파
- 상태 코드와 duration 로깅
- 코어 `rvlog` 직렬화 규칙을 공유하는 payload 길이 제한
- 헬스체크나 noisy endpoint 제외

## 설치

```bash
npm install @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
pnpm add @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
yarn add @kangjuhyup/rvlog @kangjuhyup/rvlog-nest reflect-metadata
```

## 사용법

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

`RvlogNestModule.forRoot()`는 한 곳에서 코어 `rvlog` 설정과 전역 HTTP 인터셉터 등록을 함께 처리합니다.

## 요청 흐름

`rvlog-nest`는 `x-request-id`를 재사용하거나 새로 생성해서 HTTP 로그와 `@Logging` 서비스 로그에 함께 전파합니다.

```txt
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users called {"body":{"name":"강*협","email":"ab***@abc.com"}}
[INF] 2026:04:23 16:48:11 [req-123] UserService :: create() called {"name":"강*협","email":"ab***@abc.com"}
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users completed 201 (10.25ms)
```

## HTTP 옵션

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
    setResponseHeader: true,
  },
})
```

## Payload 길이 제한

HTTP 로그도 `Logger.info(...)`, `@Logging`, `withLogging()`과 동일한 코어 직렬화 정책을 따릅니다.

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
# NestJS에서 LoggerSystem 사용하기

`RvlogNestModule.forRoot(...)`는 기존처럼 전역 `Logger`를 설정할 수도 있지만,
격리된 `LoggerSystem`을 주입해서 사용할 수도 있습니다.

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
      http: { context: 'HTTP', level: LogLevel.DEBUG },
    }),
  ],
})
export class AppModule {}
```

`loggerSystem`을 넘기면:
- Nest HTTP 로깅이 그 격리된 런타임을 사용하고
- `stringify`, `notify`, context resolver도 그 시스템을 따르며
- 전역 `Logger.configure(...)`에만 의존하지 않아도 됩니다
