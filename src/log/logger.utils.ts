import { defaultLogFormatter } from '../formatters/default-formatter';
import { prettyLogFormatter } from '../formatters/pretty-formatter';
import type { LogFormatter, LoggerOptions } from './logger';

export function defaultTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${now.getFullYear()}:${pad(now.getMonth() + 1)}:${pad(now.getDate())}`,
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  ].join(' ');
}

export function resolveFormatter(options: LoggerOptions): LogFormatter {
  if (options.formatter) {
    return options.formatter;
  }

  if (options.pretty) {
    return prettyLogFormatter;
  }

  return defaultLogFormatter;
}
