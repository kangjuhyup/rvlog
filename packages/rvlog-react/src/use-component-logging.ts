import { useCallback, useEffect, useRef } from 'react';
import { LogLevel, Logger } from 'rvlog';
import { useLogger } from './use-logger';

export interface UseComponentLoggingResult {
  logger: Logger;
  renderCount: number;
  trackEvent: <TArgs extends unknown[], TResult>(
    name: string,
    handler: (...args: TArgs) => TResult,
    level?: LogLevel,
  ) => (...args: TArgs) => TResult;
}

/**
 * 컴포넌트 단위 로깅을 위한 React 전용 헬퍼.
 * - mount / unmount 자동 기록
 * - re-render 횟수 추적
 * - trackEvent로 이벤트 핸들러를 감싸 호출 시 자동 로깅
 */
export function useComponentLogging(component: string): UseComponentLoggingResult {
  const logger = useLogger(component);
  const renderCountRef = useRef(0);

  renderCountRef.current += 1;

  useEffect(() => {
    logger.info('component mounted');

    return () => {
      logger.info(`component unmounted (rendered ${renderCountRef.current} times)`);
    };
  }, [logger]);

  useEffect(() => {
    if (renderCountRef.current > 1) {
      logger.debug(`re-render #${renderCountRef.current}`);
    }
  });

  const trackEvent = useCallback(
    <TArgs extends unknown[], TResult>(
      name: string,
      handler: (...args: TArgs) => TResult,
      level: LogLevel = LogLevel.DEBUG,
    ) =>
      (...args: TArgs): TResult => {
        switch (level) {
          case LogLevel.DEBUG:
            logger.debug(`event:${name}`);
            break;
          case LogLevel.INFO:
            logger.info(`event:${name}`);
            break;
          case LogLevel.WARN:
            logger.warn(`event:${name}`);
            break;
          case LogLevel.ERROR:
            logger.error(`event:${name}`);
            break;
        }
        return handler(...args);
      },
    [logger],
  );

  return { logger, renderCount: renderCountRef.current, trackEvent };
}
