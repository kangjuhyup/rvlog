import { describe, expect, it } from 'vitest';
import { LogLevel } from '../log/log-level';
import { defaultLogFormatter } from './default-formatter';

describe('defaultLogFormatter', () => {
  it('renders the standard log line shape - 기본 포맷 문자열 형태를 유지한다', () => {
    // Given / When: 표준 LogRecord를 기본 formatter에 전달한다.
    // Then: "timestamp [context] LEVEL message" 형태를 반환한다.
    expect(
      defaultLogFormatter({
        timestamp: '2026:04:10 12:34:56',
        level: LogLevel.INFO,
        context: 'UserService',
        message: 'findAll() called',
        args: [],
      }),
    ).toBe('2026:04:10 12:34:56 [UserService] INFO findAll() called');
  });

  it('renders requestId before context when present - requestId가 있으면 context 앞에 포함한다', () => {
    expect(
      defaultLogFormatter({
        timestamp: '2026:04:10 12:34:56',
        level: LogLevel.INFO,
        context: 'HTTP',
        message: 'POST /users called',
        args: [],
        requestId: 'req-123',
      }),
    ).toBe('2026:04:10 12:34:56 [req-123] [HTTP] INFO POST /users called');
  });
});
