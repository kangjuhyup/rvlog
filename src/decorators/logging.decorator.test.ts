import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logging } from './logging.decorator';
import { NoLog } from './no-log.decorator';
import { MaskLog } from './mask-log.decorator';
import { Logger } from '../log/logger';
import { LogLevel } from '../log/log-level';

class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;
}

class BuyerDto {
  @MaskLog({ type: 'email' })
  email!: string;
}

class CreateOrderDto {
  @MaskLog({ type: 'name' })
  buyerName!: string;

  buyer!: BuyerDto;
}

@Logging
class UserService {
  declare logger: unknown;

  create(dto: CreateUserDto): string {
    return dto.name;
  }

  createOrder(dto: CreateOrderDto): string {
    return dto.buyer.email;
  }

  async findAll(): Promise<string[]> {
    return ['ok'];
  }

  failSync(): never {
    throw new Error('sync boom');
  }

  async failAsync(): Promise<void> {
    throw new Error('async boom');
  }

  @NoLog
  healthCheck(): string {
    return 'ok';
  }
}

@Logging({ level: LogLevel.WARN })
class WarnLoggingService {
  create(): string {
    return 'ok';
  }
}

@Logging({ level: LogLevel.DEBUG })
class DebugLoggingService {
  inspect(): string {
    return 'ok';
  }
}

describe('@Logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Logger.resetForTesting();
  });

  it('logs entry and completion with masked arguments - 진입/완료 로그에 마스킹된 인자가 포함된다', () => {
    // Given: 마스킹 대상 필드를 가진 DTO와 console.info 스파이가 준비되어 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const dto = new CreateUserDto();
    dto.name = '홍길동';

    // When: 데코레이터가 적용된 메서드를 호출한다.
    const service = new UserService();
    service.create(dto);

    // Then: 진입/완료 로그가 찍히고 인자에는 마스킹된 값이 포함된다.
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy.mock.calls[0]?.[0]).toContain('create() called');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('홍*동');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('create() completed');
  });

  it('masks plain object arguments using parameter type metadata - plain object 인자도 파라미터 타입 메타데이터로 마스킹한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const service = new UserService();

    service.create({ name: '홍길동' } as CreateUserDto);

    expect(infoSpy.mock.calls[0]?.[0]).toContain('홍*동');
    expect(infoSpy.mock.calls[0]?.[0]).not.toContain('홍길동');
  });

  it('masks nested plain objects using DTO property metadata - 중첩 plain object도 DTO 프로퍼티 메타데이터로 마스킹한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const service = new UserService();

    service.createOrder({
      buyerName: '강주협',
      buyer: {
        email: 'abc@abc.com',
      },
    } as CreateOrderDto);

    expect(infoSpy.mock.calls[0]?.[0]).toContain('강*협');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('ab***@abc.com');
    expect(infoSpy.mock.calls[0]?.[0]).not.toContain('강주협');
    expect(infoSpy.mock.calls[0]?.[0]).not.toContain('abc@abc.com');
  });

  it('truncates long payloads in entry logs - 진입 로그에서 긴 payload를 잘라낸다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({
      pretty: true,
      serialize: {
        maxStringLength: 4,
        truncateSuffix: '...',
      },
    });
    const service = new UserService();

    service.create({ name: '홍길동길동길동' } as CreateUserDto);

    expect(infoSpy.mock.calls[0]?.[0]).toContain('홍***...');
  });

  it('skips methods decorated with @NoLog - @NoLog가 붙은 메서드는 자동 로그에서 제외된다', () => {
    // Given: 자동 로그를 감시하는 console.info 스파이가 준비되어 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // When: @NoLog 메서드를 호출한다.
    const service = new UserService();
    service.healthCheck();

    // Then: 자동 로그가 남지 않는다.
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('handles async methods - 비동기 메서드도 시작/완료 로그를 남긴다', async () => {
    // Given: 비동기 메서드 로그를 감시할 console.info 스파이가 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // When: async 메서드를 await 하며 호출한다.
    const service = new UserService();
    await service.findAll();

    // Then: 시작과 완료 로그가 모두 기록된다.
    expect(infoSpy).toHaveBeenCalledTimes(2);
  });

  it('supports custom entry and completion log levels - 진입/완료 로그 레벨을 옵션으로 바꿀 수 있다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const service = new WarnLoggingService();
    service.create();

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('create() called');
    expect(warnSpy.mock.calls[1]?.[0]).toContain('create() completed');
  });

  it('supports debug entry and completion logs - DEBUG 레벨로도 진입/완료 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const service = new DebugLoggingService();
    service.inspect();

    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[0]?.[0]).toContain('inspect() called');
    expect(debugSpy.mock.calls[1]?.[0]).toContain('inspect() completed');
  });

  it('injects a logger property on the instance prototype - 인스턴스에서 this.logger를 사용할 수 있다', () => {
    // Given: @Logging 데코레이터가 적용된 클래스 인스턴스가 있다.
    const service = new UserService() as UserService & { logger: unknown };

    // When / Then: 주입된 logger 프로퍼티를 읽으면 Logger 인스턴스를 얻는다.
    expect(service.logger).toBeInstanceOf(Logger);
  });

  it('logs and rethrows synchronous errors while notifying - 동기 예외는 로깅 후 다시 던진다', () => {
    // Given: 에러 로그와 알림 호출을 추적할 스파이가 준비되어 있다.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const service = new UserService();

    // When: 동기적으로 실패하는 메서드를 호출한다.
    expect(() => service.failSync()).toThrow('sync boom');
    // Then: 에러 로그와 알림이 기록되고 원래 예외도 유지된다.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy.mock.calls[0]?.[2].error?.message).toBe('sync boom');
  });

  it('logs and rethrows async errors while notifying - 비동기 예외도 로깅 후 다시 던진다', async () => {
    // Given: 비동기 에러 로그와 알림 호출을 추적한다.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const service = new UserService();

    // When: async 실패 메서드를 호출한다.
    await expect(service.failAsync()).rejects.toThrow('async boom');
    // Then: 에러 로그와 알림이 남고 reject도 유지된다.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });
});
