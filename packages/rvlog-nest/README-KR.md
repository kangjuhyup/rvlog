# rvlog-nest

`rvlog-nest`는 `rvlog` 위에 NestJS 친화적인 HTTP 요청/응답 로깅을 얹는 패키지입니다.

## 주요 기능

- Guard와 filter보다 먼저 실행되는 Nest middleware 기반 request context 전파
- Guard, Pipe, Controller, Exception Filter를 모두 지난 최종 응답 status 로깅
- Nest interceptor 기반 전역 HTTP 호출 및 정상 완료 로깅
- request body, query, params 로깅
- `rvlog`의 `@MaskLog` 메타데이터를 이용한 민감정보 마스킹
- NestJS `@Body()` plain object payload 마스킹 지원
- HTTP 로그와 서비스 로그 사이 `requestId` 전파
- 상태 코드와 duration 로깅
- 코어 `rvlog` 직렬화 규칙을 공유하는 payload 길이 제한
- 헬스체크나 noisy endpoint 제외
- 실패 요청에 대한 payload 없는 WARN/ERROR 최종 로그

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

`RvlogNestModule.forRoot()`는 한 곳에서 코어 `rvlog` 설정, request context 및 최종 응답 middleware 등록, 전역 HTTP 인터셉터 등록을 함께 처리합니다.

## 요청 흐름

`rvlog-nest`는 middleware 단계에서 `x-request-id`를 재사용하거나 새로 생성합니다. 이 requestId는 middleware, guard, filter, HTTP 로그와 `@Logging` 서비스 로그에 함께 전파됩니다.

middleware는 응답의 `finish` 경계도 관찰합니다. 따라서 Guard, Pipe, Controller, Exception Filter 처리가 끝난 뒤 기록된 최종 status를 사용하며, HTTP interceptor에 진입하지 못한 Guard 401/403도 기록합니다.

```txt
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users called {"body":{"name":"강*협","email":"ab***@abc.com"}}
[INF] 2026:04:23 16:48:11 [req-123] AuthGuard :: canActivate() called
[INF] 2026:04:23 16:48:11 [req-123] UserService :: create() called {"name":"강*협","email":"ab***@abc.com"}
[INF] 2026:04:23 16:48:11 [req-123] HTTP :: POST /users completed 201 (10.25ms)
```

최종 HTTP 로그 레벨은 실제 응답 status로 결정합니다.

- 2XX/3XX: 설정된 HTTP `level`
- 4XX: `WARN`
- 5XX: `ERROR`

```txt
[WRN] 2026:04:23 16:48:11 [req-401] HTTP :: POST /votes failed 401 (2.15ms)
[ERR] 2026:04:23 16:48:11 [req-500] HTTP :: POST /votes failed 500 (8.40ms)
```

요청 하나당 최종 HTTP 로그는 최대 한 번만 기록합니다. 실패 최종 로그에는 method, query string을 제거한 path, 최종 status, duration만 포함합니다. URL query, 요청/응답 payload, header, token, 예외 메시지와 stack은 포함하지 않습니다. 하위 호환을 위해 기존 payload 옵션은 요청 호출 로그와 정상 완료 로그에 계속 적용됩니다.

`excludePaths`는 호출 로그와 최종 HTTP 로그를 모두 제외합니다. 제외 경로에서도 request context 전파와 설정된 request-id 응답 header는 유지됩니다.

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
