import { reactLoggerSystem } from '../logger-system';

const structuredLogger = reactLoggerSystem
  .createLogger('structured-metadata')
  .withTags({
    example: 'react',
    feature: 'structured-metadata',
  })
  .withFields({
    runtime: 'browser',
    framework: 'react',
  });

export function logSignupSuccessMetrics(userId: string, email: string, nickname: string) {
  structuredLogger
    .child({
      tags: { action: 'signup-success' },
      fields: {
        userId,
        emailDomain: email.split('@')[1] ?? 'unknown',
        nickname,
      },
    })
    .info('react example emitted structured metrics-style log');
}

export function logReactInfoExample() {
  structuredLogger
    .child({
      tags: { action: 'emit-info' },
      fields: { source: 'useSignup.emitInfo' },
    })
    .info('react info example with tags and fields');
}

export function logReactWarnExample() {
  structuredLogger
    .child({
      tags: { action: 'emit-warn' },
      fields: { source: 'useSignup.emitWarn' },
    })
    .warn('react warn example with tags and fields');
}
