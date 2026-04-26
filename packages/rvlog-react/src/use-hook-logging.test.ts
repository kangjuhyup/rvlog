import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Logger, LogLevel, MaskLog } from '@kangjuhyup/rvlog';
import { useHookLogging } from './use-hook-logging';

function spyContaining(spy: ReturnType<typeof vi.spyOn>, text: string): boolean {
  return spy.mock.calls.some((args) =>
    args.some((arg) => typeof arg === 'string' && arg.includes(text)),
  );
}

describe('useHookLogging', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('mount 시 info 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    renderHook(() => useHookLogging('TestHook'));

    expect(spyContaining(infoSpy, 'hook mounted')).toBe(true);
  });

  it('unmount 시 info 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { unmount } = renderHook(() => useHookLogging('TestHook'));
    infoSpy.mockClear();

    unmount();

    expect(spyContaining(infoSpy, 'hook unmounted')).toBe(true);
  });

  it('traceState는 상태 변경을 debug 로그로 남긴다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    act(() => {
      result.current.traceState('count', 42);
    });

    expect(spyContaining(debugSpy, 'state count -> 42')).toBe(true);
  });

  it('traceState는 문자열 값을 따옴표 없이 기록한다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    act(() => {
      result.current.traceState('status', 'idle');
    });

    expect(spyContaining(debugSpy, 'state status -> idle')).toBe(true);
  });

  it('traceState는 순환 객체도 안전하게 문자열화한다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    act(() => {
      result.current.traceState('circular', circular);
    });

    expect(spyContaining(debugSpy, 'state circular -> [object Object]')).toBe(true);
  });

  it('run은 동기 함수를 감싸서 시작/완료 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => string;
    act(() => {
      wrapped = result.current.run('doSomething', () => 'done');
    });

    infoSpy.mockClear();
    const returnValue = wrapped!();

    expect(returnValue).toBe('done');
    expect(spyContaining(infoSpy, 'doSomething() started')).toBe(true);
    expect(spyContaining(infoSpy, 'doSomething() completed')).toBe(true);
  });

  it('run은 비동기 성공도 완료 로그와 함께 반환한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => Promise<string>;
    act(() => {
      wrapped = result.current.run('loadAsync', async () => 'done');
    });

    infoSpy.mockClear();
    await expect(wrapped!()).resolves.toBe('done');

    expect(spyContaining(infoSpy, 'loadAsync() started')).toBe(true);
    expect(spyContaining(infoSpy, 'loadAsync() completed')).toBe(true);
  });

  it('run은 비동기 함수의 에러를 error 로그로 남기고 다시 throw한다', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => Promise<void>;
    act(() => {
      wrapped = result.current.run('failAsync', async () => {
        throw new Error('async boom');
      });
    });

    await expect(wrapped!()).rejects.toThrow('async boom');

    expect(spyContaining(errorSpy, 'failAsync() failed')).toBe(true);
  });

  it('run은 동기 함수의 에러를 error 로그로 남기고 다시 throw한다', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => never;
    act(() => {
      wrapped = result.current.run('failSync', () => {
        throw new Error('sync boom');
      });
    });

    expect(() => wrapped!()).toThrow('sync boom');

    expect(spyContaining(errorSpy, 'failSync() failed')).toBe(true);
  });

  it('run은 @MaskLog가 붙은 객체 인자를 마스킹해서 기록한다', () => {
    class SignupInput {
      email!: string;

      password!: string;
    }

    MaskLog({ type: 'email' })(SignupInput.prototype, 'email');
    MaskLog({ type: 'full' })(SignupInput.prototype, 'password');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: (input: SignupInput) => void;
    act(() => {
      wrapped = result.current.run('signup', (_input: SignupInput) => {});
    });

    infoSpy.mockClear();

    const input = Object.assign(new SignupInput(), {
      email: 'user@example.com',
      password: 'super-secret',
    });
    wrapped!(input);

    const startedLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(startedLog).toContain('us***@example.com');
    expect(startedLog).toContain('******');
    expect(startedLog).not.toContain('user@example.com');
    expect(startedLog).not.toContain('super-secret');
  });

  it('run은 WARN 레벨로도 시작/완료 로그를 남긴다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => string;
    act(() => {
      wrapped = result.current.run('submit', () => 'ok', LogLevel.WARN);
    });

    warnSpy.mockClear();
    const value = wrapped!();

    expect(value).toBe('ok');
    expect(spyContaining(warnSpy, 'submit() started')).toBe(true);
    expect(spyContaining(warnSpy, 'submit() completed')).toBe(true);
  });

  it('run은 DEBUG 레벨로도 시작/완료 로그를 남긴다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => string;
    act(() => {
      wrapped = result.current.run('inspect', () => 'ok', LogLevel.DEBUG);
    });

    debugSpy.mockClear();
    const value = wrapped!();

    expect(value).toBe('ok');
    expect(spyContaining(debugSpy, 'inspect() started')).toBe(true);
    expect(spyContaining(debugSpy, 'inspect() completed')).toBe(true);
  });

  it('run은 ERROR 레벨로도 시작/완료 로그를 남긴다', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => string;
    act(() => {
      wrapped = result.current.run('submitCritical', () => 'ok', LogLevel.ERROR);
    });

    errorSpy.mockClear();
    const value = wrapped!();

    expect(value).toBe('ok');
    expect(spyContaining(errorSpy, 'submitCritical() started')).toBe(true);
    expect(spyContaining(errorSpy, 'submitCritical() completed')).toBe(true);
  });

  it('run은 Error가 아닌 throw 값도 Error로 정규화해서 notify한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook'));

    let wrapped: () => never;
    act(() => {
      wrapped = result.current.run('failWithString', () => {
        throw 'plain failure';
      });
    });

    expect(() => wrapped!()).toThrow('plain failure');
    expect(notifySpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining('failWithString() failed'),
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'plain failure',
        }),
      }),
    );
  });

  it('run은 주입된 LoggerSystem으로 알림을 보낸다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const system = {
      createLogger: (_context: string) => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      notify: vi.fn(),
    };
    const systemNotifySpy = vi.spyOn(system, 'notify');
    const globalNotifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});

    const { result } = renderHook(() => useHookLogging('TestHook', { system: system as never }));

    let wrapped: () => never;
    act(() => {
      wrapped = result.current.run('failWithSystem', () => {
        throw new Error('system failure');
      });
    });

    expect(() => wrapped!()).toThrow('system failure');
    expect(globalNotifySpy).not.toHaveBeenCalled();
    expect(systemNotifySpy).toHaveBeenCalledTimes(1);
  });
});
