import { basicLoggerSystem } from '../logger-system';

const structuredLogger = basicLoggerSystem
  .createLogger('structured-metadata')
  .withTags({
    example: 'basic',
    feature: 'structured-metadata',
  })
  .withFields({
    runtime: 'node',
    transport: 'file',
  });

export function logBasicUserCreated(createdUser: {
  id: number;
  email: string;
  phoneNumber: string;
}) {
  structuredLogger
    .child({
      tags: { action: 'user-created' },
      fields: {
        userId: createdUser.id,
        emailDomain: createdUser.email.split('@')[1] ?? 'unknown',
        hasPhoneNumber: Boolean(createdUser.phoneNumber),
      },
    })
    .info('basic example emitted structured metrics-style log');
}
