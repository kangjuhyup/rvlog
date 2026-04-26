import { describe, expect, it } from 'vitest';
import { LogLevel } from '../../log/log-level';
import type { LogContext } from '../notification-channel';
import {
  buildSentryLogAttributes,
  includesSentryLevel,
  mapSentryLevel,
} from './sentry-channel.utils';

const context: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [{ id: 1 }],
  tags: { feature: 'signup' },
  fields: { userId: 7 },
  error: new Error('boom'),
  duration: '1.23ms',
  timestamp: new Date('2026-04-24T00:00:00.000Z'),
};

describe('sentry channel utils', () => {
  it('maps rvlog levels to sentry levels - rvlog 레벨을 sentry 레벨로 매핑한다', () => {
    expect(mapSentryLevel(LogLevel.DEBUG)).toBe('debug');
    expect(mapSentryLevel(LogLevel.INFO)).toBe('info');
    expect(mapSentryLevel(LogLevel.WARN)).toBe('warning');
    expect(mapSentryLevel(LogLevel.ERROR)).toBe('error');
  });

  it('builds structured log attributes - 구조화 로그 attributes를 만든다', () => {
    expect(buildSentryLogAttributes(context)).toEqual(
      expect.objectContaining({
        className: 'UserService',
        methodName: 'create',
        tags: { feature: 'signup' },
        fields: { userId: 7 },
        errorName: 'Error',
        errorMessage: 'boom',
        timestamp: '2026-04-24T00:00:00.000Z',
      }),
    );
  });

  it('checks included levels safely - 포함된 레벨을 안전하게 검사한다', () => {
    expect(includesSentryLevel([LogLevel.INFO, LogLevel.WARN], LogLevel.INFO)).toBe(true);
    expect(includesSentryLevel([LogLevel.INFO], LogLevel.ERROR)).toBe(false);
    expect(includesSentryLevel(undefined, LogLevel.INFO)).toBe(false);
  });
});
