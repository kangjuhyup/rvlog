import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@kangjuhyup/rvlog';
import { RvlogRequestContextMiddleware } from './rvlog-request-context.middleware';
import { getRvlogContext } from './rvlog-request-context';

describe('RvlogRequestContextMiddleware', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('propagates requestId before downstream middleware, guards, and filters run - middleware/guard/filter 로그에 requestId를 붙인다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const middleware = new RvlogRequestContextMiddleware({
      requestIdHeader: 'x-request-id',
    });
    const response = { setHeader: vi.fn() };
    let filterLog: Promise<void> | undefined;

    middleware.use(
      {
        headers: {
          'x-request-id': 'req-chain',
        },
      },
      response,
      () => {
        new Logger('UserMiddleware').info('middleware log');
        new Logger('AuthGuard').info('guard log');
        filterLog = Promise.resolve().then(() => {
          new Logger('GlobalFilter').error('filter log');
        });
      },
    );

    await filterLog;

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-chain');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('[req-chain]');
    expect(infoSpy.mock.calls[0]?.[0]).toContain('UserMiddleware :: middleware log');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('[req-chain]');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('AuthGuard :: guard log');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[req-chain]');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('GlobalFilter :: filter log');
  });

  it('generates requestId before guard-like logs when the header is missing - 헤더가 없어도 guard 로그 전에 requestId를 만든다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.configure({ pretty: true });

    const middleware = new RvlogRequestContextMiddleware({
      requestIdHeader: 'x-correlation-id',
    });
    const response = { setHeader: vi.fn() };

    middleware.use({ headers: {} }, response, () => {
      new Logger('AuthGuard').info('guard log');
    });

    const generatedRequestId = response.setHeader.mock.calls[0]?.[1] as string;
    expect(generatedRequestId).toMatch(/[0-9a-f-]{36}/i);
    expect(infoSpy.mock.calls[0]?.[0]).toContain(`[${generatedRequestId}]`);
    expect(infoSpy.mock.calls[0]?.[0]).toContain('AuthGuard :: guard log');
  });

  it('propagates traceId and initial tenant context from HTTP requests', () => {
    const transport = { write: vi.fn() };
    Logger.configure({ console: false, transports: [transport] });

    const middleware = new RvlogRequestContextMiddleware({
      traceIdHeader: 'x-trace-id',
      contextEnricher: (request) => ({
        tenantId: String(request.headers?.['x-tenant-id']),
      }),
    });
    const response = { setHeader: vi.fn() };

    middleware.use(
      {
        headers: {
          'x-request-id': 'req-1',
          'x-trace-id': 'trace-1',
          'x-tenant-id': 'tenant-1',
        },
      },
      response,
      () => {
        expect(getRvlogContext()).toMatchObject({
          requestId: 'req-1',
          traceId: 'trace-1',
          tenantId: 'tenant-1',
        });
        new Logger('AuthGuard').info('guard log');
      },
    );

    expect(response.setHeader).toHaveBeenCalledWith('x-trace-id', 'trace-1');
    expect(transport.write).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        traceId: 'trace-1',
        tenantId: 'tenant-1',
      }),
      expect.any(String),
    );
  });

  it('extracts a W3C trace id when x-trace-id is absent', () => {
    const middleware = new RvlogRequestContextMiddleware();
    const response = { setHeader: vi.fn() };
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

    middleware.use(
      {
        headers: {
          traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
        },
      },
      response,
      () => {
        expect(getRvlogContext()?.traceId).toBe(traceId);
      },
    );

    expect(response.setHeader).toHaveBeenCalledWith('x-trace-id', traceId);
  });
});
