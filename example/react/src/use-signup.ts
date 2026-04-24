import { useCallback, useEffect, useMemo, useState } from "react";
import { useHookLogging } from "rvlog-react";
import { LogLevel, MaskLog } from "rvlog";
import {
  logReactInfoExample,
  logReactWarnExample,
  logSignupSuccessMetrics,
} from "./features/structured-metadata";
import { attachSignupUserToSentry } from "./features/sentry-context";
import { reactLoggerSystem } from "./features/logger-system";

export class SignupInput {
  @MaskLog({ type: "email" })
  email!: string;

  @MaskLog({ type: "full" })
  password!: string;

  nickname!: string;

  constructor(email: string, password: string, nickname: string) {
    this.email = email;
    this.password = password;
    this.nickname = nickname;
  }
}

type Status = "idle" | "running" | "success" | "error";

/**
 * 회원가입 흐름을 캡슐화한 도메인 훅.
 * 액션 로깅과 상태 변경 추적은 useHookLogging이 맡고,
 * 훅은 도메인 상태와 액션만 노출한다.
 */
export function useSignup() {
  const [status, setStatus] = useState<Status>("idle");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const { run, traceState } = useHookLogging("useSignup", { system: reactLoggerSystem });

  useEffect(() => {
    traceState("status", status);
  }, [status, traceState]);

  useEffect(() => {
    traceState("userId", userId);
  }, [traceState, userId]);

  useEffect(() => {
    if (!userId || !userEmail) {
      return;
    }

    attachSignupUserToSentry(userId, userEmail, nickname);
  }, [nickname, userEmail, userId]);

  const signupRequest = useMemo(
    () =>
      run("signup", async (input: SignupInput): Promise<{ id: string }> => {
        setStatus("running");
        await new Promise((resolve) => setTimeout(resolve, 150));

        const result = { id: crypto.randomUUID() };

        setUserId(result.id);
        setUserEmail(input.email);
        setNickname(input.nickname);
        setStatus("success");
        logSignupSuccessMetrics(result.id, input.email, input.nickname);
        return result;
      }),
    [run],
  );

  const failingRequest = useMemo(
    () =>
      run("triggerError", (): never => {
        setStatus("error");
        throw new Error("Simulated signup pipeline failure");
      }),
    [run],
  );

  const emitInfoRequest = useMemo(
    () =>
      run("emitInfo", async (): Promise<void> => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        logReactInfoExample();
      }),
    [run],
  );

  const emitWarnRequest = useMemo(
    () =>
      run(
        "emitWarn",
        async (): Promise<void> => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          logReactWarnExample();
        },
        LogLevel.WARN,
      ),
    [run],
  );

  const signup = useCallback(async (input: SignupInput) => {
    try {
      return await signupRequest(input);
    } catch {
      setStatus("error");
      throw undefined;
    }
  }, []);

  const triggerError = useCallback(() => {
    try {
      failingRequest();
    } catch {
      return;
    }
  }, []);

  const emitInfo = useCallback(async () => {
    await emitInfoRequest();
  }, [emitInfoRequest]);

  const emitWarn = useCallback(async () => {
    await emitWarnRequest();
  }, [emitWarnRequest]);

  return { status, userId, signup, triggerError, emitInfo, emitWarn };
}
