import {
  createLoggerSystem,
  defineLoggerOptions,
  LogLevel,
  NotificationManager,
  SlackChannel,
} from "@kangjuhyup/rvlog";
import { FileTransport } from "@kangjuhyup/rvlog/node";

export const nestLoggerOptions = defineLoggerOptions({
  minLevel: LogLevel.INFO,
  pretty: {
    separator: "Nest",
    levelColors: {
      [LogLevel.INFO]: "cyan",
      [LogLevel.WARN]: "yellow",
      [LogLevel.ERROR]: "brightRed",
    },
  },
  notification: new NotificationManager().addRule({
    channel: new SlackChannel(
      process.env.SLACK_WEBHOOK_URL ??
        "https://hooks.slack.com/services/example",
    ),
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
      dirPath: "logs",
      fileName: "nestjs.log",
      rotate: {
        type: "daily",
      },
    }),
  ],
});

export const nestLoggerSystem = createLoggerSystem(nestLoggerOptions);
