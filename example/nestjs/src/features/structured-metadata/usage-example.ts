import { nestLoggerSystem } from '../logger-system';

const structuredLogger = nestLoggerSystem
  .createLogger('structured-metadata')
  .withTags({
    example: 'nestjs',
    feature: 'structured-metadata',
  })
  .withFields({
    runtime: 'node',
    framework: 'nestjs',
  });

export function logNestApplicationStarted(port: number) {
  structuredLogger
    .child({
      tags: { action: 'application-started' },
      fields: { port },
    })
    .info('nestjs example started with isolated LoggerSystem');
}

export function logNestUserCreated(createdUser: { id: number; email: string }) {
  structuredLogger
    .child({
      tags: { action: 'user-created' },
      fields: {
        userId: createdUser.id,
        emailDomain: createdUser.email.split('@')[1] ?? 'unknown',
      },
    })
    .info('nestjs example emitted structured metrics-style log');
}
