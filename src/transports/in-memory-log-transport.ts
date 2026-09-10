import type { LogRecord, LogTransport } from '../log/logger';

/** In-memory transport for consumer tests without global Logger spies. */
export class InMemoryLogTransport implements LogTransport {
  readonly records: LogRecord[] = [];

  write(record: LogRecord): void {
    this.records.push(record);
  }

  clear(): void {
    this.records.length = 0;
  }
}
