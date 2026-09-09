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
const installedResolvers = new WeakMap<object, LoggerContextResolver>();

function mergeContexts(
  base: LoggerContextValue | undefined,
  override: LoggerContextValue | undefined,
): LoggerContextValue {
  const tags = base?.tags || override?.tags
    ? { ...(base?.tags ?? {}), ...(override?.tags ?? {}) }
    : undefined;
  const fields = base?.fields || override?.fields
    ? { ...(base?.fields ?? {}), ...(override?.fields ?? {}) }
    : undefined;

  return {
    ...base,
    ...override,
    tags,
    fields,
  };
}

/** Returns the active HTTP or worker logging context. */
export function getRvlogContext(): LoggerContextValue | undefined {
  return requestContextStorage.getStore();
}

export function getRvlogRequestContext(): LoggerContextValue | undefined {
  return getRvlogContext();
}

/** Runs HTTP or worker work with automatically propagated logging context. */
export function runWithRvlogContext<T>(
  context: LoggerContextValue,
  callback: () => T,
): T {
  return requestContextStorage.run({ ...context }, callback);
}

export function runWithRvlogRequestContext<T>(
  context: LoggerContextValue,
  callback: () => T,
): T {
  return runWithRvlogContext(context, callback);
}

/** Adds tenant, principal, correlation, tag, or field data to the active context. */
export function enrichRvlogContext(context: LoggerContextValue): boolean {
  const current = requestContextStorage.getStore();

  if (!current) {
    return false;
  }

  const tags = context.tags
    ? { ...(current.tags ?? {}), ...context.tags }
    : current.tags;
  const fields = context.fields
    ? { ...(current.fields ?? {}), ...context.fields }
    : current.fields;

  Object.assign(current, context, { tags, fields });
  return true;
}

export function installRvlogRequestContextResolver(
  runtime: RvlogRequestContextRuntime,
): void {
  const runtimeKey = runtime as object;
  const installedResolver = installedResolvers.get(runtimeKey);

  if (installedResolver && runtime.getContextResolver() === installedResolver) {
    return;
  }

  const previousResolver: LoggerContextResolver | null = runtime.getContextResolver();
  const resolver = () => mergeContexts(previousResolver?.(), getRvlogContext());

  installedResolvers.set(runtimeKey, resolver);
  runtime.setContextResolver(resolver);
}
