import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  Logger,
  LoggerContextResolver,
  LoggerContextValue,
  LoggerSystem,
} from '@kangjuhyup/rvlog';

type RvlogRequestContextRuntime = Pick<
  typeof Logger | LoggerSystem,
  'getContextResolver' | 'setContextResolver'
>;

const requestContextStorage = new AsyncLocalStorage<LoggerContextValue>();

export function getRvlogRequestContext(): LoggerContextValue | undefined {
  return requestContextStorage.getStore();
}

export function runWithRvlogRequestContext<T>(
  context: LoggerContextValue,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function installRvlogRequestContextResolver(
  runtime: RvlogRequestContextRuntime,
): void {
  const previousResolver: LoggerContextResolver | null = runtime.getContextResolver();

  runtime.setContextResolver(() => ({
    ...previousResolver?.(),
    ...requestContextStorage.getStore(),
  }));
}
