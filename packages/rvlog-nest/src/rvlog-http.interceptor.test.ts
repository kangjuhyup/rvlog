import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { MaskLog, Logger, LogLevel } from '@kangjuhyup/rvlog';
import { RvlogHttpInterceptor } from './rvlog-http.interceptor';

class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;
}

class UserController {
  create(_dto: CreateUserDto) {
    return { ok: true };
  }

  update(_id: string, _dto: CreateUserDto) {
    return { ok: true };
  }

  search(_query: string, _dto: CreateUserDto) {
    return { ok: true };
  }
}

Reflect.defineMetadata('design:paramtypes', [CreateUserDto], UserController.prototype, 'create');
Reflect.defineMetadata(
  ROUTE_ARGS_METADATA,
  {
    [`${RouteParamtypes.BODY}:0`]: { index: 0 },
  },
  UserController.prototype.create,
);
Reflect.defineMetadata('design:paramtypes', [String, CreateUserDto], UserController.prototype, 'update');
Reflect.defineMetadata(
  ROUTE_ARGS_METADATA,
  {
    [`${RouteParamtypes.PARAM}:0`]: { index: 0 },
    [`${RouteParamtypes.BODY}:1`]: { index: 1 },
  },
  UserController.prototype.update,
);
Reflect.defineMetadata('design:paramtypes', [String, CreateUserDto], UserController.prototype, 'search');
Reflect.defineMetadata(
  ROUTE_ARGS_METADATA,
  {
    [`${RouteParamtypes.QUERY}:0`]: { index: 0 },
  },
  UserController.prototype.search,
);

function createHttpContext(
  body: unknown,
  requestId: string | string[] = 'req-123',
  overrides?: {
    method?: string;
    originalUrl?: string;
    url?: string;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    statusCode?: number | undefined;
    type?: 'http' | 'rpc';
    controller?: typeof UserController;
    handler?: (...args: never[]) => unknown;
  },
) {
  const request = {
    method: overrides?.method ?? 'POST',
    originalUrl: overrides?.originalUrl ?? '/users',
    url: overrides?.url,
    body,
    query: overrides?.query ?? {},
    params: overrides?.params ?? {},
    headers: {
      'x-request-id': requestId,
      ...overrides?.headers,
    },
  };

  const response = {
    statusCode:
      overrides && 'statusCode' in overrides ? overrides.statusCode : 201,
    setHeader: vi.fn(),
  };

  return {
    getType: () => overrides?.type ?? 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getClass: () => overrides?.controller ?? UserController,
    getHandler: () => overrides?.handler ?? UserController.prototype.create,
  } as const;
}

describe('RvlogHttpInterceptor', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('masks request body and keeps the same requestId on request/response logs - 요청/응답 로그 모두 같은 requestId와 마스킹을 사용한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext({
      name: '강주협',
      email: 'abc@abc.com',
    });

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy.mock.calls[0]?.[0]).toContain('[req-123] HTTP :: POST /users called');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('강*협');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('ab***@abc.com');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('[req-123] HTTP :: POST /users completed 201');
  });

  it('masks raw JSON string request bodies using DTO metadata - JSON 파싱 전 raw body도 DTO 메타데이터로 마스킹한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext('{"name":"강주협","email":"abc@abc.com"}');

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('강*협');
    expect(requestLog).toContain('ab***@abc.com');
    expect(requestLog).not.toContain('강주협');
    expect(requestLog).not.toContain('abc@abc.com');
  });

  it('masks raw JSON array request bodies using DTO metadata - raw JSON 배열 body도 DTO 메타데이터로 마스킹한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext('[{"name":"강주협","email":"abc@abc.com"}]');

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('강*협');
    expect(requestLog).toContain('ab***@abc.com');
    expect(requestLog).not.toContain('강주협');
    expect(requestLog).not.toContain('abc@abc.com');
  });

  it('keeps logging when raw JSON body parsing fails - raw JSON 파싱 실패 시에도 로깅을 유지한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      requestIdHeader: 'x-request-id',
    });
    const malformedBody = '{"name":"강주협","email":"abc@abc.com"';
    const context = createHttpContext(malformedBody);

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('[req-123] HTTP :: POST /users called');
    expect(requestLog).toContain('\\"name\\":\\"강주협\\"');
    expect(requestLog).toContain('\\"email\\":\\"abc@abc.com\\"');
  });

  it('keeps the same requestId on error logs and notifies through rvlog - 에러 로그도 같은 requestId로 남기고 notify를 호출한다', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext({
      name: '강주협',
      email: 'abc@abc.com',
    });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, { handle: () => throwError(() => new Error('boom')) })),
    ).rejects.toThrow('boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[req-123] HTTP :: POST /users failed');
    expect(notifySpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining('POST /users failed'),
      expect.objectContaining({
        className: 'HTTP',
      }),
    );
  });

  it('truncates long request and response payloads using core serialize options - HTTP 로그도 코어 serialize 옵션으로 길이를 제한한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({
      pretty: true,
      serialize: {
        maxStringLength: 5,
        truncateSuffix: '...',
      },
    });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      logResponseBody: true,
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext({
      name: '강주협길동',
      email: 'averylongemail@example.com',
    });

    await lastValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of({ note: 'abcdefghijk' }),
      }),
    );

    expect(infoSpy.mock.calls[0]?.[0]).toContain('강***동');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('abcde...');
  });

  it('supports custom request and completion log levels - 요청/완료 로그 레벨을 옵션으로 바꿀 수 있다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      level: LogLevel.DEBUG,
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext({ ok: true });

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[0]?.[0]).toContain('POST /users called');
    expect(debugSpy.mock.calls[1]?.[0]).toContain('POST /users completed 201');
  });

  it('logs query, params, and masked headers when enabled - 옵션이 켜지면 query/params/header도 함께 기록한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logHeaders: true,
      maskHeaders: ['authorization'],
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext(
      {
        name: '강주협',
        email: 'abc@abc.com',
      },
      'req-999',
      {
        query: { page: '1' },
        params: { id: '42' },
        headers: {
          authorization: 'Bearer token',
          'x-client-id': 'web',
        },
      },
    );

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('[req-999] HTTP :: POST /users called');
    expect(requestLog).toContain('"params":{"id":"42"}');
    expect(requestLog).toContain('"query":{"page":"1"}');
    expect(requestLog).toContain('"authorization":"******"');
    expect(requestLog).toContain('"x-client-id":"web"');
  });

  it('uses first request id from header array and mirrors it to the response header - 배열 헤더면 첫 값을 requestId로 사용한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      requestIdHeader: 'x-request-id',
    });
    const context = createHttpContext({ ok: true }, ['req-a', 'req-b']);

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    expect(infoSpy.mock.calls[0]?.[0]).toContain('[req-a] HTTP :: POST /users called');
    expect(context.switchToHttp().getResponse().setHeader).toHaveBeenCalledWith('x-request-id', 'req-a');
  });

  it('generates a request id when the configured header is missing and can skip response header propagation - requestId가 없으면 생성하고 응답 헤더 설정은 끌 수 있다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      requestIdHeader: 'x-correlation-id',
      setResponseHeader: false,
    });
    const context = createHttpContext(
      { ok: true },
      '',
      {
        headers: {},
      },
    );

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('HTTP :: POST /users called');
    expect(requestLog).toMatch(/\[[0-9a-f-]{36}\]/i);
    expect(context.switchToHttp().getResponse().setHeader).not.toHaveBeenCalled();
  });

  it('skips logging for excluded paths - 제외 경로는 로깅 없이 그대로 통과시킨다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      excludePaths: ['/users'],
    });
    const handle = vi.fn(() => of({ ok: true }));
    const context = createHttpContext({ ok: true });

    await lastValueFrom(interceptor.intercept(context as never, { handle }));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('passes through non-http contexts without logging - http가 아닌 컨텍스트는 그대로 통과시킨다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const interceptor = new RvlogHttpInterceptor({ context: 'HTTP' });
    const handle = vi.fn(() => of('rpc-result'));
    const context = createHttpContext({ ok: true }, 'req-123', { type: 'rpc' });

    await lastValueFrom(interceptor.intercept(context as never, { handle }));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('uses default status codes for success and error paths - statusCode가 없으면 성공은 200, 실패는 500을 사용한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifySpy = vi.spyOn(Logger, 'notify').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      requestIdHeader: 'x-request-id',
    });

    const successContext = createHttpContext({ ok: true }, 'req-200', { statusCode: undefined });
    await lastValueFrom(interceptor.intercept(successContext as never, { handle: () => of({ ok: true }) }));

    expect(infoSpy.mock.calls[1]?.[0]).toContain('completed 200');

    const errorContext = createHttpContext({ ok: true }, 'req-500', { statusCode: undefined });
    await expect(
      lastValueFrom(interceptor.intercept(errorContext as never, { handle: () => throwError(() => 'boom') })),
    ).rejects.toBe('boom');

    expect(errorSpy.mock.calls[0]?.[0]).toContain('failed 500');
    expect(notifySpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining('failed 500'),
      expect.objectContaining({
        error: expect.objectContaining({ message: 'boom' }),
      }),
    );
  });

  it('does not append response payload when response body logging is disabled - 응답 바디 로깅이 꺼져 있으면 완료 로그에 payload를 붙이지 않는다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logResponseBody: false,
    });
    const context = createHttpContext({ ok: true }, 'req-plain');

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ note: 'hidden' }) }));

    const completionLog = infoSpy.mock.calls[1]?.[0] as string;
    expect(completionLog).toContain('completed 201');
    expect(completionLog).not.toContain('response');
    expect(completionLog).not.toContain('hidden');
  });

  it('uses body metadata from a non-zero body parameter index - body 파라미터 index가 0이 아니어도 메타데이터를 사용한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
    });
    const context = createHttpContext(
      {
        name: '강주협',
        email: 'abc@abc.com',
      },
      'req-update',
      {
        handler: UserController.prototype.update,
      },
    );

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('강*협');
    expect(requestLog).toContain('ab***@abc.com');
  });

  it('falls back to the first non-primitive parameter prototype when BODY metadata is absent - BODY 메타데이터가 없어도 비원시 prototype을 찾는다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
    });
    const context = createHttpContext(
      {
        name: '강주협',
        email: 'abc@abc.com',
      },
      'req-search',
      {
        handler: UserController.prototype.search,
      },
    );

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    expect(requestLog).toContain('강*협');
    expect(requestLog).toContain('ab***@abc.com');
  });

  it('logs primitive request bodies without prototype assignment and tolerates missing headers - 원시 body와 없는 headers도 안전하게 처리한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({
      context: 'HTTP',
      logBody: true,
      logHeaders: true,
    });
    const context = createHttpContext('plain-text', 'req-primitive', {
      headers: undefined,
    });
    context.switchToHttp().getRequest().headers = undefined;

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of(undefined) }));

    const requestLog = infoSpy.mock.calls[0]?.[0] as string;
    const completionLog = infoSpy.mock.calls[1]?.[0] as string;
    expect(requestLog).toContain('plain-text');
    expect(requestLog).not.toContain('headers');
    expect(completionLog).toContain('completed 201');
  });

  it('falls back to an empty path and default HTTP method when request fields are missing - path/method가 없으면 기본값을 사용한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const interceptor = new RvlogHttpInterceptor({ context: 'HTTP' });
    const context = createHttpContext(undefined, 'req-default', {
      method: undefined,
      originalUrl: undefined,
      url: undefined,
    });
    const request = context.switchToHttp().getRequest();
    request.method = undefined;
    request.originalUrl = undefined;
    request.url = undefined;

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));

    expect(infoSpy.mock.calls[0]?.[0]).toContain('HTTP  called');
  });
});
