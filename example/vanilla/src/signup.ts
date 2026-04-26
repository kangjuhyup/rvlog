import { MaskLog, withLogging } from '@kangjuhyup/rvlog';

export class SignupInput {
  @MaskLog({ type: 'email' })
  email!: string;

  @MaskLog({ type: 'full' })
  password!: string;

  nickname!: string;
}

async function signupImpl(input: SignupInput): Promise<{ id: string }> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  return { id: crypto.randomUUID(), nickname: input.nickname } as { id: string };
}

function failSignupImpl(): never {
  throw new Error('Simulated vanilla signup failure');
}

// withLogging 으로 감싸면 @Logging 데코레이터와 동일하게
// 진입/완료/에러/duration 로그가 자동으로 찍힌다.
// @MaskLog 규칙도 그대로 적용되어 email/password 값이 마스킹된다.
export const signup = withLogging(signupImpl, { context: 'signup' });
export const failSignup = withLogging(failSignupImpl, { context: 'signup', name: 'failSignup' });
