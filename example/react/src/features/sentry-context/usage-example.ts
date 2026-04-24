import * as Sentry from '@sentry/browser';

export function attachSignupUserToSentry(
  userId: string,
  userEmail: string,
  nickname: string | null,
) {
  Sentry.setUser({
    id: userId,
    email: userEmail,
    username: nickname ?? undefined,
  });
}
