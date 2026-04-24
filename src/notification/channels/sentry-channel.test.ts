import { describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../../log/log-level';
import type { LogContext } from '../notification-channel';
import {
  SentryChannel,
  type SentryStructuredLoggerLike,
  type SentryLike,
  type SentryScopeLike,
} from './sentry-channel';

function createSentryStub(): {
  client: SentryLike;
  scope: SentryScopeLike;
  logger: SentryStructuredLoggerLike;
  captureException: ReturnType<typeof vi.fn>;
  captureMessage: ReturnType<typeof vi.fn>;
  logTrace: ReturnType<typeof vi.fn>;
  logDebug: ReturnType<typeof vi.fn>;
  logInfo: ReturnType<typeof vi.fn>;
  logWarn: ReturnType<typeof vi.fn>;
  logError: ReturnType<typeof vi.fn>;
  logFatal: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
  setExtra: ReturnType<typeof vi.fn>;
} {
  const setLevel = vi.fn();
  const setTag = vi.fn();
  const setExtra = vi.fn();
  const scope: SentryScopeLike = { setLevel, setTag, setExtra };
  const captureException = vi.fn(() => 'event-id-exc');
  const captureMessage = vi.fn(() => 'event-id-msg');
  const logTrace = vi.fn();
  const logDebug = vi.fn();
  const logInfo = vi.fn();
  const logWarn = vi.fn();
  const logError = vi.fn();
  const logFatal = vi.fn();
  const logger: SentryStructuredLoggerLike = {
    trace: logTrace,
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError,
    fatal: logFatal,
  };

  const client: SentryLike = {
    captureException,
    captureMessage,
    withScope: (callback) => callback(scope),
    logger,
  };

  return {
    client,
    scope,
    logger,
    captureException,
    captureMessage,
    logTrace,
    logDebug,
    logInfo,
    logWarn,
    logError,
    logFatal,
    setLevel,
    setTag,
    setExtra,
  };
}

const baseContext: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [{ email: 'user@example.com' }],
  duration: '12.34ms',
  timestamp: new Date('2026-04-10T12:00:00.000Z'),
};

describe('SentryChannel', () => {
  it('captures exception and sets scope when error is present - error가 있으면 exception을 캡처하고 scope를 채운다', async () => {
    // Given: Sentry 클라이언트 스텁과 ERROR 컨텍스트(에러 포함)가 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client });
    const error = new Error('boom');

    // When: ERROR 레벨 알림을 전송한다.
    await channel.send(LogLevel.ERROR, 'failed', { ...baseContext, error });

    // Then: captureException이 호출되고 scope에 태그/추가정보가 설정된다.
    expect(stub.captureException).toHaveBeenCalledWith(error);
    expect(stub.captureMessage).not.toHaveBeenCalled();
    expect(stub.setLevel).toHaveBeenCalledWith('error');
    expect(stub.setTag).toHaveBeenCalledWith('className', 'UserService');
    expect(stub.setTag).toHaveBeenCalledWith('methodName', 'create');
    expect(stub.setTag).toHaveBeenCalledWith('duration', '12.34ms');
    expect(stub.setExtra).toHaveBeenCalledWith('args', baseContext.args);
    expect(stub.setExtra).toHaveBeenCalledWith('timestamp', '2026-04-10T12:00:00.000Z');
  });

  it('captures message when no error is provided - error가 없으면 captureMessage로 전달한다', async () => {
    // Given: Sentry 클라이언트 스텁과 에러 없는 ERROR 컨텍스트가 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client });

    // When: ERROR 레벨 알림을 전송한다.
    await channel.send(LogLevel.ERROR, 'failed without error', baseContext);

    // Then: captureMessage가 호출되고 captureException은 호출되지 않는다.
    expect(stub.captureMessage).toHaveBeenCalledWith('failed without error', 'error');
    expect(stub.captureException).not.toHaveBeenCalled();
  });

  it('supports structured log mode - log 모드에서는 Sentry.logger API로 전송한다', async () => {
    const stub = createSentryStub();
    const channel = new SentryChannel({
      client: stub.client,
      minLevel: LogLevel.INFO,
      mode: 'log',
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(stub.logInfo).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        className: 'UserService',
        methodName: 'create',
        args: baseContext.args,
        timestamp: '2026-04-10T12:00:00.000Z',
        duration: '12.34ms',
      }),
    );
    expect(stub.captureMessage).not.toHaveBeenCalled();
    expect(stub.captureException).not.toHaveBeenCalled();
  });

  it('supports structured DEBUG and WARN log routing - DEBUG/WARN도 logger API로 전송한다', async () => {
    const stub = createSentryStub();
    const channel = new SentryChannel({
      client: stub.client,
      minLevel: LogLevel.DEBUG,
      mode: 'log',
    });

    await channel.send(LogLevel.DEBUG, 'debugging', baseContext);
    await channel.send(LogLevel.WARN, 'careful', baseContext);

    expect(stub.logDebug).toHaveBeenCalledWith(
      'debugging',
      expect.objectContaining({ className: 'UserService' }),
    );
    expect(stub.logWarn).toHaveBeenCalledWith(
      'careful',
      expect.objectContaining({ methodName: 'create' }),
    );
  });

  it('supports split event/log routing - event와 log 레벨을 분리해서 보낼 수 있다', async () => {
    const stub = createSentryStub();
    const channel = new SentryChannel({
      client: stub.client,
      minLevel: LogLevel.INFO,
      eventLevels: [LogLevel.ERROR],
      logLevels: [LogLevel.INFO, LogLevel.WARN],
    });
    const error = new Error('boom');

    await channel.send(LogLevel.INFO, 'hello', baseContext);
    await channel.send(LogLevel.ERROR, 'failed', { ...baseContext, error });

    expect(stub.logInfo).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        className: 'UserService',
        methodName: 'create',
      }),
    );
    expect(stub.captureException).toHaveBeenCalledWith(error);
    expect(stub.captureMessage).not.toHaveBeenCalledWith('hello', 'info');
  });

  it('can send the same level to both event and log paths - 같은 레벨을 event와 log 양쪽으로도 보낼 수 있다', async () => {
    const stub = createSentryStub();
    const channel = new SentryChannel({
      client: stub.client,
      eventLevels: [LogLevel.ERROR],
      logLevels: [LogLevel.ERROR],
    });
    const error = new Error('boom');

    await channel.send(LogLevel.ERROR, 'failed', { ...baseContext, error });

    expect(stub.logError).toHaveBeenCalledTimes(1);
    expect(stub.captureException).toHaveBeenCalledWith(error);
  });

  it('falls back to event mode when structured logger is unavailable - logger API가 없으면 event 모드로 fallback한다', async () => {
    const stub = createSentryStub();
    const clientWithoutLogger: SentryLike = {
      captureException: stub.captureException,
      captureMessage: stub.captureMessage,
      withScope: stub.client.withScope,
    };
    const channel = new SentryChannel({
      client: clientWithoutLogger,
      minLevel: LogLevel.INFO,
      mode: 'log',
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(stub.captureMessage).toHaveBeenCalledWith('hello', 'info');
  });

  it('falls back to event delivery for logLevels when logger API is unavailable - logLevels만 설정돼도 logger API가 없으면 event로 fallback한다', async () => {
    const stub = createSentryStub();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clientWithoutLogger: SentryLike = {
      captureException: stub.captureException,
      captureMessage: stub.captureMessage,
      withScope: stub.client.withScope,
    };
    const channel = new SentryChannel({
      client: clientWithoutLogger,
      minLevel: LogLevel.INFO,
      logLevels: [LogLevel.INFO],
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(stub.captureMessage).toHaveBeenCalledWith('hello', 'info');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('can disable fallback when logger API is unavailable - logger API 부재 시 fallback을 끌 수 있다', async () => {
    const stub = createSentryStub();
    const clientWithoutLogger: SentryLike = {
      captureException: stub.captureException,
      captureMessage: stub.captureMessage,
      withScope: stub.client.withScope,
    };
    const channel = new SentryChannel({
      client: clientWithoutLogger,
      minLevel: LogLevel.INFO,
      logLevels: [LogLevel.INFO],
      fallbackLogsToEvents: false,
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(stub.captureMessage).not.toHaveBeenCalled();
  });

  it('skips events below minLevel - minLevel 미만 레벨은 Sentry로 보내지 않는다', async () => {
    // Given: 기본 minLevel(ERROR)로 동작하는 채널이 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client });

    // When: WARN 레벨 알림을 전송한다.
    await channel.send(LogLevel.WARN, 'ignored', baseContext);

    // Then: withScope나 capture 메서드는 호출되지 않는다.
    expect(stub.captureException).not.toHaveBeenCalled();
    expect(stub.captureMessage).not.toHaveBeenCalled();
    expect(stub.setLevel).not.toHaveBeenCalled();
  });

  it('respects a custom minLevel - 커스텀 minLevel을 사용하면 하위 레벨도 전송한다', async () => {
    // Given: minLevel을 INFO로 낮춘 SentryChannel이 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client, minLevel: LogLevel.INFO });

    // When: INFO 레벨 알림을 전송한다.
    await channel.send(LogLevel.INFO, 'hello', baseContext);

    // Then: Sentry 레벨이 'info'로 매핑되어 captureMessage가 호출된다.
    expect(stub.setLevel).toHaveBeenCalledWith('info');
    expect(stub.captureMessage).toHaveBeenCalledWith('hello', 'info');
  });

  it.each([
    [LogLevel.DEBUG, 'debug'],
    [LogLevel.INFO, 'info'],
    [LogLevel.WARN, 'warning'],
    [LogLevel.ERROR, 'error'],
  ] as const)('maps rvlog level %s to Sentry severity %s - 레벨별 Sentry severity 매핑', async (level, expected) => {
    // Given: 모든 레벨을 통과시키는 SentryChannel이 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client, minLevel: LogLevel.DEBUG });

    // When: 해당 레벨로 send 한다.
    await channel.send(level, 'm', baseContext);

    // Then: scope.setLevel이 대응하는 Sentry severity 문자열로 호출된다.
    expect(stub.setLevel).toHaveBeenCalledWith(expected);
  });

  it('omits duration tag when context.duration is undefined - duration이 없으면 관련 태그를 설정하지 않는다', async () => {
    // Given: duration이 없는 컨텍스트가 있다.
    const stub = createSentryStub();
    const channel = new SentryChannel({ client: stub.client });
    const { duration: _duration, ...noDuration } = baseContext;

    // When: ERROR 알림을 전송한다.
    await channel.send(LogLevel.ERROR, 'failed', noDuration as typeof baseContext);

    // Then: duration 태그는 설정되지 않는다.
    const durationTag = stub.setTag.mock.calls.find((call) => call[0] === 'duration');
    expect(durationTag).toBeUndefined();
  });

  it('includes error details in structured log mode - log 모드에서는 에러 상세도 attributes에 포함한다', async () => {
    const stub = createSentryStub();
    const channel = new SentryChannel({
      client: stub.client,
      mode: 'log',
    });
    const error = new Error('boom');

    await channel.send(LogLevel.ERROR, 'failed', { ...baseContext, error });

    expect(stub.logError).toHaveBeenCalledWith(
      'failed',
      expect.objectContaining({
        errorName: 'Error',
        errorMessage: 'boom',
      }),
    );
    expect(stub.captureException).not.toHaveBeenCalled();
  });

  it('prints diagnostic logs when debug is enabled - debug 옵션이 켜지면 분기 정보를 콘솔에 출력한다', async () => {
    const stub = createSentryStub();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const channel = new SentryChannel({
      client: stub.client,
      minLevel: LogLevel.INFO,
      mode: 'log',
      debug: true,
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(infoSpy).toHaveBeenCalledWith(
      '[rvlog:sentry] routing decision',
      expect.objectContaining({
        level: LogLevel.INFO,
        shouldSendLog: true,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[rvlog:sentry] sent via Sentry.logger',
      expect.objectContaining({
        message: 'hello',
      }),
    );
  });

  it('prints plain diagnostic text when debug metadata is absent - meta가 없을 때는 문자열만 출력한다', async () => {
    const stub = createSentryStub();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const channel = new SentryChannel({
      client: stub.client,
      minLevel: LogLevel.INFO,
      debug: true,
      logLevels: [],
      eventLevels: [],
    });

    await channel.send(LogLevel.INFO, 'hello', baseContext);

    expect(infoSpy).toHaveBeenCalledWith(
      '[rvlog:sentry] skipped because no event/log route matched',
      expect.objectContaining({
        level: LogLevel.INFO,
        message: 'hello',
        className: 'UserService',
        methodName: 'create',
      }),
    );
  });
});
