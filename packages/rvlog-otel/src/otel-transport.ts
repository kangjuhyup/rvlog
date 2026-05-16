import type { Counter, Histogram } from '@opentelemetry/api';
import { LogLevel, type LogRecord, type LogTransport } from '@kangjuhyup/rvlog';

export interface OtelTransportOptions {
  /** Meter name used when acquiring the OTel meter. Defaults to `'rvlog'`. */
  meterName?: string;
}

// Lazy optional acquire — returns null when @opentelemetry/api is not installed.
function tryCreateMeter(meterName: string) {
  try {
    const { metrics } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
    return metrics.getMeter(meterName);
  } catch {
    return null;
  }
}

/**
 * LogTransport that bridges rvlog records to OpenTelemetry metrics.
 * When `@opentelemetry/api` is not installed this transport is a no-op.
 *
 * Metrics emitted:
 * - `rvlog.log.count`          counter — every log entry, labelled by level + context
 * - `rvlog.error.count`        counter — ERROR entries only, labelled by context
 * - `rvlog.method.duration_ms` histogram — when `fields.duration_ms` is present
 */
export class OtelTransport implements LogTransport {
  private readonly logCounter: Counter | null;
  private readonly errorCounter: Counter | null;
  private readonly durationHistogram: Histogram | null;

  constructor(options: OtelTransportOptions = {}) {
    const meter = tryCreateMeter(options.meterName ?? 'rvlog');

    this.logCounter = meter?.createCounter('rvlog.log.count', {
      description: 'Number of log entries emitted by rvlog',
    }) ?? null;
    this.errorCounter = meter?.createCounter('rvlog.error.count', {
      description: 'Number of ERROR log entries emitted by rvlog',
    }) ?? null;
    this.durationHistogram = meter?.createHistogram('rvlog.method.duration_ms', {
      description: 'Method execution duration recorded by @Logging / withLogging',
      unit: 'ms',
    }) ?? null;
  }

  write(record: LogRecord): void {
    if (!this.logCounter) return;

    const baseAttrs: Record<string, string> = {
      level: record.level,
      context: record.context,
    };

    if (record.tags) {
      Object.assign(baseAttrs, record.tags);
    }

    this.logCounter.add(1, baseAttrs);

    if (record.level === LogLevel.ERROR) {
      this.errorCounter?.add(1, { context: record.context });
    }

    const durationMs = record.fields?.['duration_ms'];
    if (typeof durationMs === 'number') {
      this.durationHistogram?.record(durationMs, {
        context: record.context,
        level: record.level,
      });
    }
  }
}
