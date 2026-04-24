import { type ReactNode, createContext, createElement, useContext } from 'react';
import { type UseComponentLoggingResult, useComponentLogging } from './use-component-logging';

const LoggingContext = createContext<UseComponentLoggingResult | null>(null);

/**
 * Logging 하위 컴포넌트에서 trackEvent, logger 등을 꺼내 쓸 수 있는 훅.
 *
 * @example
 * function ChildButton() {
 *   const { trackEvent } = useLoggingContext();
 *   return <button onClick={trackEvent('click:save', onSave)}>save</button>;
 * }
 */
export function useLoggingContext(): UseComponentLoggingResult {
  const ctx = useContext(LoggingContext);

  if (ctx === null) {
    throw new Error('useLoggingContext must be used within a <Logging> component');
  }

  return ctx;
}

export interface LoggingProps {
  component: string;
  children: ReactNode;
}

/**
 * 컴포넌트 래퍼로 mount/unmount, re-render 횟수를 자동 로깅한다.
 * 하위 컴포넌트에서 useLoggingContext()로 trackEvent, logger에 접근할 수 있다.
 *
 * @example
 * <Logging component="App">
 *   <ChildA />
 * </Logging>
 *
 * // 하위 어디서든
 * function ChildA() {
 *   const { trackEvent } = useLoggingContext();
 *   return <button onClick={trackEvent('click:save', handler)}>save</button>;
 * }
 */
export function Logging({ component, children }: LoggingProps): ReactNode {
  const result = useComponentLogging(component);

  return createElement(LoggingContext.Provider, { value: result }, children);
}
