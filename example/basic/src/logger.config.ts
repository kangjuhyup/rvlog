import {
  createLoggerSystem,
  defineLoggerOptions,
  Logger,
  LogLevel,
  NotificationManager,
  type LogContext,
  type NotificationChannel,
} from "@kangjuhyup/rvlog";
import { FileTransport } from "@kangjuhyup/rvlog/node";

class ConsoleAuditChannel implements NotificationChannel {
  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info(
      `[audit:${level}] ${context.className}.${context.methodName} -> ${message}`,
    );
  }
}

const notification = new NotificationManager()
  .addResource('console-audit', new ConsoleAuditChannel())
  .addLazyResource('email', async () => {
    console.info('[rvlog example] loading lazy email resource after threshold matched');

    const { ExampleEmailChannel } = await import('./features/alert-routing/example-email-channel');

    return new ExampleEmailChannel({
      to: 'ops@example.com',
      from: 'rvlog@example.com',
    });
  })
  .addRoute({
    resources: ['console-audit', 'email'],
    levels: [LogLevel.ERROR],
    when: {
      key: (_level, _message, context) =>
        `${context.className}:${context.methodName}:${context.error?.message ?? ''}`,
      threshold: { count: 3, windowMs: 60_000 },
      cooldownMs: 60_000,
    },
  });

const loggerOptions = defineLoggerOptions({
  minLevel: LogLevel.INFO,
  pretty: {
    separator: '=>',
    levelColors: {
      [LogLevel.INFO]: 'cyan',
      [LogLevel.WARN]: 'yellow',
      [LogLevel.ERROR]: 'brightRed',
    },
  },
  transports: [
    new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'rvlog.log',
      rotate: {
        type: 'size',
        maxSizeBytes: 1024 * 1024,
        maxFiles: 3,
      },
    }),
  ],
  notification,
});

export const appLoggerSystem = createLoggerSystem(loggerOptions);

Logger.configure(loggerOptions);
