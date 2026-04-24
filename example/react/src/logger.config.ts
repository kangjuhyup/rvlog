import 'reflect-metadata';
import * as Sentry from '@sentry/browser';
import {
  Logger,
  LogLevel,
  NotificationManager,
  SentryChannel,
} from 'rvlog';

// 1) Sentry 초기화는 앱 진입점에서 한 번만.
//    실제 운영에서는 DSN을 환경 변수로 주입하세요 (Vite: import.meta.env.VITE_SENTRY_DSN).
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const BROWSER_KEY_STORAGE_KEY = 'rvlog.browserKey';

function generateBrowserKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `browser-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getBrowserKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(BROWSER_KEY_STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const created = generateBrowserKey();
    window.localStorage.setItem(BROWSER_KEY_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: 'local',
    enableLogs: true,
    // 개발 단계에서 실제 전송을 막으려면 beforeSend에서 null을 반환하세요.
    // beforeSend: (event) => { console.log('[sentry]', event); return null; },
  });

  const browserKey = getBrowserKey();

  if (browserKey) {
    Sentry.setTag('browserKey', browserKey);
  }
}

// 2) ERROR는 Issue/Event로, INFO/WARN은 Sentry Logs로 전달하도록 구성.
const notification = new NotificationManager().addRule({
  channel: new SentryChannel({
    client: Sentry,
    minLevel: LogLevel.INFO,
    eventLevels: [LogLevel.ERROR],
    logLevels: [LogLevel.INFO, LogLevel.WARN],
  }),
  levels: [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR],
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
