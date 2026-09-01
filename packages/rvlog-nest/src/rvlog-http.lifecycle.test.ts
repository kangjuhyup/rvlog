import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { Logger, LogLevel } from '@kangjuhyup/rvlog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of, throwError, type Observable } from 'rxjs';
import { RvlogHttpInterceptor } from './rvlog-http.interceptor';
import type { RvlogHttpLoggingOptions } from './rvlog-http.options';
import { RvlogRequestContextMiddleware } from './rvlog-request-context.middleware';

class LifecycleController {
  handle() {
    return { ok: true };
  }
}

class TestResponse extends EventEmitter {
  statusCode = 200;
  readonly setHeader = vi.fn();
}

function createLifecycle(
  options: RvlogHttpLoggingOptions = {},
  path = '/votes?access_token=url-secret',
  useRawWrappers = false,
) {
  const request = {
    method: 'POST',
    originalUrl: path,
    body: { password: 'body-secret' },
    query: { token: 'query-secret' },
    params: {},
    headers: {
      'x-request-id': 'req-final',
      authorization: 'Bearer header-secret',
    },
  };
  const response = new TestResponse();
  const interceptorRequest = useRawWrappers
    ? { ...request, raw: request }
    : request;
  const interceptorResponse = useRawWrappers
    ? {
        get statusCode() {
          return response.statusCode;
        },
        setHeader: response.setHeader,
        raw: response,
      }
    : response;
  const middleware = new RvlogRequestContextMiddleware({
    context: 'HTTP',
    requestIdHeader: 'x-request-id',
    ...options,
  });
  const interceptor = new RvlogHttpInterceptor({
    context: 'HTTP',
    requestIdHeader: 'x-request-id',
    ...options,
  });
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => interceptorRequest,
      getResponse: () => interceptorResponse,
    }),
    getClass: () => LifecycleController,
    getHandler: () => LifecycleController.prototype.handle,
  };

  const runMiddleware = (next: () => void): void => {
    middleware.use(request, response, next);
  };
  const runInterceptor = (stream: Observable<unknown>): Promise<unknown> => {
    let result: Promise<unknown> | undefined;

    runMiddleware(() => {
      result = lastValueFrom(
        interceptor.intercept(context as never, { handle: () => stream }),
      );
    });

    if (!result) {
      throw new Error('interceptor did not run');
    }

    return result;
  };

  return {
    request,
    response,
    runMiddleware,
    runInterceptor,
  };
}

describe('rvlog final HTTP response lifecycle', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it.each([401, 403])(
    'logs guard-like %i once at WARN after the response finishes',
    (statusCode) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Logger.configure({ pretty: true });
      const lifecycle = createLifecycle({
        logBody: false,
        logQuery: false,
      });

      lifecycle.runMiddleware(() => {});
      lifecycle.response.statusCode = statusCode;
      lifecycle.response.emit('finish');
      lifecycle.response.emit('finish');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        `[req-final] HTTP :: POST /votes failed ${statusCode}`,
      );
      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it('logs a Pipe/handler HttpException once at WARN without a completion or ERROR log', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      logBody: false,
      logQuery: false,
    });

    const result = lifecycle.runInterceptor(
      throwError(() => new HttpException('exception-secret', 422)),
    );
    await expect(result).rejects.toThrow('exception-secret');

    lifecycle.response.statusCode = 422;
    lifecycle.response.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      '[req-final] HTTP :: POST /votes failed 422',
    );
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('POST /votes called');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses WARN instead of the normal completion level for an explicit final 4XX response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      logBody: false,
      logQuery: false,
      logResponseBody: true,
    });
    lifecycle.response.statusCode = 409;

    await lifecycle.runInterceptor(of({ response: 'response-secret' }));
    lifecycle.response.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('POST /votes failed 409');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('POST /votes called');
    expect(
      infoSpy.mock.calls.some((call) => String(call[0]).includes('completed 409')),
    ).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps one call log and one configured-level completion log for a normal 2XX response', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      level: LogLevel.DEBUG,
      logBody: false,
      logQuery: false,
      logResponseBody: true,
    });
    lifecycle.response.statusCode = 201;

    await lifecycle.runInterceptor(of({ result: 'response-visible' }));
    lifecycle.response.emit('finish');

    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[0]?.[0]).toContain('POST /votes called');
    expect(debugSpy.mock.calls[1]?.[0]).toContain('POST /votes completed 201');
    expect(debugSpy.mock.calls[1]?.[0]).toContain('response-visible');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses the status written by an exception filter instead of the thrown error type', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      logBody: false,
      logQuery: false,
    });

    const result = lifecycle.runInterceptor(
      throwError(() => new Error('exception-secret')),
    );
    await expect(result).rejects.toThrow('exception-secret');

    lifecycle.response.statusCode = 418;
    lifecycle.response.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('POST /votes failed 418');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('coordinates Fastify-shaped raw middleware objects with interceptor wrappers', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle(
      {
        logBody: false,
        logQuery: false,
      },
      '/votes',
      true,
    );

    const result = lifecycle.runInterceptor(
      throwError(() => new Error('exception-secret')),
    );
    await expect(result).rejects.toThrow('exception-secret');

    lifecycle.response.statusCode = 418;
    lifecycle.response.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('POST /votes failed 418');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('initializes the same middleware request idempotently', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      logBody: false,
      logQuery: false,
    });

    lifecycle.runMiddleware(() => {});
    lifecycle.runMiddleware(() => {});
    lifecycle.response.statusCode = 401;
    lifecycle.response.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs final 5XX once at ERROR with a payload-free notification context', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle({
      logBody: true,
      logQuery: true,
      logHeaders: true,
      logResponseBody: true,
    });

    const result = lifecycle.runInterceptor(
      throwError(() => new Error('exception-secret')),
    );
    await expect(result).rejects.toThrow('exception-secret');

    lifecycle.response.statusCode = 500;
    lifecycle.response.emit('finish');
    lifecycle.response.emit('finish');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      '[req-final] HTTP :: POST /votes failed 500',
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining('POST /votes failed 500'),
      expect.objectContaining({
        className: 'HTTP',
        methodName: 'POST',
        args: [],
      }),
    );
    expect(notifySpy.mock.calls[0]?.[2]).not.toHaveProperty('error');

    const failureOutput = [
      ...errorSpy.mock.calls.flat(),
      ...notifySpy.mock.calls.flatMap((call) => [call[1], call[2]]),
    ].map(String).join(' ');
    for (const secret of [
      'body-secret',
      'query-secret',
      'header-secret',
      'response-secret',
      'exception-secret',
      'url-secret',
    ]) {
      expect(failureOutput).not.toContain(secret);
    }
  });

  it('keeps request-id propagation but emits no HTTP logs for an excluded path', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });
    const lifecycle = createLifecycle(
      {
        excludePaths: ['/health'],
      },
      '/health/ready',
    );
    lifecycle.response.statusCode = 503;

    await lifecycle.runInterceptor(of({ ok: false }));
    lifecycle.response.emit('finish');

    expect(lifecycle.response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'req-final',
    );
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
