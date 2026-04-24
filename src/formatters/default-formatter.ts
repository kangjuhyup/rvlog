import type { LogFormatter } from './log-formatter';

export const defaultLogFormatter: LogFormatter = (record) => {
  const requestIdPrefix = record.requestId ? `[${record.requestId}] ` : '';
  return `${record.timestamp} ${requestIdPrefix}[${record.context}] ${record.level} ${record.message}`;
};
