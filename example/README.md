# rvlog examples

이 디렉터리는 `rvlog`의 대표 사용 시나리오를 모아둔 예제입니다.

## 예제 목록

### Node (서버)

- `basic/` — 프레임워크 없이 `Logger.configure()` + `@Logging` + `@MaskLog` + 파일 저장을 보여주는 순수 TypeScript 예제. `src/features/advanced-logging/usage-example.ts`에서 `LoggerSystem`, `withTags()`, `withFields()` 사용 예시를 함께 확인할 수 있습니다.
- `express/` — `server → router → controller → service → dto` 흐름 + Slack 알림 + 파일 rotate. `src/features/advanced-logging/usage-example.ts`에서 서버 시작/유저 생성 시 구조화 태그 로그를 남기는 예시를 포함합니다.
- `nestjs/` — `main → module → controller → service → dto` 흐름 + daily rotate. `src/features/advanced-logging/setup.ts`, `usage-example.ts`에서 `loggerSystem` 주입 방식과 구조화 메타데이터 로깅 예시를 확인할 수 있습니다.

> Node 예제에서는 파일 저장을 위해 `rvlog/node`의 `FileTransport`를 `transports` 옵션으로 주입합니다.

### Browser (프론트엔드)

- `react/` — Vite + React + TS. **`useLogger` 훅**과 **`withLogging` HOF**로 도메인 함수를 감싸서 `@Logging` 데코레이터와 동일한 자동 로깅(진입/완료/에러/duration)을 훅 기반 코드에서도 얻는 패턴 + `SentryChannel` split mode (`ERROR -> Issue/Event`, `INFO/WARN -> Logs`) 연동. `src/features/advanced-logging/usage-example.ts`에서 `LoggerSystem`, `withTags()`, `withFields()`, `child()` 예시를 함께 제공합니다.
- `vanilla/` — Vite + 순수 TypeScript. **`withLogging` HOF**로 감싼 함수형 도메인 로직 + `@MaskLog` 자동 마스킹 + `SentryChannel` split mode (`ERROR -> Issue/Event`, `INFO/WARN -> Logs`) 연동. 클래스 서비스 없이도 데코레이터와 동등한 자동 로깅을 얻는 최소 예제이며, 동시에 `src/features/advanced-logging/usage-example.ts`에서 **`LoggerSystem` + `withTags()` + `withFields()` + `child()`** 사용 예시도 포함합니다.

> 브라우저 예제는 `rvlog/node` 를 임포트하지 않습니다 (`FileTransport` 제외).

각 예제는 독립적인 `package.json`과 `src/` 구조를 가집니다.
고급 사용법은 예제마다 `src/features/advanced-logging/` 디렉터리로 분리해 두었고, `usage-example.ts`를 열면 실제 사용 예시를 바로 읽을 수 있게 구성했습니다.

## 확인 포인트

- `pretty: true` 콘솔 포맷
- DTO 민감정보 마스킹(`@MaskLog`)
- `@NoLog` 메서드 제외
- Node: 파일 로그 + size/daily rotate
- Browser: `SentryChannel`로 `ERROR -> Issue/Event`, `INFO/WARN -> Logs` 전송
- Browser: 예제 기본 `environment`는 `local`, signup 성공 시 `Sentry.setUser()`로 user 식별 정보 설정, 브라우저별 `browserKey` tag 저장
- `NotificationManager` + `CircuitBreaker` + 쿨다운

## 실행

모든 예제는 각 예제 디렉터리에서 `pnpm dev` 또는 `pnpm start`로 실행할 수 있습니다.
Node 예제의 `basic/`, `express/`, `nestjs/`는 먼저 TypeScript를 `dist/`로 빌드한 뒤 `node`로 실행합니다.
필요한 루트 빌드와 예제 빌드는 각 예제의 `predev` / `prestart` 스크립트에서 자동으로 처리됩니다.

- `example/basic` — `pnpm install && pnpm dev`
- `example/express` — `pnpm install && pnpm dev`
- `example/nestjs` — `pnpm install && pnpm dev`
- `example/react`
  - `cp .env.example .env` 후 `VITE_SENTRY_DSN` 설정(선택)
  - `pnpm install && pnpm dev`
- `example/vanilla`
  - `cp .env.example .env` 후 `VITE_SENTRY_DSN` 설정(선택)
  - `pnpm install && pnpm dev`

DSN을 비워두면 Sentry 초기화는 건너뛰고, `SentryChannel.send()` 호출은 콘솔 출력까지만 수행합니다.
브라우저 예제에서 Sentry Logs를 보려면 최신 `@sentry/browser`와 `enableLogs: true`가 필요합니다.
React 예제는 개발 모드에서 `StrictMode` 때문에 mount/unmount 로그가 한 번 더 보일 수 있습니다.
브라우저 예제는 `environment: 'local'`로 전송되므로, Sentry UI 필터도 `local` 기준으로 보는 것이 안전합니다.
브라우저 예제는 localStorage 기반 `browserKey`를 Sentry tag로 올리므로, 같은 브라우저 인스턴스 로그를 묶어서 찾을 수 있습니다.

## 로그 예시

```txt
[INF] 2026:04:10 17:00:00 UserService :: create() called {"name":"홍*동","email":"ho***@gmail.com"}
[INF] 2026:04:10 17:00:00 UserService :: create() completed (1.24ms)
```
