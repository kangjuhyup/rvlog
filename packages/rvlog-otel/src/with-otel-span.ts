import type { Span } from '@opentelemetry/api';
import { withLogging, type WithLoggingOptions } from '@kangjuhyup/rvlog';

export interface WithOtelSpanOptions extends WithLoggingOptions {
  /** Tracer name used when acquiring the OTel tracer. Defaults to `'rvlog'`. */
  tracerName?: string;
}

// Lazy optional acquire — returns null when @opentelemetry/api is not installed.
function tryStartSpan(tracerName: string, spanName: string): Span | null {
  try {
    const { trace } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
    return trace.getTracer(tracerName).startSpan(spanName);
  } catch {
    return null;
  }
}

function endSpanWithError(span: Span, e: unknown): void {
  try {
    const { SpanStatusCode } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
    span.recordException(e as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    span.end();
  }
}

/**
 * Higher-order function that combines `withLogging` automatic logging with an
 * OpenTelemetry span. When `@opentelemetry/api` is not installed it falls back
 * to plain `withLogging` with no tracing overhead.
 *
 * Span name: `context.fnName`
 * On error: records exception + sets ERROR status before rethrowing.
 */
export function withOtelSpan<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: WithOtelSpanOptions,
): (...args: TArgs) => TResult {
  const { tracerName, ...loggingOptions } = options;
  const resolvedTracerName = tracerName ?? 'rvlog';
  const spanName = `${options.context}.${options.name ?? (fn.name || 'anonymous')}`;
  const loggedFn = withLogging(fn, loggingOptions);

  return function wrapped(this: unknown, ...args: TArgs): TResult {
    const span = tryStartSpan(resolvedTracerName, spanName);

    if (!span) {
      return loggedFn.apply(this, args);
    }

    try {
      const result = loggedFn.apply(this, args);

      if (result instanceof Promise) {
        return (result as Promise<unknown>)
          .then((v) => { span.end(); return v; })
          .catch((e: unknown) => {
            endSpanWithError(span, e);
            throw e;
          }) as TResult;
      }

      span.end();
      return result;
    } catch (e) {
      endSpanWithError(span, e);
      throw e;
    }
  };
}
