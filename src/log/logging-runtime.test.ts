import { describe, expect, it, vi, afterEach } from 'vitest';
import { Logger } from './logger';
import { LogLevel } from './log-level';
import { MaskLog } from '../decorators/mask-log.decorator';
import {
  buildCalledLogMessage,
  buildCompletedLogMessage,
  buildFailedLogMessage,
  buildLogDuration,
  logAtLevel,
  maskLoggingValue,
  notifyLoggedError,
  stringifyLoggingValue,
} from './logging-runtime';

class SignupInput {
  @MaskLog({ type: 'email' })
  email!: string;
}

describe('logging-runtime', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('builds called/completed/failed messages consistently - 로그 메시지 포맷을 일관되게 만든다', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(112.34)
      .mockReturnValueOnce(120.5)
      .mockReturnValueOnce(120.5);

    expect(buildCalledLogMessage('signup', [])).toBe('signup() called');
    expect(buildCalledLogMessage('signup', ['plain'])).toContain('signup() called plain');
    expect(buildCompletedLogMessage('signup', 100)).toBe('signup() completed (12.34ms)');
    expect(buildFailedLogMessage('signup', 100)).toBe('signup() failed (20.50ms)');
    expect(buildLogDuration(100)).toBe('20.50ms');
  });

  it('masks and stringifies logging values safely - 값을 마스킹하고 안전하게 문자열화한다', () => {
    const input = Object.assign(new SignupInput(), { email: 'user@example.com' });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(maskLoggingValue(input)).toEqual(expect.objectContaining({ email: 'us***@example.com' }));
    expect(stringifyLoggingValue(input)).toContain('us***@example.com');
    expect(stringifyLoggingValue('plain')).toBe('plain');
    expect(stringifyLoggingValue(circular)).toBe('[object Object]');
  });

  it('logs at the requested level and notifies errors in a shared format - 공통 레벨 로깅과 에러 notify 포맷을 사용한다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});
    const logger = new Logger('UserService');
    const error = new Error('boom');

    logAtLevel(logger, LogLevel.DEBUG, 'debug-message');
    notifyLoggedError('UserService', 'create', [{ id: 1 }], error, '1.00ms');

    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('debug-message'));
    expect(notifySpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      'create() failed (1.00ms) Error: boom',
      expect.objectContaining({
        className: 'UserService',
        methodName: 'create',
        args: [{ id: 1 }],
        error,
        duration: '1.00ms',
      }),
    );
  });
});
