import { APP_INTERCEPTOR } from '@nestjs/core';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Logger, LogLevel } from '@kangjuhyup/rvlog';
import {
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  RvlogHttpInterceptor,
} from './rvlog-http.interceptor';
import { RvlogNestModule } from './rvlog-nest.module';

describe('RvlogNestModule', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('forRoot configures Logger and exposes interceptor providers - Logger 설정과 interceptor provider를 함께 등록한다', () => {
    const configureSpy = vi.spyOn(Logger, 'configure').mockImplementation(() => {});

    const dynamicModule = RvlogNestModule.forRoot({
      logger: { minLevel: LogLevel.INFO },
      http: { context: 'HTTP', requestIdHeader: 'x-request-id' },
    });

    expect(configureSpy).toHaveBeenCalledWith({ minLevel: LogLevel.INFO });
    expect(dynamicModule.module).toBe(RvlogNestModule);
    expect(dynamicModule.exports).toEqual([RVLOG_HTTP_LOGGING_OPTIONS, RVLOG_HTTP_LOGGER_SYSTEM]);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: RVLOG_HTTP_LOGGING_OPTIONS,
          useValue: { context: 'HTTP', requestIdHeader: 'x-request-id' },
        },
        {
          provide: RVLOG_HTTP_LOGGER_SYSTEM,
          useValue: null,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RvlogHttpInterceptor,
        },
      ]),
    );
  });

  it('forRoot uses defaults when no options are provided - 옵션이 없으면 기본 HTTP 옵션을 사용한다', () => {
    const configureSpy = vi.spyOn(Logger, 'configure').mockImplementation(() => {});

    const dynamicModule = RvlogNestModule.forRoot();

    expect(configureSpy).not.toHaveBeenCalled();
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: RVLOG_HTTP_LOGGING_OPTIONS,
          useValue: {},
        },
        {
          provide: RVLOG_HTTP_LOGGER_SYSTEM,
          useValue: null,
        },
      ]),
    );
  });

  it('forRoot configures the provided LoggerSystem instead of the global Logger - 주입된 LoggerSystem이 있으면 그 쪽을 설정한다', () => {
    const configureSpy = vi.spyOn(Logger, 'configure').mockImplementation(() => {});
    const system = {
      configure: vi.fn(),
    };
    const systemConfigureSpy = vi.spyOn(system, 'configure');

    const dynamicModule = RvlogNestModule.forRoot({
      loggerSystem: system as never,
      logger: { minLevel: LogLevel.INFO },
    });

    expect(configureSpy).not.toHaveBeenCalled();
    expect(systemConfigureSpy).toHaveBeenCalledWith({ minLevel: LogLevel.INFO });
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: RVLOG_HTTP_LOGGER_SYSTEM,
          useValue: system,
        },
      ]),
    );
  });
});
