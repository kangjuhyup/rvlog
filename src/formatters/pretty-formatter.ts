import type { LogFormatter } from './log-formatter';
import type { LogLevel } from '../log/log-level';

const LEVEL_LABELS = {
  DEBUG: '[DBG]',
  INFO: '[INF]',
  WARN: '[WRN]',
  ERROR: '[ERR]',
} as const;

export type PrettyLogColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

const ANSI_RESET = '\u001B[0m';
const ANSI_COLORS: Record<PrettyLogColor, string> = {
  black: '\u001B[30m',
  red: '\u001B[31m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  magenta: '\u001B[35m',
  cyan: '\u001B[36m',
  white: '\u001B[37m',
  gray: '\u001B[90m',
  grey: '\u001B[90m',
  brightRed: '\u001B[91m',
  brightGreen: '\u001B[92m',
  brightYellow: '\u001B[93m',
  brightBlue: '\u001B[94m',
  brightMagenta: '\u001B[95m',
  brightCyan: '\u001B[96m',
  brightWhite: '\u001B[97m',
};
const DEFAULT_LEVEL_COLORS: Record<LogLevel, PrettyLogColor> = {
  DEBUG: 'gray',
  INFO: 'cyan',
  WARN: 'yellow',
  ERROR: 'red',
};

export interface PrettyLogFormatterOptions {
  /** Separator between the context name and message. Defaults to `::`. */
  separator?: string;
  /** Override one or more level labels. */
  levelLabels?: Partial<Record<LogLevel, string>>;
  /** Enables ANSI colors for the level label. Defaults to `false`, unless `levelColors` is provided. */
  colorize?: boolean;
  /** Override one or more ANSI level label colors. */
  levelColors?: Partial<Record<LogLevel, PrettyLogColor>>;
  /** Whether to include the level label. Defaults to `true`. */
  showLevel?: boolean;
  /** Whether to include the timestamp. Defaults to `true`. */
  showTimestamp?: boolean;
  /** Whether to include the request id when present. Defaults to `true`. */
  showRequestId?: boolean;
  /** Whether to include the logger context. Defaults to `true`. */
  showContext?: boolean;
}

export function createPrettyLogFormatter(options: PrettyLogFormatterOptions = {}): LogFormatter {
  const levelLabels = { ...LEVEL_LABELS, ...options.levelLabels };
  const levelColors = { ...DEFAULT_LEVEL_COLORS, ...options.levelColors };
  const separator = options.separator ?? '::';
  const shouldColorize = options.colorize ?? options.levelColors !== undefined;

  return (record) => {
    const levelLabel = levelLabels[record.level];
    const coloredLevelLabel = shouldColorize
      ? `${ANSI_COLORS[levelColors[record.level]]}${levelLabel}${ANSI_RESET}`
      : levelLabel;
    const prefixParts = [
      options.showLevel === false ? undefined : coloredLevelLabel,
      options.showTimestamp === false ? undefined : record.timestamp,
      options.showRequestId === false || !record.requestId ? undefined : `[${record.requestId}]`,
    ].filter(Boolean);
    const message = options.showContext === false
      ? record.message
      : `${record.context} ${separator} ${record.message}`;

    return [...prefixParts, message].join(' ');
  };
}

export const prettyLogFormatter: LogFormatter = createPrettyLogFormatter();
