import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from './log-level';
import { createLoggerSystem, Logger, LoggerSystem } from './logger';
import { NotificationManager } from '../notification/notification-manager';
import { FileTransport } from '../transports/file-transport';

describe('Logger', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('respects the configured minimum level - 설정한 최소 로그 레벨보다 낮으면 출력하지 않는다', () => {
    // Given: INFO 이상만 출력하도록 로거가 설정되어 있다.
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({ minLevel: LogLevel.INFO });

    // When: DEBUG와 INFO 로그를 각각 출력한다.
    const logger = new Logger('UserService');
    logger.debug('hidden');
    logger.info('shown');

    // Then: DEBUG는 무시되고 INFO만 출력된다.
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the pretty formatter when pretty is enabled - pretty 옵션이 켜지면 보기 좋은 포맷을 사용한다', () => {
    // Given: pretty 포맷 옵션이 활성화되어 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({ pretty: true });

    // When: INFO 로그를 출력한다.
    const logger = new Logger('UserService');
    logger.info('formatted');

    // Then: pretty formatter 형태의 문자열이 콘솔로 전달된다.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0]?.[0];
    expect(typeof output).toBe('string');
    expect(output).toContain('[INF]');
    expect(output).toContain('UserService');
    expect(output).toContain('formatted');
  });

  it('prefers a custom formatter over pretty mode - custom formatter가 있으면 pretty보다 우선한다', () => {
    // Given: pretty 옵션과 custom formatter가 함께 설정되어 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const formatter = vi.fn((record) => `custom:${record.level}:${record.message}`);

    Logger.configure({
      pretty: true,
      formatter,
    });

    // When: 로그를 출력한다.
    new Logger('UserService').info('hello');

    // Then: pretty가 아니라 custom formatter 결과가 사용된다.
    expect(formatter).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('custom:INFO:hello');
  });

  it('includes requestId from the configured context resolver - 컨텍스트 resolver가 주는 requestId를 로그 레코드에 포함한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({
      pretty: true,
      contextResolver: () => ({ requestId: 'req-123' }),
    });

    new Logger('UserService').info('hello');

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[req-123] UserService :: hello'));
  });

  it('truncates long args using serialize options - serialize 옵션으로 긴 인자를 잘라서 기록한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({
      pretty: true,
      serialize: {
        maxStringLength: 5,
        truncateSuffix: '...',
      },
    });

    new Logger('UserService').info('hello', { memo: 'abcdefghijk' });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('hello'),
      expect.objectContaining({ memo: 'abcde...' }),
    );
  });

  it('routes debug logs to console.debug - debug는 console.debug로 전달된다', () => {
    // Given: DEBUG 레벨까지 허용된 로거가 있다.
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    Logger.configure({ minLevel: LogLevel.DEBUG });

    // When: debug 메서드로 로그를 출력한다.
    new Logger('UserService').debug('diagnostic');

    // Then: console.debug가 호출된다.
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  it('noop notify when no notification manager is configured - 알림 매니저가 없으면 notify는 아무 것도 하지 않는다', () => {
    // Given: notification을 설정하지 않은 기본 Logger가 있다.
    Logger.configure({});

    // When / Then: notify를 호출해도 예외 없이 즉시 반환된다.
    expect(() =>
      Logger.notify(LogLevel.ERROR, 'failed', {
        className: 'UserService',
        methodName: 'create',
        args: [],
        timestamp: new Date(),
      }),
    ).not.toThrow();
  });

  it('routes warn and error logs to the matching console methods - warn/error는 각 콘솔 메서드로 분기된다', () => {
    // Given: warn/error 콘솔 메서드를 감시하고 있다.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // When: WARN, ERROR 로그를 출력한다.
    const logger = new Logger('UserService');
    logger.warn('warn-message');
    logger.error('error-message');

    // Then: 각 레벨은 대응하는 콘솔 메서드로 전달된다.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('forwards notifications through the configured manager - 설정된 알림 매니저로 전달한다', async () => {
    // Given: notify 호출을 추적할 수 있는 NotificationManager가 설정되어 있다.
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    Logger.configure({ notification: manager });
    // When: 정적 notify 진입점을 통해 ERROR 알림을 요청한다.
    Logger.notify(LogLevel.ERROR, 'failed', {
      className: 'UserService',
      methodName: 'create',
      args: [],
      error: new Error('boom'),
      duration: '1.00ms',
      timestamp: new Date(),
    });

    await Promise.resolve();

    // Then: 알림 매니저의 notify가 한 번 호출된다.
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('exposes configured notification manager, transports, and context resolver - 설정된 정적 의존성을 조회할 수 있다', () => {
    const manager = new NotificationManager();
    const transport = { write: vi.fn() };
    const resolver = () => ({ requestId: 'req-1' });

    Logger.configure({
      notification: manager,
      transports: [transport],
      contextResolver: resolver,
    });

    expect(Logger.getNotificationManager()).toBe(manager);
    expect(Logger.getTransports()).toEqual([transport]);
    expect(Logger.getOptions()).toEqual(
      expect.objectContaining({
        transports: [transport],
      }),
    );
    expect(Logger.getContextResolver()).toBe(resolver);
  });

  it('allows overriding and clearing the context resolver - context resolver를 교체하고 비울 수 있다', () => {
    const first = () => ({ requestId: 'req-1' });
    const second = () => ({ requestId: 'req-2' });

    Logger.setContextResolver(first);
    expect(Logger.getContextResolver()).toBe(first);

    Logger.setContextResolver(second);
    expect(Logger.getContextResolver()).toBe(second);

    Logger.setContextResolver(null);
    expect(Logger.getContextResolver()).toBeNull();
  });

  it('swallows notification manager failures - 알림 전송 실패가 호출자까지 전파되지 않는다', async () => {
    // Given: notify가 항상 실패하는 NotificationManager가 설정되어 있다.
    const manager = new NotificationManager();
    manager.notify = vi.fn(async () => {
      throw new Error('notification failed');
    });

    Logger.configure({ notification: manager });

    // When: ERROR 알림을 요청한다.
    expect(() => {
      Logger.notify(LogLevel.ERROR, 'failed', {
        className: 'UserService',
        methodName: 'create',
        args: [],
        error: new Error('boom'),
        duration: '1.00ms',
        timestamp: new Date(),
      });
    }).not.toThrow();

    await Promise.resolve();
    // Then: 내부 실패는 삼켜지고 호출자는 예외를 보지 않는다.
  });

  it('writes logs to every configured transport - 설정된 모든 transport에 로그를 전달한다', async () => {
    // Given: 파일 저장 옵션과 write 스파이가 준비되어 있다.
    const writeSpy = vi
      .spyOn(FileTransport.prototype, 'write')
      .mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({
      transports: [
        new FileTransport({ enabled: true, dirPath: 'logs', fileName: 'app.log' }),
      ],
    });

    // When: INFO 로그를 출력한다.
    new Logger('UserService').info('persisted');
    await Promise.resolve();

    // Then: 콘솔 출력과 함께 FileTransport.write가 호출된다.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0]?.[1]).toContain('persisted');
  });

  it('forwards non-error instance logs through the configured manager - 일반 instance 로그도 설정된 알림 매니저로 전달한다', async () => {
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    Logger.configure({ notification: manager });

    new Logger('UserService').info('hello', { id: 1 });
    await Promise.resolve();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      LogLevel.INFO,
      'hello',
      expect.objectContaining({
        className: 'UserService',
        methodName: 'log',
        args: [expect.objectContaining({ id: 1 })],
      }),
    );
  });

  it('does not notify for logs filtered out by minLevel - minLevel에 걸러진 로그는 알림으로도 보내지 않는다', async () => {
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    Logger.configure({
      minLevel: LogLevel.WARN,
      notification: manager,
    });

    new Logger('UserService').info('hidden');
    await Promise.resolve();

    expect(notify).not.toHaveBeenCalled();
  });

  it('does not auto-forward instance error logs through the generic notification path - instance error 로그는 generic notify로 중복 전송하지 않는다', async () => {
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    Logger.configure({ notification: manager });

    new Logger('UserService').error('boom');
    await Promise.resolve();

    expect(notify).not.toHaveBeenCalled();
  });

  it('swallows transport write failures - transport 에러는 호출자까지 전파되지 않는다', () => {
    // Given: write가 항상 실패하는 커스텀 transport가 등록되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const failing = {
      write: vi.fn(() => {
        throw new Error('disk full');
      }),
    };

    Logger.configure({ transports: [failing] });

    // When / Then: 로그를 출력해도 예외가 호출자까지 전파되지 않는다.
    expect(() => new Logger('UserService').info('persisted')).not.toThrow();
    expect(failing.write).toHaveBeenCalledTimes(1);
  });

  it('creates isolated logger systems without mutating global Logger state - 팩토리 기반 시스템은 전역 Logger 상태를 건드리지 않는다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Logger.configure({ minLevel: LogLevel.ERROR });

    const system = new LoggerSystem({ minLevel: LogLevel.INFO });
    const globalLogger = new Logger('GlobalService');
    const scopedLogger = system.createLogger('ScopedService');

    globalLogger.info('hidden');
    scopedLogger.info('shown');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain('ScopedService');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('shown');
  });

  it('exposes an isolated notification pipeline through createLoggerSystem - createLoggerSystem으로 독립 알림 구성을 만들 수 있다', async () => {
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    const system = createLoggerSystem({ notification: manager });
    const logger = system.createLogger('ScopedService');

    logger.info('hello');
    await Promise.resolve();

    expect(notify).toHaveBeenCalledWith(
      LogLevel.INFO,
      'hello',
      expect.objectContaining({
        className: 'ScopedService',
        methodName: 'log',
      }),
    );
    expect(Logger.getNotificationManager()).toBeNull();
  });

  it('supports tagged child loggers for structured metrics-style metadata - 태그/필드를 가진 child logger를 지원한다', async () => {
    const notify = vi.fn(async () => {});
    const manager = new NotificationManager();
    manager.notify = notify;

    Logger.configure({ notification: manager });

    const logger = new Logger('MetricsService')
      .withTags({ feature: 'signup', env: 'test' })
      .withFields({ userCount: 3 });

    logger.info('measured');
    await Promise.resolve();

    expect(notify).toHaveBeenCalledWith(
      LogLevel.INFO,
      'measured',
      expect.objectContaining({
        tags: expect.objectContaining({
          feature: 'signup',
          env: 'test',
        }),
        fields: expect.objectContaining({
          userCount: 3,
        }),
      }),
    );
  });
});
