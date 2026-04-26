import { useCallback, useEffect } from "react";
import {
  LogLevel,
  Logger,
  LoggerSystem,
  ScopedLogger,
} from "@kangjuhyup/rvlog";
import {
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  logAtLevel,
  maskLoggingValue,
  notifyLoggedError,
  stringifyLoggingValue,
} from "./logging-runtime";
import { useLogger } from "./use-logger";

export interface UseHookLoggingResult {
  logger: ScopedLogger;
  traceState: (name: string, value: unknown) => void;
  run: <TArgs extends unknown[], TResult>(
    name: string,
    fn: (...args: TArgs) => TResult,
    level?: LogLevel,
  ) => (...args: TArgs) => TResult;
}

export interface UseHookLoggingOptions {
  system?: LoggerSystem;
}

/**
 * 커스텀 훅 단위 로깅을 위한 React 전용 헬퍼.
 * 훅 생명주기, 액션 수행, 상태 변경을 한 경계에서 기록한다.
 */
export function useHookLogging(
  context: string,
  options: UseHookLoggingOptions = {},
): UseHookLoggingResult {
  const logger = useLogger(context, options.system);

  useEffect(() => {
    logger.info("hook mounted");

    return () => {
      logger.info("hook unmounted");
    };
  }, [logger]);

  const traceState = useCallback(
    (name: string, value: unknown) => {
      logger.debug(`state ${name} -> ${stringifyLoggingValue(value)}`);
    },
    [logger],
  );

  const run = useCallback(
    <TArgs extends unknown[], TResult>(
      name: string,
      fn: (...args: TArgs) => TResult,
      level: LogLevel = LogLevel.INFO,
    ) =>
      (...args: TArgs): TResult => {
        const startTime = performance.now();
        const maskedArgs = args.map((arg) => maskLoggingValue(arg)) as TArgs;
        const suffix =
          maskedArgs.length > 0 ? ` ${stringifyLoggingValue(maskedArgs)}` : "";

        logAtLevel(logger, level, `${name}() started${suffix}`);

        try {
          const result = fn(...args);

          if (result instanceof Promise) {
            return result
              .then((resolved) => {
                logAtLevel(
                  logger,
                  level,
                  buildCompletedLogMessage(name, startTime),
                );

                return resolved;
              })
              .catch((error: unknown) => {
                const normalizedError =
                  error instanceof Error ? error : new Error(String(error));
                const duration = buildLogDuration(startTime);

                logger.error(
                  buildFailedLogMessage(name, startTime),
                  normalizedError,
                );
                notifyLoggedError(
                  context,
                  name,
                  maskedArgs,
                  normalizedError,
                  duration,
                  options.system ?? Logger,
                );
                throw error;
              }) as TResult;
          }

          logAtLevel(logger, level, buildCompletedLogMessage(name, startTime));

          return result;
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          const duration = buildLogDuration(startTime);

          logger.error(buildFailedLogMessage(name, startTime), normalizedError);
          notifyLoggedError(
            context,
            name,
            maskedArgs,
            normalizedError,
            duration,
            options.system ?? Logger,
          );
          throw error;
        }
      },
    [context, logger, options.system],
  );

  return { logger, traceState, run };
}
