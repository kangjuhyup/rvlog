import {
  createLoggerSystem,
  defineLoggerOptions,
  Logger,
  LogLevel,
  type LogContext,
  type NotificationChannel,
  NotificationManager,
} from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';

class ExpressConsoleAuditChannel implements NotificationChannel {
  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info(
      `[express-audit:${level}] ${context.className}.${context.methodName} -> ${message}`,
    );
  }
}

const notification = new NotificationManager()
  .addResource('express-console-audit', new ExpressConsoleAuditChannel())
  .addLazyResource('express-email', async () => {
    console.info('[rvlog express example] loading lazy email resource after threshold matched');

    const { ExpressExampleEmailChannel } = await import('./features/alert-routing/express-email-channel');

    return new ExpressExampleEmailChannel({
      to: 'express-ops@example.com',
      from: 'rvlog-express@example.com',
    });
  })
  .addRoute({
    resources: ['express-console-audit', 'express-email'],
    levels: [LogLevel.ERROR],
    when: {
      key: (_level, _message, context) =>
        `${context.className}:${context.methodName}:${context.error?.message ?? ''}`,
      threshold: { count: 3, windowMs: 60_000 },
      cooldownMs: 60_000,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeMs: 30_000,
      timeoutMs: 5_000,
    },
  });

const loggerOptions = defineLoggerOptions({
  minLevel: LogLevel.INFO,
  pretty: {
    separator: 'HTTP',
    levelColors: {
      [LogLevel.INFO]: 'green',
      [LogLevel.WARN]: 'yellow',
      [LogLevel.ERROR]: 'brightRed',
    },
  },
  notification,
  transports: [
    new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'express.log',
      rotate: {
        type: 'size',
        maxSizeBytes: 2 * 1024 * 1024,
        maxFiles: 5,
      },
    }),
  ],
});

export const appLoggerSystem = createLoggerSystem(loggerOptions);

Logger.configure(loggerOptions);
