import { LogLevel } from '@kangjuhyup/rvlog';

export function levelColor(level: LogLevel): number {
  switch (level) {
    case LogLevel.ERROR:
      return 0xff3b30;
    case LogLevel.WARN:
      return 0xffcc00;
    case LogLevel.INFO:
      return 0x007aff;
    case LogLevel.DEBUG:
    default:
      return 0x8e8e93;
  }
}
