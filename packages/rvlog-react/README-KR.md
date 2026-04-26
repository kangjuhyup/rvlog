# rvlog-react

`rvlog-react`는 `rvlog` 코어 위에 React 친화적인 훅과 컴포넌트를 얹는 패키지입니다.

## 제공 API

| API | 용도 |
|---|---|
| `useLogger(context)` | 컴포넌트/훅 범위의 `Logger` 인스턴스를 반환 |
| `useHookLogging(context)` | 커스텀 훅 단위 로깅 (생명주기, 액션, 상태 추적) |
| `useComponentLogging(component)` | 컴포넌트 단위 로깅 (mount/unmount, re-render, 이벤트) |
| `<Logging component>` | 컴포넌트 래퍼 + Context Provider |
| `useLoggingContext()` | `<Logging>` 하위에서 `trackEvent`, `logger` 접근 |

## 사용법

### useLogger

가장 기본적인 훅입니다. 컴포넌트나 훅 컨텍스트 이름에 해당하는 `Logger` 인스턴스를 반환합니다.

```tsx
import { useLogger } from '@kangjuhyup/rvlog-react';

function MyComponent() {
  const logger = useLogger('MyComponent');
  logger.info('rendered');
}
```

### useHookLogging

커스텀 훅의 생명주기, 액션 실행, 상태 변화를 한 경계에서 함께 기록하고 싶을 때 사용합니다.

```ts
import { useHookLogging } from '@kangjuhyup/rvlog-react';

export function useSignup() {
  const { run, traceState } = useHookLogging('useSignup');

  const signup = run('signup', async (input: SignupInput) => {
    const result = await api.signup(input);
    traceState('userId', result.id);
    return result;
  });

  return { signup };
}
```

`useHookLogging()`은 크게 두 가지 헬퍼를 제공합니다.

- `run(name, fn, level?)`
  액션 함수를 감싸서 시작/완료/실패/duration 로그를 자동으로 남깁니다.
- `traceState(name, value)`
  상태 변화나 파생 값을 debug 로그로 남깁니다. 예를 들어 `status`, `userId`, `step`, `isDirty` 같은 값의 변화를 추적할 때 유용합니다.

예를 들면:

```ts
const { run, traceState } = useHookLogging('useSignup');

useEffect(() => {
  traceState('status', status);
}, [status, traceState]);

useEffect(() => {
  traceState('userId', userId);
}, [traceState, userId]);
```

위 코드는 대략 다음과 같은 debug 로그를 남깁니다.

```txt
[DBG] useSignup :: state status -> "running"
[DBG] useSignup :: state userId -> "3f2a..."
```

객체 값을 넘기면 `rvlog`의 공통 직렬화 정책을 따르고, `@MaskLog`가 붙은 DTO 인스턴스는 마스킹된 형태로 기록됩니다.

### Logging + useLoggingContext

`<Logging>` 컴포넌트는 mount/unmount, re-render를 자동으로 기록하고, React context를 통해 하위 컴포넌트 어디서든 `trackEvent`에 접근할 수 있게 해줍니다.

```tsx
import { Logging, useLoggingContext } from '@kangjuhyup/rvlog-react';

function SaveButton() {
  const { trackEvent } = useLoggingContext();
  return <button onClick={trackEvent('click:save', onSave)}>save</button>;
}

function App() {
  return (
    <Logging component="App">
      <SaveButton />
    </Logging>
  );
}
```

### useComponentLogging

`<Logging>` 없이 훅만 직접 사용할 수도 있습니다.

```tsx
import { useComponentLogging } from '@kangjuhyup/rvlog-react';

function App() {
  const { trackEvent, renderCount } = useComponentLogging('App');
  return <button onClick={trackEvent('click:save', onSave)}>save</button>;
}
```

## 외부 로그 서비스 연동

`rvlog` 코어의 `NotificationManager`와 채널을 조합하면 특정 레벨의 로그를 외부 SaaS로 전송할 수 있습니다.
`rvlog-react` 훅/컴포넌트에서 발생하는 로그도 같은 경로를 따릅니다.

### Sentry Event Mode

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from '@kangjuhyup/rvlog';

Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });

const notification = new NotificationManager().addRule({
  channel: new SentryChannel({ client: Sentry, minLevel: LogLevel.ERROR }),
  levels: [LogLevel.ERROR],
  cooldownMs: 10_000,
  circuitBreaker: {
    failureThreshold: 3,
    recoveryTimeMs: 30_000,
    timeoutMs: 5_000,
  },
});

Logger.configure({
  minLevel: LogLevel.DEBUG,
  pretty: true,
  notification,
});
```

```tsx
import './logger.config';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

이 구성을 사용하면 `run()`이나 `trackEvent` 경로에서 발생한 에러가 `SentryChannel`을 통해 Sentry로 전송됩니다.

### Sentry Log Mode

Sentry Logs UI로 구조화 로그를 보내고 싶다면 최신 `@sentry/browser`와 `enableLogs: true`를 함께 사용하세요.

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from '@kangjuhyup/rvlog';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enableLogs: true,
});

const notification = new NotificationManager().addRule({
  channel: new SentryChannel({
    client: Sentry,
    minLevel: LogLevel.INFO,
    mode: 'log',
  }),
  levels: [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR],
  cooldownMs: 10_000,
});

Logger.configure({
  minLevel: LogLevel.DEBUG,
  pretty: true,
  notification,
});
```

- `mode: 'event'`는 `captureMessage` / `captureException` 기반입니다.
- `mode: 'log'`는 `Sentry.logger.*` 기반입니다.

### Sentry Split Mode

실무에서는 보통 아래처럼 분리하는 구성이 자연스럽습니다.

- `ERROR` -> Issue/Event
- `INFO`, `WARN` -> Sentry Logs

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from '@kangjuhyup/rvlog';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enableLogs: true,
});

const notification = new NotificationManager().addRule({
  channel: new SentryChannel({
    client: Sentry,
    minLevel: LogLevel.INFO,
    eventLevels: [LogLevel.ERROR],
    logLevels: [LogLevel.INFO, LogLevel.WARN],
  }),
  levels: [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR],
  cooldownMs: 10_000,
});
```

참고:

- Sentry Logs를 사용하려면 최신 `@sentry/browser`와 `enableLogs: true`가 필요합니다.
- React 개발 모드에서는 `StrictMode` 때문에 mount/unmount 로그가 한 번 더 보일 수 있습니다.

### Slack

```ts
import { Logger, LogLevel, NotificationManager, SlackChannel } from '@kangjuhyup/rvlog';

const notification = new NotificationManager().addRule({
  channel: new SlackChannel({ webhookUrl: import.meta.env.VITE_SLACK_WEBHOOK }),
  levels: [LogLevel.ERROR, LogLevel.WARN],
  cooldownMs: 30_000,
});

Logger.configure({ notification });
```

### Discord

```ts
import { Logger, LogLevel, NotificationManager, DiscordChannel } from '@kangjuhyup/rvlog';

const notification = new NotificationManager().addRule({
  channel: new DiscordChannel({ webhookUrl: import.meta.env.VITE_DISCORD_WEBHOOK }),
  levels: [LogLevel.ERROR],
  cooldownMs: 30_000,
});

Logger.configure({ notification });
```

### Webhook

```ts
import { Logger, LogLevel, NotificationManager, WebhookChannel } from '@kangjuhyup/rvlog';

const notification = new NotificationManager().addRule({
  channel: new WebhookChannel({ url: 'https://log-collector.example.com/ingest' }),
  levels: [LogLevel.ERROR, LogLevel.WARN],
  cooldownMs: 10_000,
});

Logger.configure({ notification });
```

### 여러 채널 동시 사용

```ts
const notification = new NotificationManager()
  .addRule({
    channel: new SentryChannel({ client: Sentry, minLevel: LogLevel.ERROR }),
    levels: [LogLevel.ERROR],
    cooldownMs: 10_000,
  })
  .addRule({
    channel: new SlackChannel({ webhookUrl: slackWebhook }),
    levels: [LogLevel.ERROR, LogLevel.WARN],
    cooldownMs: 30_000,
  });

Logger.configure({ notification });
```
# React에서 LoggerSystem 사용하기

`rvlog-react`는 전역 `Logger`를 그대로 사용할 수 있지만,
필요하면 격리된 `LoggerSystem`도 함께 사용할 수 있습니다.

```ts
import { createLoggerSystem, LogLevel } from 'rvlog';
import { useHookLogging } from 'rvlog-react';

const system = createLoggerSystem({
  minLevel: LogLevel.INFO,
});

function useSignup() {
  const { run, traceState } = useHookLogging('useSignup', { system });

  return {
    signup: run('signup', async (email: string) => email),
    traceState,
  };
}
```

이 방식은 아래 같은 경우에 유용합니다.
- React 테스트가 전역 Logger 설정에 영향받지 않아야 할 때
- 특정 화면이나 기능만 별도 notification pipeline을 써야 할 때
- 하나의 브라우저 런타임에서 여러 앱이 함께 동작할 때
