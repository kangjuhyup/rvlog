import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Logger } from 'rvlog';
import { useLogger } from './use-logger';

describe('useLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('동일 context에 대해 같은 Logger 인스턴스를 반환한다', () => {
    const { result, rerender } = renderHook(() => useLogger('TestComponent'));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
    expect(first).toBeInstanceOf(Logger);
  });

  it('다른 context로 호출하면 서로 다른 인스턴스를 반환한다', () => {
    const { result: a } = renderHook(() => useLogger('A'));
    const { result: b } = renderHook(() => useLogger('B'));

    expect(a.current).not.toBe(b.current);
  });
});
