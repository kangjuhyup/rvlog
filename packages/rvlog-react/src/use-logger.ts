import { useRef } from "react";
import { Logger, LoggerSystem, ScopedLogger } from "@kangjuhyup/rvlog";

/**
 * React 컴포넌트/훅 범위에서 재사용할 Logger 인스턴스를 반환한다.
 */
export function useLogger(
  context: string,
  system?: LoggerSystem,
): ScopedLogger {
  const ref = useRef<ScopedLogger | null>(null);

  if (ref.current === null) {
    ref.current = system?.createLogger(context) ?? new Logger(context);
  }

  return ref.current;
}
