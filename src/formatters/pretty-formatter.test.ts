import { describe, expect, it } from 'vitest';
import { LogLevel } from '../log/log-level';
import { prettyLogFormatter } from './pretty-formatter';

describe('prettyLogFormatter', () => {
  it('renders a compact pretty output for each level - pretty 포맷은 축약된 레벨 라벨과 구분자를 사용한다', () => {
    // Given / When: ERROR 레코드를 pretty formatter에 전달한다.
    // Then: 축약 레벨 라벨과 "::" 구분자가 포함된 문자열을 반환한다.
    expect(
      prettyLogFormatter({
        timestamp: '2026:04:10 12:34:56',
        level: LogLevel.ERROR,
        context: 'UserService',
        message: 'create() failed',
        args: [],
      }),
    ).toBe('[ERR] 2026:04:10 12:34:56 UserService :: create() failed');
  });

  it('renders requestId before context when present - requestId가 있으면 context 앞에 포함한다', () => {
    expect(
      prettyLogFormatter({
        timestamp: '2026:04:10 12:34:56',
        level: LogLevel.INFO,
        context: 'HTTP',
        message: 'POST /users called',
        args: [],
        requestId: 'req-123',
      }),
    ).toBe('[INF] 2026:04:10 12:34:56 [req-123] HTTP :: POST /users called');
  });
});
