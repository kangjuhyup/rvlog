import {
  Logger,
  LogLevel,
  NotificationManager,
  SlackChannel,
} from 'rvlog';
import { FileTransport } from 'rvlog/node';

Logger.configure({
  minLevel: LogLevel.INFO,
  pretty: true,
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
