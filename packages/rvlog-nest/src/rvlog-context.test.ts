import { describe, expect, it } from 'vitest';
import {
  createLoggerSystem,
  InMemoryLogTransport,
} from '@kangjuhyup/rvlog';
import {
  enrichRvlogContext,
  getRvlogContext,
  getRvlogRequestContext,
  installRvlogRequestContextResolver,
  runWithRvlogContext,
  runWithRvlogRequestContext,
} from './rvlog-request-context';

describe('rvlog execution context', () => {
  it('propagates and enriches correlation and principal metadata across async work', async () => {
    await runWithRvlogContext(
      { requestId: 'job-1', traceId: 'trace-1' },
      async () => {
        expect(enrichRvlogContext({
          tenantId: 'tenant-1',
          userPrincipalId: 'principal-1',
          fields: { queue: 'vote-events' },
        })).toBe(true);

        await Promise.resolve();

        expect(getRvlogContext()).toEqual({
          requestId: 'job-1',
          traceId: 'trace-1',
          tenantId: 'tenant-1',
          userPrincipalId: 'principal-1',
          fields: { queue: 'vote-events' },
        });
      },
    );
  });

  it('keeps the existing request-context aliases compatible', () => {
    runWithRvlogRequestContext({ requestId: 'req-legacy' }, () => {
      expect(getRvlogRequestContext()).toEqual({ requestId: 'req-legacy' });
      expect(getRvlogContext()).toEqual({ requestId: 'req-legacy' });
    });
  });

  it('returns false when there is no active context to enrich', () => {
    expect(enrichRvlogContext({ tenantId: 'tenant-1' })).toBe(false);
  });

  it('installs an idempotent worker resolver and preserves existing fields', () => {
    const sink = new InMemoryLogTransport();
    const system = createLoggerSystem({ console: false, transports: [sink] });
    system.setContextResolver(() => ({
      fields: { application: 'vote' },
      tags: { environment: 'test' },
    }));

    installRvlogRequestContextResolver(system);
    const resolver = system.getContextResolver();
    installRvlogRequestContextResolver(system);

    expect(system.getContextResolver()).toBe(resolver);

    runWithRvlogContext({
      requestId: 'job-1',
      traceId: 'trace-1',
      tenantId: 'tenant-1',
      userPrincipalId: 'principal-1',
      fields: { queue: 'vote-events' },
    }, () => {
      system.createLogger('VoteWorker').event('vote.count.completed', { voteId: 'vote-1' });
    });

    expect(sink.records).toEqual([
      expect.objectContaining({
        requestId: 'job-1',
        traceId: 'trace-1',
        tenantId: 'tenant-1',
        userPrincipalId: 'principal-1',
        tags: { environment: 'test' },
        fields: {
          application: 'vote',
          queue: 'vote-events',
          voteId: 'vote-1',
        },
      }),
    ]);
  });
});
