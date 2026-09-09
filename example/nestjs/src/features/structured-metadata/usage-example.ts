import { LogLevel } from '@kangjuhyup/rvlog';
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
  structuredLogger.event('application.started', { port });
}

export function logNestUserCreated(createdUser: { id: number; email: string }) {
  structuredLogger.event(
    'user.created',
    {
      userId: createdUser.id,
      emailDomain: createdUser.email.split('@')[1] ?? 'unknown',
    },
    LogLevel.INFO,
  );
}
