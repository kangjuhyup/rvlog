import { useRef } from 'react';
import { Logger } from 'rvlog';

/**
 * React 컴포넌트/훅 범위에서 재사용할 Logger 인스턴스를 반환한다.
 */
export function useLogger(context: string): Logger {
  const ref = useRef<Logger | null>(null);

  if (ref.current === null) {
    ref.current = new Logger(context);
  }

  return ref.current;
}
