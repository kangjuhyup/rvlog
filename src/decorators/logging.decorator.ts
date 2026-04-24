import { Logger } from '../log/logger';
import {
  buildCalledLogMessage,
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  maskLoggingValue,
  notifyLoggedError,
} from '../log/logging-runtime';
import { isNoLog } from './no-log.decorator';

type MetadataType = { prototype?: object | null };

function maskArgument(
  arg: unknown,
  parameterType?: MetadataType,
): unknown {
  return maskLoggingValue(arg, parameterType);
}

export function Logging<T extends new (...args: any[]) => object>(target: T): T {
  const prototype = target.prototype;

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

        logger.info(buildCalledLogMessage(key, maskedArgs));

        try {
          const result = originalMethod.apply(this, args);

          if (result instanceof Promise) {
            return result
              .then((resolved) => {
                logger.info(buildCompletedLogMessage(key, startTime));
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

          logger.info(buildCompletedLogMessage(key, startTime));
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
