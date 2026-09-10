import type { LogFormatter } from './log-formatter';

export const defaultLogFormatter: LogFormatter = (record) => {
  const requestIdPrefix = record.requestId ? `[${record.requestId}] ` : '';
  const traceIdPrefix = record.traceId ? `[trace:${record.traceId}] ` : '';
  return `${record.timestamp} ${requestIdPrefix}${traceIdPrefix}[${record.context}] ${record.level} ${record.message}`;
};
