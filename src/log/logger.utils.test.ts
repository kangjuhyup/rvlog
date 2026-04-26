import { describe, expect, it } from 'vitest';
import { LogLevel } from './log-level';
import { defaultTimestamp, resolveFormatter } from './logger.utils';

describe('logger utils', () => {
  it('builds the default timestamp format - 기본 타임스탬프 형식을 만든다', () => {
    expect(defaultTimestamp()).toMatch(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('prefers custom formatter, then pretty, then default - formatter 우선순위를 지킨다', () => {
    const custom = (record: { level: LogLevel; message: string }) => `${record.level}:${record.message}`;

    expect(resolveFormatter({ formatter: custom })).toBe(custom);
    expect(resolveFormatter({ pretty: true })({ level: LogLevel.INFO, message: 'm', context: 'c', args: [], timestamp: 't' })).toContain('[INF]');
    expect(
      resolveFormatter({ pretty: { showTimestamp: false, separator: '->' } })({
        level: LogLevel.INFO,
        message: 'm',
        context: 'c',
        args: [],
        timestamp: 't',
      }),
    ).toBe('[INF] c -> m');
    expect(resolveFormatter({})({ level: LogLevel.INFO, message: 'm', context: 'c', args: [], timestamp: 't' })).toBe('t [c] INFO m');
  });
});
