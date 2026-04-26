import {
  createLoggerSystem,
  defineLoggerOptions,
  Logger,
  LogLevel,
  NotificationManager,
  SlackChannel,
} from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';

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
  notification: new NotificationManager().addRule({
    channel: new SlackChannel(process.env.SLACK_WEBHOOK_URL ?? 'https://hooks.slack.com/services/example'),
    levels: [LogLevel.ERROR],
    cooldownMs: 60_000,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeMs: 30_000,
      timeoutMs: 5_000,
    },
  }),
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
