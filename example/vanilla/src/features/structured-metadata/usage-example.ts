import { vanillaLoggerSystem } from '../logger-system';

const structuredLogger = vanillaLoggerSystem
  .createLogger('structured-metadata')
  .withTags({
    feature: 'signup',
    surface: 'vanilla-example',
  })
  .withFields({
    app: 'rvlog-vanilla-example',
  });

export function logVanillaSignupSuccess(result: { id: string }, nickname: string) {
  structuredLogger
    .child({
      tags: { action: 'signup-success' },
      fields: {
        userId: result.id,
        nickname,
      },
    })
    .info('signup completed with metrics tags');
}

export function logVanillaContextCheck(browserKey: string | null, hasUser: boolean) {
  structuredLogger
    .child({
      tags: { action: 'context-check' },
      fields: {
        browserKey,
        hasUser,
      },
    })
    .info('browser context check');
}

export function logVanillaErrorExampleExecuted() {
  structuredLogger
    .child({
      tags: { action: 'signup-error' },
      fields: { expected: true },
    })
    .warn('error example executed');
}
