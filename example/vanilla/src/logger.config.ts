import * as Sentry from '@sentry/browser';
import {
  Logger,
  LogLevel,
  NotificationManager,
  SentryChannel,
} from '@kangjuhyup/rvlog';

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
  });

  const browserKey = getBrowserKey();

  if (browserKey) {
    Sentry.setTag('browserKey', browserKey);
  }
}

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

Logger.configure({
  minLevel: LogLevel.DEBUG,
  pretty: true,
  notification,
});
