import { Logging, useLoggingContext } from "rvlog-react";
import { useSignup } from "./use-signup";

function AppContent() {
  const { trackEvent } = useLoggingContext();
  const { status, userId, signup, triggerError, emitInfo, emitWarn } = useSignup();

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 640,
      }}
    >
      <h1>rvlog · React (hook) + Sentry</h1>
      <p>
        <code>useLogger()</code> 훅으로 컴포넌트/도메인별{" "}
        <code>Logger</code>를 주입하고, ERROR 로그는{" "}
        <code>SentryChannel</code>을 통해 Sentry로 전송됩니다.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={trackEvent("click:signup", () => {
            void signup({
              email: "user@example.com",
              password: "super-secret",
              nickname: "rvlog-user",
            });
          })}
        >
          signup()
        </button>
        <button
          onClick={trackEvent("click:emit-info", () => {
            void emitInfo();
          })}
        >
          emit info log
        </button>
        <button
          onClick={trackEvent("click:emit-warn", () => {
            void emitWarn();
          })}
        >
          emit warn log
        </button>
        <button onClick={trackEvent("click:trigger-error", triggerError)}>
          trigger error → Sentry
        </button>
      </div>

      <dl style={{ marginTop: 16 }}>
        <dt>status</dt>
        <dd>
          <code>{status}</code>
        </dd>
        <dt>userId</dt>
        <dd>
          <code>{userId ?? "—"}</code>
        </dd>
      </dl>

      <p style={{ color: "#666", fontSize: 13 }}>
        DevTools 콘솔에서 pretty 포맷 로그를 확인하세요. DSN이 설정되지
        않았다면 Sentry로는 전송되지 않고 콘솔에만 남습니다. `emit info log`,
        `emit warn log` 버튼으로 Logs 적재를 바로 확인할 수 있습니다.
      </p>
    </main>
  );
}

export function App() {
  return (
    <Logging component="App">
      <AppContent />
    </Logging>
  );
}
