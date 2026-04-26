import { createLoggerSystem, defineLoggerOptions, Logger, LogLevel } from "@kangjuhyup/rvlog";
import { FileTransport } from "@kangjuhyup/rvlog/node";

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
});

export const appLoggerSystem = createLoggerSystem(loggerOptions);

Logger.configure(loggerOptions);
