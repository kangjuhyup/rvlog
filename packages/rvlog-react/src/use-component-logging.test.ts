import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Logger, LogLevel } from '@kangjuhyup/rvlog';
import { useComponentLogging } from './use-component-logging';

function spyContaining(spy: ReturnType<typeof vi.spyOn>, text: string): boolean {
  return spy.mock.calls.some((args) =>
    args.some((arg) => typeof arg === 'string' && arg.includes(text)),
  );
}

describe('useComponentLogging', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('mount 시 component mounted 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    renderHook(() => useComponentLogging('TestComp'));

    expect(spyContaining(infoSpy, 'component mounted')).toBe(true);
  });

  it('unmount 시 렌더 횟수를 포함한 로그를 남긴다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { unmount } = renderHook(() => useComponentLogging('TestComp'));
    infoSpy.mockClear();

    unmount();

    expect(spyContaining(infoSpy, 'component unmounted')).toBe(true);
    expect(spyContaining(infoSpy, 'rendered')).toBe(true);
  });

  it('re-render 시 렌더 카운트가 증가한다', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    const { result, rerender } = renderHook(() => useComponentLogging('TestComp'));

    const firstCount = result.current.renderCount;
    rerender();
    const secondCount = result.current.renderCount;

    expect(secondCount).toBe(firstCount + 1);
  });

  it('re-render 시 debug 로그를 남긴다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { rerender } = renderHook(() => useComponentLogging('TestComp'));
    debugSpy.mockClear();

    rerender();

    expect(spyContaining(debugSpy, 're-render #')).toBe(true);
  });

  it('trackEvent는 이벤트 핸들러를 감싸서 로그를 남기고 원래 함수를 실행한다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useComponentLogging('TestComp'));

    const handler = vi.fn(() => 'clicked');

    let wrapped: () => string;
    act(() => {
      wrapped = result.current.trackEvent('click:save', handler);
    });

    debugSpy.mockClear();
    const returnValue = wrapped!();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe('clicked');
    expect(spyContaining(debugSpy, 'event:click:save')).toBe(true);
  });

  it('trackEvent는 지정한 로그 레벨로 기록한다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useComponentLogging('TestComp'));

    let wrapped: () => void;
    act(() => {
      wrapped = result.current.trackEvent('risky-action', () => {}, LogLevel.WARN);
    });

    warnSpy.mockClear();
    wrapped!();

    expect(spyContaining(warnSpy, 'event:risky-action')).toBe(true);
  });

  it('trackEvent는 INFO 레벨도 기록한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useComponentLogging('TestComp'));

    let wrapped: () => void;
    act(() => {
      wrapped = result.current.trackEvent('click:info', () => {}, LogLevel.INFO);
    });

    infoSpy.mockClear();
    wrapped!();

    expect(spyContaining(infoSpy, 'event:click:info')).toBe(true);
  });

  it('trackEvent는 ERROR 레벨도 기록한다', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result } = renderHook(() => useComponentLogging('TestComp'));

    let wrapped: () => void;
    act(() => {
      wrapped = result.current.trackEvent('click:error', () => {}, LogLevel.ERROR);
    });

    errorSpy.mockClear();
    wrapped!();

    expect(spyContaining(errorSpy, 'event:click:error')).toBe(true);
  });
});
