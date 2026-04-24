import { expressLoggerSystem } from '../logger-system';

const structuredLogger = expressLoggerSystem
  .createLogger('structured-metadata')
  .withTags({
    example: 'express',
    feature: 'structured-metadata',
  })
  .withFields({
    runtime: 'node',
    framework: 'express',
  });

export function logExpressServerStarted(port: number) {
  structuredLogger
    .child({
      tags: { action: 'server-started' },
      fields: { port },
    })
    .info('express example started with isolated LoggerSystem');
}

export function logExpressUserCreated(createdUser: { id: number; email: string }) {
  structuredLogger
    .child({
      tags: { action: 'user-created' },
      fields: {
        userId: createdUser.id,
        emailDomain: createdUser.email.split('@')[1] ?? 'unknown',
      },
    })
    .info('express example emitted structured metrics-style log');
}
