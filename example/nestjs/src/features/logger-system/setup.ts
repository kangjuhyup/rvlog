import {
  createLoggerSystem,
  defineLoggerOptions,
  LogLevel,
  type LogContext,
  type NotificationChannel,
  NotificationManager,
} from "@kangjuhyup/rvlog";
import { FileTransport } from "@kangjuhyup/rvlog/node";

class NestConsoleAuditChannel implements NotificationChannel {
  async send(level: LogLevel, message: string, context: LogContext): Promise<void> {
    console.info(
      `[nest-audit:${level}] ${context.className}.${context.methodName} -> ${message}`,
    );
  }
}

const notification = new NotificationManager()
  .addResource("nest-console-audit", new NestConsoleAuditChannel())
  .addLazyResource("nest-email", async () => {
    console.info("[rvlog nest example] loading lazy email resource after threshold matched");

    const { NestExampleEmailChannel } = await import("../alert-routing/nest-email-channel");

    return new NestExampleEmailChannel({
      to: "nest-ops@example.com",
      from: "rvlog-nest@example.com",
    });
  })
  .addRoute({
    resources: ["nest-console-audit", "nest-email"],
    levels: [LogLevel.ERROR],
    when: {
      key: (_level, _message, context) =>
        `${context.className}:${context.methodName}:${context.error?.message ?? ""}`,
      threshold: { count: 3, windowMs: 60_000 },
      cooldownMs: 60_000,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeMs: 30_000,
      timeoutMs: 5_000,
    },
  });

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
  notification,
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
