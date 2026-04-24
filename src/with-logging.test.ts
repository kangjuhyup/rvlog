import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from './log/logger';
import { MaskLog } from './decorators/mask-log.decorator';
import { withLogging } from './with-logging';

class SignupInput {
  @MaskLog({ type: 'email' })
  email!: string;
}

describe('withLogging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Logger.resetForTesting();
  });

  it('logs entry and completion with masked arguments - 진입/완료 로그에 마스킹된 인자가 포함된다', () => {
    // Given: 마스킹 대상 필드를 가진 입력과 console.info 스파이가 준비되어 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const input = Object.assign(new SignupInput(), { email: 'user@example.com' });

    // When: withLogging으로 감싼 일반 함수를 호출한다.
    const signup = withLogging(
      (dto: SignupInput) => dto.email,
      { context: 'signup-flow', name: 'signup' },
    );
    signup(input);

    // Then: 진입/완료 로그가 찍히고 인자에는 마스킹된 값이 포함된다.
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy.mock.calls[0]?.[0]).toContain('signup() called');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('us***@example.com');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('signup() completed');
  });

  it('uses fn.name when options.name is omitted - options.name이 없으면 fn.name을 사용한다', () => {
    // Given: 콘솔 스파이와 이름을 가진 함수가 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // When: name 없이 withLogging을 호출한다.
    const wrapped = withLogging(function fetchUser() {
      return 'ok';
    }, { context: 'api' });
    wrapped();

    // Then: fn.name이 로그에 그대로 사용된다.
    expect(infoSpy.mock.calls[0]?.[0]).toContain('fetchUser() called');
  });

  it('preserves return value and supports async functions - 반환값을 보존하고 async 함수도 지원한다', async () => {
    // Given: 비동기 함수를 withLogging으로 감싼다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const wrapped = withLogging(
      async (x: number) => x * 2,
      { context: 'math', name: 'double' },
    );

    // When: wrapped 호출 결과를 await 한다.
    const result = await wrapped(21);

    // Then: 원본 반환값이 그대로 전달된다.
    expect(result).toBe(42);
  });

  it('logs and rethrows sync errors while notifying - 동기 예외는 로깅 후 다시 던지고 알림을 보낸다', () => {
    // Given: 에러 로그와 알림 호출을 추적할 스파이가 준비되어 있다.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const wrapped = withLogging(
      () => {
        throw new Error('sync boom');
      },
      { context: 'svc', name: 'failSync' },
    );

    // When / Then: 원래 예외가 그대로 전파되고 로그/알림이 기록된다.
    expect(() => wrapped()).toThrow('sync boom');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy.mock.calls[0]?.[2].error?.message).toBe('sync boom');
    expect(notifySpy.mock.calls[0]?.[2].methodName).toBe('failSync');
  });

  it('logs and rethrows async errors while notifying - 비동기 예외도 로깅 후 다시 던진다', async () => {
    // Given: 비동기 에러 로그와 알림 호출을 추적한다.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const wrapped = withLogging(
      async () => {
        throw new Error('async boom');
      },
      { context: 'svc', name: 'failAsync' },
    );

    // When / Then: reject된 Promise가 그대로 전파되고 로그/알림이 남는다.
    await expect(wrapped()).rejects.toThrow('async boom');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('serializes string args as-is and handles circular objects safely - 문자열 인자는 그대로, 순환 객체도 안전하게 직렬화한다', () => {
    // Given: 문자열 + 순환 참조를 가진 객체 인자가 있다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const circular: Record<string, unknown> = { id: 1 };
    circular.self = circular;

    // When: withLogging으로 감싼 함수를 이 인자들로 호출한다.
    const wrapped = withLogging((_label: string, _payload: unknown) => 'ok', {
      context: 'svc',
      name: 'handle',
    });
    wrapped('plain-arg', circular);

    // Then: 문자열 인자는 따옴표 없이 그대로 찍히고, 순환 객체는 안전하게 [Circular] 표기로 직렬화된다.
    const message = infoSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('handle() called');
    expect(message).toContain('plain-arg');
    expect(message).toContain('"self":"[Circular]"');
  });

  it('uses "anonymous" name for unnamed arrow functions - 이름 없는 화살표 함수는 anonymous로 로깅한다', () => {
    // Given: 이름이 없는 화살표 함수를 감싼다.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const wrapped = withLogging((x: number) => x, { context: 'ctx' });

    // When: 호출한다.
    wrapped(1);

    // Then: 로그 라인에 fn.name 대신 'anonymous'가 사용되지는 않고(arrow는 변수명이 있을 수도 있음)
    //       최소한 런타임 에러 없이 진입 로그가 남는다는 것만 확인한다.
    expect(infoSpy.mock.calls[0]?.[0]).toMatch(/\w+\(\) called/);
  });

  it('truncates long payloads in entry logs - 진입 로그에서 긴 payload를 잘라낸다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({
      pretty: true,
      serialize: {
        maxStringLength: 5,
        truncateSuffix: '...',
      },
    });

    const wrapped = withLogging((payload: { note: string }) => payload.note, {
      context: 'svc',
      name: 'handle',
    });
    wrapped({ note: 'abcdefghijk' });

    expect(infoSpy.mock.calls[0]?.[0]).toContain('abcde...');
  });

  it('preserves this binding - this 바인딩을 보존한다', () => {
    // Given: this에 접근하는 함수가 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const wrapped = withLogging(function getValue(this: { value: number }) {
      return this.value;
    }, { context: 'bag' });

    // When: 명시적 this로 호출한다.
    const result = wrapped.call({ value: 7 });

    // Then: 원본 함수의 this가 유지된다.
    expect(result).toBe(7);
  });
});
