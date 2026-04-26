import './logger.config';
import * as Sentry from '@sentry/browser';
import { Logger } from '@kangjuhyup/rvlog';
import { failSignup, signup, SignupInput } from './signup';

const logger = new Logger('main');
const status = document.getElementById('status')!;

function setStatus(text: string): void {
  status.textContent = text;
}

document.getElementById('info-btn')!.addEventListener('click', async () => {
  const input = Object.assign(new SignupInput(), {
    email: 'user@example.com',
    password: 'super-secret',
    nickname: 'rvlog-user',
  });
  const result = await signup(input);
  Sentry.setUser({
    id: result.id,
    email: input.email,
    username: input.nickname,
  });
  setStatus(`signup ok · id=${result.id.slice(0, 8)}…`);
});

document.getElementById('warn-btn')!.addEventListener('click', () => {
  logger.warn('something is off but recoverable');
  setStatus('warn logged -> Sentry Logs (DSN 설정 시 전송)');
});

document.getElementById('context-btn')!.addEventListener('click', () => {
  logger.info('browser context check', {
    browserKey: window.localStorage.getItem('rvlog.browserKey'),
    hasUser: Boolean(Sentry.getCurrentScope().getUser()?.id),
  });
  setStatus('context info logged -> Sentry Logs (DSN 설정 시 전송)');
});

document.getElementById('error-btn')!.addEventListener('click', () => {
  try {
    failSignup();
  } catch {
    // withLogging이 내부에서 이미 error 로그 + Sentry Issue/Event 전송까지 처리했다.
    setStatus('error logged -> Sentry Issue/Event (DSN 설정 시 전송)');
  }
});
