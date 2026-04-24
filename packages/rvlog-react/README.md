# rvlog-react

`rvlog-react` adds React-friendly hooks and components on top of the `rvlog` core.

## Features

| API | Purpose |
|---|---|
| `useLogger(context)` | Returns a reusable `Logger` instance scoped to a component or hook |
| `useHookLogging(context)` | Hook-level logging for lifecycle, actions, and state changes |
| `useComponentLogging(component)` | Component-level logging for mount/unmount, re-render, and UI events |
| `<Logging component>` | Component wrapper plus context provider |
| `useLoggingContext()` | Access `trackEvent` and `logger` anywhere below `<Logging>` |

## Usage

### useLogger

The most basic hook. It returns a `Logger` instance for the given component or hook context.

```tsx
import { useLogger } from 'rvlog-react';

function MyComponent() {
  const logger = useLogger('MyComponent');
  logger.info('rendered');
}
```

### useHookLogging

Use this when you want to log hook lifecycle, actions, and state transitions from one boundary.

```ts
import { useHookLogging } from 'rvlog-react';

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

`useHookLogging()` gives you two main helpers:

- `run(name, fn, level?)`
  Wraps an action function and logs start, completion, failure, and duration automatically.
- `traceState(name, value)`
  Writes debug logs for state changes or derived values. This is useful for values such as `status`, `userId`, `step`, or `isDirty`.

Example:

```ts
const { run, traceState } = useHookLogging('useSignup');

useEffect(() => {
  traceState('status', status);
}, [status, traceState]);

useEffect(() => {
  traceState('userId', userId);
}, [traceState, userId]);
```

This produces debug logs similar to:

```txt
[DBG] useSignup :: state status -> "running"
[DBG] useSignup :: state userId -> "3f2a..."
```

If you pass objects, `rvlog` applies its shared serialization rules. DTO instances decorated with `@MaskLog` are logged in masked form.

### Logging + useLoggingContext

`<Logging>` automatically logs mount/unmount and re-renders, then exposes `trackEvent` through React context so child components can use it without prop drilling.

```tsx
import { Logging, useLoggingContext } from 'rvlog-react';

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

You can also use the hook directly without `<Logging>`.

```tsx
import { useComponentLogging } from 'rvlog-react';

function App() {
  const { trackEvent, renderCount } = useComponentLogging('App');
  return <button onClick={trackEvent('click:save', onSave)}>save</button>;
}
```

## External Integrations

You can forward selected log levels to external services by combining the `rvlog` core `NotificationManager` with channels.
Logs produced by `rvlog-react` hooks and components follow the same integration path.

### Sentry Event Mode

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from 'rvlog';

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

With this setup, errors raised through `run()` or `trackEvent` flow into Sentry through `SentryChannel`.

### Sentry Log Mode

If you want structured logs in the Sentry Logs UI, use a recent `@sentry/browser` version together with `enableLogs: true`.

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from 'rvlog';

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

- `mode: 'event'` uses `captureMessage` / `captureException`
- `mode: 'log'` uses `Sentry.logger.*`

### Sentry Split Mode

In practice, a common setup is to route:

- `ERROR` -> Issue/Event
- `INFO`, `WARN` -> Sentry Logs

```ts
import * as Sentry from '@sentry/browser';
import { Logger, LogLevel, NotificationManager, SentryChannel } from 'rvlog';

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

Notes:

- Sentry Logs requires a recent `@sentry/browser` release plus `enableLogs: true`
- In React development mode, `StrictMode` may cause mount/unmount logs to appear an extra time

### Slack

```ts
import { Logger, LogLevel, NotificationManager, SlackChannel } from 'rvlog';

const notification = new NotificationManager().addRule({
  channel: new SlackChannel({ webhookUrl: import.meta.env.VITE_SLACK_WEBHOOK }),
  levels: [LogLevel.ERROR, LogLevel.WARN],
  cooldownMs: 30_000,
});

Logger.configure({ notification });
```

### Discord

```ts
import { Logger, LogLevel, NotificationManager, DiscordChannel } from 'rvlog';

const notification = new NotificationManager().addRule({
  channel: new DiscordChannel({ webhookUrl: import.meta.env.VITE_DISCORD_WEBHOOK }),
  levels: [LogLevel.ERROR],
  cooldownMs: 30_000,
});

Logger.configure({ notification });
```

### Webhook

```ts
import { Logger, LogLevel, NotificationManager, WebhookChannel } from 'rvlog';

const notification = new NotificationManager().addRule({
  channel: new WebhookChannel({ url: 'https://log-collector.example.com/ingest' }),
  levels: [LogLevel.ERROR, LogLevel.WARN],
  cooldownMs: 10_000,
});

Logger.configure({ notification });
```

### Multiple Channels

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
# Using LoggerSystem in React

`rvlog-react` works with the global `Logger`, but it can also use an isolated
`LoggerSystem`.

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

This is useful when:
- React tests must stay isolated from global logger configuration
- one page or feature should use a dedicated notification pipeline
- multiple embedded apps run in the same browser runtime
