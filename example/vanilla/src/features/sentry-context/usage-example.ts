import * as Sentry from '@sentry/browser';

export function attachVanillaUserToSentry(
  userId: string,
  email: string,
  nickname: string,
) {
  Sentry.setUser({
    id: userId,
    email,
    username: nickname,
  });
}
