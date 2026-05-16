import { Logger, type LoggerOptions } from '@kangjuhyup/rvlog';
import { OtelTransport, type OtelTransportOptions } from './otel-transport';

export interface OtelMonitoringOptions extends OtelTransportOptions, Omit<LoggerOptions, 'transports'> {
  /** Additional transports to include alongside OtelTransport. */
  extraTransports?: LoggerOptions['transports'];
}

/**
 * Zero-config entry point for OTel monitoring.
 *
 * Registers an `OtelTransport` on the global `Logger` and optionally applies
 * any additional `LoggerOptions`.  Call this once at application startup,
 * before any other rvlog usage.
 *
 * ```ts
 * import { setupOtelMonitoring } from '@kangjuhyup/rvlog-otel';
 *
 * setupOtelMonitoring({ meterName: 'my-service' });
 * ```
 */
export function setupOtelMonitoring(options: OtelMonitoringOptions = {}): void {
  const { meterName, extraTransports = [], ...loggerOptions } = options;

  const otelTransport = new OtelTransport({ meterName });

  Logger.configure({
    ...loggerOptions,
    transports: [...extraTransports, otelTransport],
  });
}
