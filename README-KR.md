# rvlog

데코레이터, 민감정보 마스킹, 에러 알림을 제공하는 프레임워크 독립형 TypeScript 로깅 라이브러리입니다.

## 주요 기능

- `@Logging` 데코레이터로 진입, 완료, 에러, duration 자동 로깅
- 클래스 없이도 쓸 수 있는 `withLogging()`
- 이름, 이메일, 전화번호, 비밀번호 등을 가릴 수 있는 `@MaskLog`
- 헬스체크나 고빈도 메서드를 제외하는 `@NoLog`
- Slack, Discord, Webhook, Sentry 채널을 붙일 수 있는 `NotificationManager`
- Node.js 환경에서 파일 저장과 rotate를 지원하는 `FileTransport`

## 설치

코어 패키지 기준 최소 요구 사항:

- `Node.js 18+`
- `TypeScript 5.7+`

```bash
npm install @kangjuhyup/rvlog reflect-metadata
pnpm add @kangjuhyup/rvlog reflect-metadata
yarn add @kangjuhyup/rvlog reflect-metadata
```

선택 의존성:

```bash
npm install @sentry/browser
pnpm add @sentry/browser
yarn add @sentry/browser
```

관련 패키지:

```bash
npm install @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
pnpm add @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
yarn add @kangjuhyup/rvlog-react @kangjuhyup/rvlog-nest
```

참고:

- `@Logging`, `@MaskLog`, `rvlog-nest`처럼 메타데이터 기반 기능을 사용할 때는 `reflect-metadata`가 필요합니다.
- 프레임워크 어댑터는 코어 `rvlog` 최소 요구 사항 외에 별도 런타임 조건이 있을 수 있습니다.

## 기본 사용법

데코레이터를 사용할 때는 앱 시작 지점에서 `reflect-metadata`를 한 번 먼저 import 하세요.

```ts
import "reflect-metadata";
import { Logger, Logging, LogLevel, MaskLog, NoLog } from "@kangjuhyup/rvlog";

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
  @MaskLog({ type: "name" })
  name!: string;

  @MaskLog({ type: "email" })
  email!: string;
}

@Logging
class UserService {
  declare logger: Logger;

  async create(dto: CreateUserDto) {
    this.logger.info("manual log before create");
    return { id: 1, ...dto };
  }

  @NoLog
  healthCheck() {
    return "ok";
  }
}
```

## Pretty 출력

기본 보기 좋은 콘솔 포맷은 `pretty: true`로 켤 수 있습니다. 일부 요소만 바꾸고 싶다면 전체 `formatter`를 직접 만들지 않고 `pretty`에 객체 옵션을 넘길 수 있습니다.

```ts
import { defineLoggerOptions, Logger, LogLevel } from "@kangjuhyup/rvlog";

const loggerOptions = defineLoggerOptions({
  pretty: {
    separator: "->",
    showTimestamp: false,
    levelLabels: {
      [LogLevel.INFO]: "info",
      [LogLevel.ERROR]: "error",
    },
    levelColors: {
      [LogLevel.INFO]: "cyan",
      [LogLevel.WARN]: "yellow",
      [LogLevel.ERROR]: "brightRed",
    },
  },
});

Logger.configure(loggerOptions);
```

출력 문자열 전체를 직접 제어해야 한다면 `formatter`를 사용하세요.

## 함수형 사용법

클래스 데코레이터 대신 함수 단위로 동일한 자동 로깅을 적용하고 싶다면 `withLogging()`을 사용하면 됩니다.

```ts
import { MaskLog, withLogging } from "@kangjuhyup/rvlog";

class SignupInput {
  @MaskLog({ type: "email" })
  email!: string;

  @MaskLog({ type: "full" })
  password!: string;
}

async function signupImpl(input: SignupInput) {
  return { id: crypto.randomUUID() };
}

export const signup = withLogging(signupImpl, {
  context: "signup",
});
```

## Node.js 파일 로그

파일 저장 기능은 Node 런타임에서만 `@kangjuhyup/rvlog/node`를 import 하세요.

```ts
import "reflect-metadata";
import { Logger, LogLevel } from "@kangjuhyup/rvlog";
import { FileTransport } from "@kangjuhyup/rvlog/node";

Logger.configure({
  minLevel: LogLevel.INFO,
  pretty: true,
  transports: [
    new FileTransport({
      enabled: true,
      dirPath: "logs",
      fileName: "rvlog.log",
      rotate: {
        type: "size",
        maxSizeBytes: 1024 * 1024,
        maxFiles: 3,
      },
    }),
  ],
});
```

## Payload 길이 제한

너무 큰 payload를 그대로 로그에 남기면 노이즈와 비용이 커질 수 있습니다. `rvlog`는 문자열, 배열, 객체, 깊은 중첩 값을 로그 전에 잘라낼 수 있습니다.

```ts
Logger.configure({
  pretty: true,
  serialize: {
    maxStringLength: 200,
    maxArrayLength: 20,
    maxObjectKeys: 30,
    maxDepth: 4,
    truncateSuffix: "...<truncated>",
  },
});
```

이 직렬화 정책은 다음 경로에 공통으로 적용됩니다.

- `Logger.info(...)`
- `@Logging`
- `withLogging()`

## 알림 연동

`NotificationManager`와 기본 채널을 조합해서 외부 서비스로 로그를 보낼 수 있습니다.

- `SentryChannel`
- `SlackChannel`
- `DiscordChannel`
- `WebhookChannel`

`SentryChannel`은 두 가지 전송 모드를 지원합니다.

- `mode: 'event'`: `captureMessage` / `captureException` 기반
- `mode: 'log'`: `enableLogs: true`와 함께 쓰는 `Sentry.logger.*` 기반

추가로 아래 옵션으로 분리 라우팅도 지원합니다.

- `eventLevels`: Issue/Event로 수집할 레벨
- `logLevels`: Sentry Logs로 수집할 레벨

관련 패키지 문서에 실제 연동 예시가 정리돼 있습니다.

- [packages/rvlog-react/README-KR.md](./packages/rvlog-react/README-KR.md)
- [packages/rvlog-nest/README-KR.md](./packages/rvlog-nest/README-KR.md)

## 예제

- [example/README.md](./example/README.md)
- `example/basic`: 순수 TypeScript + 데코레이터
- `example/express`: Express
- `example/nestjs`: NestJS
- `example/react`: React + hooks
- `example/vanilla`: 브라우저 TypeScript + `withLogging()`

문제 해결 문서:

- [FAQ-KR.md](./FAQ-KR.md)

## 벤치마크 리포트

성능 측정 결과는 아래 문서에 있습니다.

- [benchmark/REPORT-KR.md](./benchmark/REPORT-KR.md)
# 격리된 LoggerSystem 구성

간단한 앱에서는 기존처럼 `Logger.configure(...)` 기반 전역 설정을 그대로 써도 됩니다.

하지만 앱 단위, 테스트 단위, 테넌트 단위로 로거 상태를 분리하고 싶다면
`createLoggerSystem(...)`을 사용하는 편이 더 안전합니다.

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
logger.info('격리된 런타임에서 출력되는 로그');

const wrapped = withLogging(
  async (userId: string) => userId,
  {
    context: 'user-flow',
    system,
  },
);
```

이럴 때는 전역 `Logger`가 적합합니다.
- 프로세스 전체에서 설정이 하나면 충분할 때
- 가장 단순한 사용 방식이 필요할 때

이럴 때는 `LoggerSystem`이 더 적합합니다.
- 테스트가 전역 Logger 상태를 오염시키면 안 될 때
- 여러 앱 또는 여러 테넌트가 같은 런타임을 공유할 때
- framework adapter마다 transport/notification 구성을 분리하고 싶을 때
