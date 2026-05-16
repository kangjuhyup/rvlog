/**
 * setup.test.ts
 *
 * 핵심 전략:
 *  - setup.ts → OtelTransport → tryCreateMeter() 는 `require('@opentelemetry/api')`를 사용한다.
 *  - CJS `require()` 에는 vi.mock 이 적용되지 않으므로, `require('@opentelemetry/api')`로
 *    실제 CJS 인스턴스를 얻은 뒤 `metrics.getMeter`를 vi.spyOn 으로 교체한다.
 *  - 각 테스트 전 vi.resetModules()로 setup / otel-transport 모듈 캐시를 초기화한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel } from '@kangjuhyup/rvlog';

beforeEach(() => {
  // CJS 인스턴스의 metrics.getMeter 를 fake meter 로 교체한다.
  const otelCjs = require('@opentelemetry/api');
  vi.spyOn(otelCjs.metrics, 'getMeter').mockReturnValue({
    createCounter: vi.fn(() => ({ add: vi.fn() })),
    createHistogram: vi.fn(() => ({ record: vi.fn() })),
  } as never);

  // 모듈 캐시를 초기화해 setup / otel-transport 가 새 spy를 참조하도록 한다.
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  Logger.resetForTesting();
});

describe('setupOtelMonitoring', () => {
  it('Logger.configure()가 OtelTransport를 포함해서 호출된다', async () => {
    // Given: Logger.configure 스파이가 준비되어 있다.
    const configureSpy = vi.spyOn(Logger, 'configure');
    const { setupOtelMonitoring } = await import('./setup');
    const { OtelTransport } = await import('./otel-transport');

    // When: setupOtelMonitoring을 호출한다.
    setupOtelMonitoring();

    // Then: configure가 transports 배열에 OtelTransport 인스턴스를 포함해 호출된다.
    expect(configureSpy).toHaveBeenCalledTimes(1);
    const callArgs = configureSpy.mock.calls[0]?.[0];
    expect(callArgs).toHaveProperty('transports');
    const transports = callArgs?.transports ?? [];
    expect(transports.some((t) => t instanceof OtelTransport)).toBe(true);
  });

  it('extraTransports가 OtelTransport 앞에 포함된다', async () => {
    // Given: 커스텀 transport와 Logger.configure 스파이가 준비되어 있다.
    const configureSpy = vi.spyOn(Logger, 'configure');
    const { setupOtelMonitoring } = await import('./setup');
    const { OtelTransport } = await import('./otel-transport');

    const customTransport = { write: vi.fn() };

    // When: extraTransports를 포함해 setupOtelMonitoring을 호출한다.
    setupOtelMonitoring({ extraTransports: [customTransport] });

    // Then: transports 배열이 [customTransport, OtelTransport 인스턴스] 순서이다.
    const callArgs = configureSpy.mock.calls[0]?.[0];
    const transports = callArgs?.transports ?? [];
    expect(transports.length).toBeGreaterThanOrEqual(2);
    expect(transports[0]).toBe(customTransport);
    expect(transports[transports.length - 1]).toBeInstanceOf(OtelTransport);
  });

  it('loggerOptions (minLevel 등)이 Logger.configure에 전달된다', async () => {
    // Given: Logger.configure 스파이가 준비되어 있다.
    const configureSpy = vi.spyOn(Logger, 'configure');
    const { setupOtelMonitoring } = await import('./setup');

    // When: minLevel 옵션을 포함해 setupOtelMonitoring을 호출한다.
    setupOtelMonitoring({ minLevel: LogLevel.WARN });

    // Then: configure 인자에 minLevel이 포함된다.
    const callArgs = configureSpy.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ minLevel: LogLevel.WARN });
  });

  it('옵션 없이 호출해도 예외 없이 동작한다', async () => {
    // Given/When/Then: 인자 없이 setupOtelMonitoring을 호출해도 throw하지 않는다.
    const { setupOtelMonitoring } = await import('./setup');
    expect(() => setupOtelMonitoring()).not.toThrow();
  });

  it('meterName이 OtelTransport 생성자를 통해 getMeter()에 전달된다', async () => {
    // Given: CJS getMeter spy를 직접 참조한다.
    const otelCjs = require('@opentelemetry/api');
    // beforeEach에서 이미 spyOn 했지만 resetModules 이후라 다시 setup한다.
    // (beforeEach → resetModules 흐름 때문에 spy 참조를 얻으려면 여기서 다시 spyOn)
    const getMeterSpy = vi.spyOn(otelCjs.metrics, 'getMeter').mockReturnValue({
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createHistogram: vi.fn(() => ({ record: vi.fn() })),
    } as never);

    const { setupOtelMonitoring } = await import('./setup');

    // When: meterName 옵션을 포함해 setupOtelMonitoring을 호출한다.
    setupOtelMonitoring({ meterName: 'my-app' });

    // Then: getMeter('my-app')가 호출된다.
    expect(getMeterSpy).toHaveBeenCalledWith('my-app');
  });
});
