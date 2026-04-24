import type { LogFormatter } from './log-formatter';

const LEVEL_LABELS = {
  DEBUG: '[DBG]',
  INFO: '[INF]',
  WARN: '[WRN]',
  ERROR: '[ERR]',
} as const;

export const prettyLogFormatter: LogFormatter = (record) => {
  const requestIdPrefix = record.requestId ? `[${record.requestId}] ` : '';
  return `${LEVEL_LABELS[record.level]} ${record.timestamp} ${requestIdPrefix}${record.context} :: ${record.message}`;
};
