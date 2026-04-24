import { Logger } from './log/logger';
import {
  buildCalledLogMessage,
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  maskLoggingValue,
  notifyLoggedError,
} from './log/logging-runtime';

export interface WithLoggingOptions {
  /** Logger context shown in emitted log lines. */
  context: string;
  /** Optional function name override. Falls back to `fn.name` or `anonymous`. */
  name?: string;
}

/**
 * 함수/훅 기반 코드에서도 `@Logging` 데코레이터와 동일한 자동 로깅을 얻기 위한 HOF.
 *
 * - 진입: `INFO name() called <serialized args>`
 * - 완료: `INFO name() completed (Xms)`
 * - 예외: `ERROR name() failed (Xms)` + NotificationManager 전달
 * - 객체 인자는 `@MaskLog` 규칙에 따라 자동 마스킹
 * - 동기/비동기 함수 모두 지원 (Promise 반환 시 체이닝)
 *
 * @example
 * const signup = withLogging(
 *   async (input: SignupInput) => { ... },
 *   { context: 'signup' },
 * );
 */
export function withLogging<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: WithLoggingOptions,
): (...args: TArgs) => TResult {
  const { context } = options;
  const name = options.name ?? (fn.name || 'anonymous');

  return function wrapped(this: unknown, ...args: TArgs): TResult {
    const logger = new Logger(context);
    const startTime = performance.now();
    const maskedArgs = args.map((arg) => maskLoggingValue(arg));

    logger.info(buildCalledLogMessage(name, maskedArgs));

    try {
      const result = fn.apply(this, args);

      if (result instanceof Promise) {
        return result
          .then((resolved) => {
            logger.info(buildCompletedLogMessage(name, startTime));
            return resolved;
          })
          .catch((error: unknown) => {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            const duration = buildLogDuration(startTime);

            logger.error(buildFailedLogMessage(name, startTime), normalizedError);
            notifyLoggedError(context, name, maskedArgs, normalizedError, duration);
            throw error;
          }) as TResult;
      }

      logger.info(buildCompletedLogMessage(name, startTime));
      return result;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const duration = buildLogDuration(startTime);

      logger.error(buildFailedLogMessage(name, startTime), normalizedError);
      notifyLoggedError(context, name, maskedArgs, normalizedError, duration);
      throw error;
    }
  };
}
