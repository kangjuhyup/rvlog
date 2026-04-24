import { describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../log/logger';
import { buildDateToken, parseRecordDate, resolveRotatedFilePath } from './file-transport.utils';

const record: LogRecord = {
  timestamp: '2026:04:24 11:30:00',
  level: 'INFO',
  context: 'App',
  message: 'hello',
  args: [],
};

describe('file transport utils', () => {
  it('formats date tokens and parses record timestamps - 날짜 토큰과 record 타임스탬프를 처리한다', () => {
    const date = parseRecordDate(record);

    expect(buildDateToken(date)).toBe('2026-04-24');
    expect(date.getHours()).toBe(11);
  });

  it('falls back to now for malformed timestamps - 잘못된 타임스탬프면 현재 시각으로 대체한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));

    const parsed = parseRecordDate({ ...record, timestamp: 'bad-value' });

    expect(parsed.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    vi.useRealTimers();
  });

  it('resolves daily/hourly/plain rotated file paths - rotate 타입별 파일 경로를 만든다', () => {
    expect(resolveRotatedFilePath(record, 'logs', 'app.log', 'daily')).toBe('logs\\app-2026-04-24.log');
    expect(resolveRotatedFilePath(record, 'logs', 'app.log', 'hourly')).toBe('logs\\app-2026-04-24-11.log');
    expect(resolveRotatedFilePath(record, 'logs', 'app.log')).toBe('logs\\app.log');
  });
});
