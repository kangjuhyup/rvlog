import type { LogRecord } from '../log/logger';

export type { LogRecord };
export type LogFormatter = (record: LogRecord) => string;
