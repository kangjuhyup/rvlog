/**
 * otel-transport.test.ts
 *
 * 핵심 전략:
 *  - otel-transport.ts 내부의 tryCreateMeter()는 `require('@opentelemetry/api')`를 사용한다.
 *  - Vitest ESM 환경에서 vi.mock은 ESM import만 가로채고 CJS require는 가로채지 못한다.
 *  - 따라서 `require('@opentelemetry/api')`로 실제 CJS 모듈 인스턴스를 얻은 뒤,
 *    그 인스턴스의 `metrics.getMeter`를 vi.spyOn 으로 교체한다.
 *  - 각 테스트 전 vi.resetModules()로 otel-transport 모듈 캐시를 초기화하여
 *    constructor 가 새로운 spy를 참조하도록 만든다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from '@kangjuhyup/rvlog';
import type { LogRecord } from '@kangjuhyup/rvlog';

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────
function makeRecord(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    level: LogLevel.INFO,
    context: 'TestCtx',
    message: 'test message',
    timestamp: new Date().toISOString(),
    ...overrides,
  } as LogRecord;
}

// ─── @opentelemetry/api 있을 때 ────────────────────────────────────────────────
describe('OtelTransport (@opentelemetry/api 있을 때)', () => {
  let addMock: ReturnType<typeof vi.fn>;
  let recordMock: ReturnType<typeof vi.fn>;
  let getMeterSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    addMock = vi.fn();
    recordMock = vi.fn();

    const fakeMeter = {
      createCounter: vi.fn(() => ({ add: addMock })),
      createHistogram: vi.fn(() => ({ record: recordMock })),
    };

    // CJS 인스턴스에 spy를 설정한다.
    const otelCjs = require('@opentelemetry/api');
    getMeterSpy = vi.spyOn(otelCjs.metrics, 'getMeter').mockReturnValue(fakeMeter as never);

    // 모듈 캐시를 초기화해 OtelTransport constructor가 새 spy를 참조하도록 한다.
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('write() 호출 시 logCounter.add(1, {level, context})를 호출한다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: INFO 레벨 레코드로 write()를 호출한다.
    transport.write(makeRecord({ level: LogLevel.INFO, context: 'SvcCtx' }));

    // Then: logCounter.add(1, {level, context})가 호출된다.
    expect(addMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ level: LogLevel.INFO, context: 'SvcCtx' }),
    );
  });

  it('ERROR 레벨에서 errorCounter.add()를 추가로 호출한다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: ERROR 레벨 레코드로 write()를 호출한다.
    transport.write(makeRecord({ level: LogLevel.ERROR, context: 'ErrCtx' }));

    // Then: add가 2회 호출된다 (logCounter + errorCounter).
    expect(addMock).toHaveBeenCalledTimes(2);
    // 두 번째 호출이 errorCounter.add({context})
    expect(addMock).toHaveBeenNthCalledWith(2, 1, { context: 'ErrCtx' });
  });

  it('INFO/WARN/DEBUG 레벨에서 errorCounter는 호출되지 않는다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: INFO, WARN, DEBUG 레벨로 각각 write()를 호출한다.
    transport.write(makeRecord({ level: LogLevel.INFO }));
    transport.write(makeRecord({ level: LogLevel.WARN }));
    transport.write(makeRecord({ level: LogLevel.DEBUG }));

    // Then: add는 logCounter 용으로 3번만 호출되어야 한다.
    expect(addMock).toHaveBeenCalledTimes(3);
    // 모든 호출에 level 속성이 있어야 함 (logCounter 호출)
    for (const call of addMock.mock.calls) {
      const attrs = call[1] as Record<string, unknown>;
      expect(attrs).toHaveProperty('level');
    }
  });

  it('fields.duration_ms가 숫자일 때 durationHistogram.record()를 호출한다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: duration_ms 필드가 포함된 레코드로 write()를 호출한다.
    transport.write(makeRecord({ fields: { duration_ms: 123 } }));

    // Then: durationHistogram.record(123, {context, level})이 호출된다.
    expect(recordMock).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ context: 'TestCtx', level: LogLevel.INFO }),
    );
  });

  it('fields.duration_ms가 없을 때 durationHistogram은 호출되지 않는다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: duration_ms 필드 없이 write()를 호출한다.
    transport.write(makeRecord());

    // Then: durationHistogram.record()는 호출되지 않는다.
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('record.tags가 있을 때 attributes에 포함된다', async () => {
    // Given: OtelTransport가 생성되어 있다.
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When: tags가 포함된 레코드로 write()를 호출한다.
    transport.write(makeRecord({ tags: { service: 'api', version: 'v2' } }));

    // Then: logCounter.add()의 attributes에 tags가 포함된다.
    expect(addMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ service: 'api', version: 'v2' }),
    );
  });

  it('meterName 옵션이 getMeter()에 전달된다', async () => {
    // Given/When: meterName을 지정해 OtelTransport를 생성한다.
    const { OtelTransport } = await import('./otel-transport');
    new OtelTransport({ meterName: 'my-service' });

    // Then: getMeter('my-service')가 호출된다.
    expect(getMeterSpy).toHaveBeenCalledWith('my-service');
  });

  it('meterName이 없을 때 기본값 "rvlog"가 getMeter()에 전달된다', async () => {
    // Given/When: meterName 없이 OtelTransport를 생성한다.
    const { OtelTransport } = await import('./otel-transport');
    new OtelTransport();

    // Then: getMeter('rvlog')가 호출된다.
    expect(getMeterSpy).toHaveBeenCalledWith('rvlog');
  });
});

// ─── @opentelemetry/api 없을 때 ────────────────────────────────────────────────
describe('OtelTransport (@opentelemetry/api 없을 때)', () => {
  beforeEach(() => {
    // getMeter가 null을 반환하도록 설정해 meter 없는 상황을 시뮬레이션한다.
    const otelCjs = require('@opentelemetry/api');
    vi.spyOn(otelCjs.metrics, 'getMeter').mockReturnValue(null as never);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructor가 throw하지 않는다', async () => {
    // Given/When/Then: meter가 null이어도 생성 시 예외가 발생하지 않는다.
    const { OtelTransport } = await import('./otel-transport');
    expect(() => new OtelTransport()).not.toThrow();
  });

  it('write() 호출해도 throw하지 않는다 (no-op)', async () => {
    // Given: meter가 null이라 logCounter가 null인 상태
    const { OtelTransport } = await import('./otel-transport');
    const transport = new OtelTransport();

    // When/Then: write()를 호출해도 예외가 발생하지 않는다.
    expect(() =>
      transport.write({
        level: LogLevel.INFO,
        context: 'Ctx',
        message: 'msg',
        timestamp: '',
      } as LogRecord),
    ).not.toThrow();
  });
});
