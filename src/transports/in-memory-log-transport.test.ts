import { describe, expect, it } from 'vitest';
import { LogLevel } from '../log/log-level';
import { createLoggerSystem } from '../log/logger';
import { InMemoryLogTransport } from './in-memory-log-transport';

interface AuthorizationDecisionMetadata {
  action: 'vote.read' | 'vote.write';
  allowed: boolean;
  nested: {
    accessToken: string;
  };
}

describe('InMemoryLogTransport', () => {
  it('captures typed structured events without spying on Logger.prototype', () => {
    const sink = new InMemoryLogTransport();
    const system = createLoggerSystem({
      console: false,
      transports: [sink],
      contextResolver: () => ({
        requestId: 'req-1',
        traceId: 'trace-1',
        tenantId: 'tenant-1',
        userPrincipalId: 'user-1',
      }),
    });

    system.createLogger('VoteAuthorization').event<AuthorizationDecisionMetadata>(
      'authorization.decision',
      {
        action: 'vote.read',
        allowed: false,
        nested: { accessToken: 'must-not-leak' },
      },
      LogLevel.WARN,
    );

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      context: 'VoteAuthorization',
      eventName: 'authorization.decision',
      message: 'authorization.decision',
      level: LogLevel.WARN,
      requestId: 'req-1',
      traceId: 'trace-1',
      tenantId: 'tenant-1',
      userPrincipalId: 'user-1',
      fields: {
        action: 'vote.read',
        allowed: false,
        nested: { accessToken: '******' },
      },
    });
  });

  it('clears captured records between tests', () => {
    const sink = new InMemoryLogTransport();
    const logger = createLoggerSystem({ console: false, transports: [sink] })
      .createLogger('Test');

    logger.info('first');
    sink.clear();

    expect(sink.records).toEqual([]);
  });
});
