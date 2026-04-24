import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after threshold failures and recovers after timeout window - 임계치 실패 후 열리고 회복 시간 뒤 다시 닫힌다', async () => {
    // Given: 2회 실패 시 OPEN 되고 1초 후 복구를 시도하는 breaker가 있다.
    vi.useFakeTimers();

    const breaker = new CircuitBreaker('test', {
      failureThreshold: 2,
      recoveryTimeMs: 1000,
      timeoutMs: 100,
    });

    // When: 연속 실패를 두 번 발생시킨다.
    await expect(breaker.execute(async () => Promise.reject(new Error('fail-1')))).rejects.toThrow('fail-1');
    await expect(breaker.execute(async () => Promise.reject(new Error('fail-2')))).rejects.toThrow('fail-2');
    // Then: breaker는 OPEN 상태가 된다.
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    // When: 회복 시간 전에 다시 호출한다.
    await expect(breaker.execute(async () => 'skipped')).resolves.toBeNull();

    vi.advanceTimersByTime(1000);
    // When: 회복 시간 이후 성공 요청을 보낸다.
    await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
    // Then: breaker는 CLOSED로 복구된다.
    expect(breaker.currentState).toBe(CircuitState.CLOSED);

    vi.useRealTimers();
  });

  it('returns to open when half-open trial fails - HALF_OPEN 상태의 시험 요청이 실패하면 다시 OPEN 된다', async () => {
    // Given: 1회 실패만으로 OPEN 되는 breaker가 있다.
    vi.useFakeTimers();

    const breaker = new CircuitBreaker('test', {
      failureThreshold: 1,
      recoveryTimeMs: 1000,
      timeoutMs: 100,
    });

    // When: 첫 실패로 OPEN 상태를 만든다.
    await expect(breaker.execute(async () => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    vi.advanceTimersByTime(1000);
    // When: HALF_OPEN 시험 요청도 실패한다.
    await expect(breaker.execute(async () => Promise.reject(new Error('still fail')))).rejects.toThrow('still fail');
    // Then: breaker는 다시 OPEN 상태를 유지한다.
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    vi.useRealTimers();
  });

  it('reset() clears state and counters - reset은 상태와 카운터를 초기화한다', async () => {
    // Given: OPEN 상태에 도달한 breaker가 있다.
    const breaker = new CircuitBreaker('test', {
      failureThreshold: 1,
      recoveryTimeMs: 1000,
      timeoutMs: 100,
    });
    await expect(breaker.execute(async () => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    // When: reset을 호출한다.
    breaker.reset();

    // Then: 상태가 CLOSED로 복원되고 즉시 성공 요청을 받을 수 있다.
    expect(breaker.currentState).toBe(CircuitState.CLOSED);
    await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
  });

  it('times out long-running executions - 오래 걸리는 작업은 타임아웃으로 실패 처리한다', async () => {
    // Given: 100ms timeout을 가진 breaker와 오래 걸리는 비동기 작업이 있다.
    vi.useFakeTimers();

    const breaker = new CircuitBreaker('slow', {
      failureThreshold: 1,
      recoveryTimeMs: 1000,
      timeoutMs: 100,
    });

    // When: timeout보다 오래 걸리는 작업을 실행한다.
    const pending = breaker.execute(
      async () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('done'), 1000);
        }),
    );

    vi.advanceTimersByTime(100);
    // Then: timeout 에러가 발생하고 breaker는 OPEN 상태가 된다.
    await expect(pending).rejects.toThrow('timed out');
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    vi.useRealTimers();
  });
});
