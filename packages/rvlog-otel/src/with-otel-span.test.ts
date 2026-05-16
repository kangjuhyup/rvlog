/**
 * with-otel-span.test.ts
 *
 * 핵심 전략:
 *  - with-otel-span.ts 내부의 tryStartSpan()/endSpanWithError()는 `require('@opentelemetry/api')`를 사용한다.
 *  - CJS `require()` 에는 vi.mock 이 적용되지 않으므로, `require('@opentelemetry/api')`로 실제
 *    CJS 인스턴스를 얻은 뒤 `trace.getTracer`를 vi.spyOn 으로 교체한다.
 *  - 각 테스트 전 vi.resetModules()로 with-otel-span 모듈 캐시를 초기화한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@kangjuhyup/rvlog';

// ─── @opentelemetry/api 있을 때 ────────────────────────────────────────────────
describe('withOtelSpan (@opentelemetry/api 있을 때)', () => {
  let endMock: ReturnType<typeof vi.fn>;
  let recordExceptionMock: ReturnType<typeof vi.fn>;
  let setStatusMock: ReturnType<typeof vi.fn>;
  let startSpanMock: ReturnType<typeof vi.fn>;
  let getTracerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    endMock = vi.fn();
    recordExceptionMock = vi.fn();
    setStatusMock = vi.fn();
    startSpanMock = vi.fn(() => ({
      end: endMock,
      recordException: recordExceptionMock,
      setStatus: setStatusMock,
    }));

    // CJS 인스턴스의 trace.getTracer 에 spy를 설정한다.
    const otelCjs = require('@opentelemetry/api');
    getTracerSpy = vi.spyOn(otelCjs.trace, 'getTracer').mockReturnValue({
      startSpan: startSpanMock,
    } as never);

    // 모듈 캐시를 초기화해 with-otel-span 이 새 spy를 참조하도록 한다.
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Logger.resetForTesting();
  });

  it('동기 성공: span.end()가 호출되고 반환값이 보존된다', async () => {
    // Given: 콘솔 스파이와 동기 함수가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    const wrapped = withOtelSpan((x: number) => x * 2, { context: 'math', name: 'double' });

    // When: 동기 함수로 호출한다.
    const result = wrapped(21);

    // Then: 반환값이 보존되고 span.end()가 호출된다.
    expect(result).toBe(42);
    expect(endMock).toHaveBeenCalledTimes(1);
    expect(recordExceptionMock).not.toHaveBeenCalled();
  });

  it('비동기 성공: span.end()가 호출되고 resolved 값이 보존된다', async () => {
    // Given: 콘솔 스파이와 비동기 함수가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    const wrapped = withOtelSpan(async (x: number) => x + 10, { context: 'async-math', name: 'add' });

    // When: 비동기 함수로 호출한다.
    const result = await wrapped(5);

    // Then: resolved 값이 보존되고 span.end()가 호출된다.
    expect(result).toBe(15);
    expect(endMock).toHaveBeenCalledTimes(1);
    expect(recordExceptionMock).not.toHaveBeenCalled();
  });

  it('동기 에러: span.recordException(), span.setStatus(ERROR), span.end() 후 예외를 rethrow한다', async () => {
    // Given: 콘솔 스파이와 동기 에러를 던지는 함수가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    const boom = new Error('sync error');
    const fn = () => { throw boom; };
    const wrapped = withOtelSpan(fn, { context: 'svc', name: 'failSync' });

    // When/Then: 예외가 rethrow되고 span 에러 처리가 호출된다.
    expect(() => wrapped()).toThrow('sync error');
    expect(recordExceptionMock).toHaveBeenCalledWith(boom);
    expect(setStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'sync error' }),
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('비동기 에러: span.recordException(), span.setStatus(ERROR), span.end() 후 reject한다', async () => {
    // Given: 콘솔 스파이와 비동기 에러를 던지는 함수가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    const boom = new Error('async error');
    const wrapped = withOtelSpan(async () => { throw boom; }, { context: 'svc', name: 'failAsync' });

    // When/Then: Promise가 reject되고 span 에러 처리가 호출된다.
    await expect(wrapped()).rejects.toThrow('async error');
    expect(recordExceptionMock).toHaveBeenCalledWith(boom);
    expect(setStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'async error' }),
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('span 이름이 "context.fnName" 형식으로 생성된다', async () => {
    // Given: 콘솔 스파이가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When: context와 name을 지정해 래핑하고 호출한다.
    withOtelSpan(() => 'ok', { context: 'MyService', name: 'doWork' })();

    // Then: startSpan이 "MyService.doWork" 형식으로 호출된다.
    expect(startSpanMock).toHaveBeenCalledWith('MyService.doWork');
  });

  it('options.name을 명시하면 fn.name 대신 사용된다', async () => {
    // Given: 콘솔 스파이가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When: fn.name과 다른 name을 options에 명시한다.
    function originalName() { return 'ok'; }
    withOtelSpan(originalName, { context: 'Ctx', name: 'customName' })();

    // Then: span 이름이 "Ctx.customName"이다.
    expect(startSpanMock).toHaveBeenCalledWith('Ctx.customName');
  });

  it('fn.name이 없을 때 "anonymous"를 사용한다', async () => {
    // Given: 콘솔 스파이가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // fn.name을 빈 문자열로 강제 설정해 익명 함수를 시뮬레이션한다.
    const anon = (() => 'ok') as (...args: unknown[]) => unknown;
    Object.defineProperty(anon, 'name', { value: '', configurable: true });

    // When: name 없이 래핑하고 호출한다.
    withOtelSpan(anon, { context: 'Ctx' })();

    // Then: span 이름이 "Ctx.anonymous"이다.
    expect(startSpanMock).toHaveBeenCalledWith('Ctx.anonymous');
  });

  it('tracerName 옵션이 getTracer()에 전달된다', async () => {
    // Given: 콘솔 스파이가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When: tracerName을 지정해 래핑하고 호출한다.
    withOtelSpan(() => 'ok', { context: 'Ctx', name: 'fn', tracerName: 'my-tracer' })();

    // Then: getTracer('my-tracer')가 호출된다.
    expect(getTracerSpy).toHaveBeenCalledWith('my-tracer');
  });

  it('tracerName이 없을 때 기본값 "rvlog"가 getTracer()에 전달된다', async () => {
    // Given: 콘솔 스파이가 준비되어 있다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When: tracerName 없이 래핑하고 호출한다.
    withOtelSpan(() => 'ok', { context: 'Ctx', name: 'fn' })();

    // Then: getTracer('rvlog')가 호출된다.
    expect(getTracerSpy).toHaveBeenCalledWith('rvlog');
  });
});

// ─── @opentelemetry/api 없을 때 (span null 폴백) ───────────────────────────────
describe('withOtelSpan (@opentelemetry/api 없을 때 — span null 폴백)', () => {
  beforeEach(async () => {
    // startSpan이 null을 반환해 span이 없는 상황을 시뮬레이션한다.
    const otelCjs = require('@opentelemetry/api');
    vi.spyOn(otelCjs.trace, 'getTracer').mockReturnValue({
      startSpan: vi.fn(() => null),
    } as never);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Logger.resetForTesting();
  });

  it('span이 null이면 함수가 정상 실행된다 (withLogging 폴백)', async () => {
    // Given: span이 생성되지 않는 상황에서 withOtelSpan으로 함수를 래핑한다.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When: span 없이 함수를 호출한다.
    const wrapped = withOtelSpan((x: number) => x + 1, { context: 'Ctx', name: 'add' });
    const result = wrapped(9);

    // Then: 함수 결과가 정상적으로 반환된다.
    expect(result).toBe(10);
  });

  it('span이 null이어도 throw하지 않는다', async () => {
    // Given: span이 없는 상황
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { withOtelSpan } = await import('./with-otel-span');

    // When/Then: 래핑 및 호출 모두 예외 없이 동작한다.
    const wrapped = withOtelSpan(() => 'safe', { context: 'Ctx', name: 'fn' });
    expect(() => wrapped()).not.toThrow();
  });
});
