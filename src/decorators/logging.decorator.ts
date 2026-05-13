import { LogLevel } from '../log/log-level';
import { Logger } from '../log/logger';
import {
  buildCalledLogMessage,
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  logAtLevel,
  maskLoggingValue,
  notifyLoggedError,
} from '../log/logging-runtime';
import { isNoLog } from './no-log.decorator';

type MetadataType = { prototype?: object | null };
type LoggingTarget = new (...args: any[]) => object;

export interface LoggingOptions {
  /** Level used for automatic entry and completion logs. Defaults to `INFO`. */
  level?: LogLevel;
}

function maskArgument(
  arg: unknown,
  parameterType?: MetadataType,
): unknown {
  return maskLoggingValue(arg, parameterType);
}

export function Logging<T extends LoggingTarget>(target: T): T;
export function Logging(options?: LoggingOptions): <T extends LoggingTarget>(target: T) => T;
export function Logging<T extends LoggingTarget>(
  targetOrOptions?: T | LoggingOptions,
): T | (<TTarget extends LoggingTarget>(target: TTarget) => TTarget) {
  if (typeof targetOrOptions === 'function') {
    return applyLogging(targetOrOptions, {});
  }

  return <TTarget extends LoggingTarget>(target: TTarget): TTarget =>
    applyLogging(target, targetOrOptions ?? {});
}

function applyLogging<T extends LoggingTarget>(target: T, options: LoggingOptions): T {
  const prototype = target.prototype;
  const level = options.level ?? LogLevel.INFO;

  Object.defineProperty(prototype, 'logger', {
    configurable: true,
    enumerable: false,
    get(this: object) {
      return new Logger(target.name);
    },
  });

  for (const key of Object.getOwnPropertyNames(prototype)) {
    if (key === 'constructor' || isNoLog(prototype, key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (!descriptor || typeof descriptor.value !== 'function') {
      continue;
    }

    const originalMethod = descriptor.value;
    const parameterTypes = Reflect.getMetadata('design:paramtypes', prototype, key) as
      | MetadataType[]
      | undefined;

    Object.defineProperty(prototype, key, {
      ...descriptor,
      value: function wrappedMethod(this: object, ...args: unknown[]) {
        const logger = new Logger(target.name);
        const startTime = performance.now();
        const maskedArgs = args.map((arg, index) => maskArgument(arg, parameterTypes?.[index]));

        logAtLevel(logger, level, buildCalledLogMessage(key, maskedArgs));

        try {
          const result = originalMethod.apply(this, args);

          if (result instanceof Promise) {
            return result
              .then((resolved) => {
                logAtLevel(logger, level, buildCompletedLogMessage(key, startTime));
                return resolved;
              })
              .catch((error: unknown) => {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                const duration = buildLogDuration(startTime);

                logger.error(buildFailedLogMessage(key, startTime), normalizedError);
                notifyLoggedError(target.name, key, maskedArgs, normalizedError, duration);
                throw error;
              });
          }

          logAtLevel(logger, level, buildCompletedLogMessage(key, startTime));
          return result;
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          const duration = buildLogDuration(startTime);

          logger.error(buildFailedLogMessage(key, startTime), normalizedError);
          notifyLoggedError(target.name, key, maskedArgs, normalizedError, duration);
          throw error;
        }
      },
    });
  }

  return target;
}
