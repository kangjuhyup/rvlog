import type { FactoryProvider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  InMemoryLogTransport,
  Logger,
  LoggerSystem,
  type StructuredLoggerLike,
} from '@kangjuhyup/rvlog';
import { createRvlogLoggerProvider } from './create-rvlog-logger.provider';
import { RVLOG_LOGGER_SYSTEM } from './rvlog-http.options';

describe('createRvlogLoggerProvider', () => {
  it('creates an injectable scoped logger from the configured LoggerSystem', () => {
    const token = Symbol('VOTE_AUDIT_LOGGER');
    const provider = createRvlogLoggerProvider(token, 'VoteAudit') as FactoryProvider;
    const sink = new InMemoryLogTransport();
    const system = new LoggerSystem({ console: false, transports: [sink] });
    const logger = provider.useFactory(system) as StructuredLoggerLike;

    logger.event('audit.checked', { allowed: true });

    expect(provider.provide).toBe(token);
    expect(provider.inject).toEqual([RVLOG_LOGGER_SYSTEM]);
    expect(sink.records[0]).toMatchObject({
      context: 'VoteAudit',
      eventName: 'audit.checked',
    });
  });

  it('falls back to the compatible global Logger when no isolated system is configured', () => {
    const provider = createRvlogLoggerProvider(Symbol('LOGGER'), 'Fallback') as FactoryProvider;

    expect(provider.useFactory(null)).toBeInstanceOf(Logger);
  });
});
