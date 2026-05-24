import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@kangjuhyup/rvlog';
import { RvlogRequestContextMiddleware } from './rvlog-request-context.middleware';

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
    expect(infoSpy.mock.calls[0]?.[0]).toContain('[req-chain] UserMiddleware :: middleware log');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('[req-chain] AuthGuard :: guard log');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[req-chain] GlobalFilter :: filter log');
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
    expect(infoSpy.mock.calls[0]?.[0]).toContain(`[${generatedRequestId}] AuthGuard :: guard log`);
  });
});
