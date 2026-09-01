# Nest Final HTTP Status Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every final Nest HTTP 4XX response once at WARN and every final 5XX response once at ERROR, including guard failures, without leaking failure payloads or duplicating normal completion logs.

**Architecture:** `RvlogRequestContextMiddleware` installs a one-shot response-finish observer before guards and owns terminal logging from the final status. A private `WeakMap` lifecycle module coordinates with `RvlogHttpInterceptor`, which keeps call logging but defers completion/failure logging whenever the finish observer is active.

**Tech Stack:** TypeScript 5.7, NestJS 10/11 APIs, RxJS 7, Node `AsyncLocalStorage` and `EventEmitter`, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-01-nest-final-http-status-logging-design.md`

## Global Constraints

- Final status 400-499 emits exactly one WARN terminal log.
- Final status 500 and above emits exactly one ERROR terminal log and one payload-free explicit ERROR notification.
- Final failure logs and notification contexts contain no request, response, token, exception message, exception object, or stack payload.
- Existing HTTP options, successful request/completion payload behavior, request id/context propagation, and `excludePaths` remain compatible.
- Do not add Express- or Fastify-specific dependencies.
- Do not edit generated `dist` files.
- Do not commit, push, open a PR, publish, or deploy.

---

### Task 1: Specify final-response behavior with failing integration tests

**Files:**
- Create: `packages/rvlog-nest/src/rvlog-http.lifecycle.test.ts`
- Reference: `packages/rvlog-nest/src/rvlog-http.interceptor.ts`
- Reference: `packages/rvlog-nest/src/rvlog-request-context.middleware.ts`

**Interfaces:**
- Consumes: current `RvlogRequestContextMiddleware.use(...)` and `RvlogHttpInterceptor.intercept(...)` public behavior.
- Produces: behavior-level fixtures that drive a request through the real middleware and interceptor using an event-emitting response.

- [ ] **Step 1: Add a real middleware/interceptor lifecycle fixture**

Create a `TestResponse extends EventEmitter` with mutable `statusCode`, a `setHeader` spy, and Node-compatible `once('finish', listener)`. Use one plain request object for both middleware and interceptor, and a minimal execution context whose handler metadata has no parameters.

```ts
class LifecycleController {
  handle() {
    return { ok: true };
  }
}

class TestResponse extends EventEmitter {
  statusCode = 200;
  readonly setHeader = vi.fn();
}

const request = {
  method: 'POST',
  originalUrl: '/votes',
  body: { password: 'body-secret' },
  query: { token: 'query-secret' },
  headers: {
    'x-request-id': 'req-final',
    authorization: 'Bearer header-secret',
  },
};
```

- [ ] **Step 2: Add Guard 401/403 and deduplication assertions**

Run middleware without entering the interceptor, assign status 401 and 403 in table-driven cases, emit `finish` twice, and assert exactly one `console.warn` call containing request id, method, path, and status. Assert no INFO completion or ERROR call.

```ts
expect(warnSpy).toHaveBeenCalledTimes(1);
expect(warnSpy.mock.calls[0]?.[0]).toContain(`[req-final] HTTP :: POST /votes failed ${status}`);
expect(errorSpy).not.toHaveBeenCalled();
```

- [ ] **Step 3: Add handler/Pipe-style 4XX and explicit 4XX assertions**

Enter the interceptor with `throwError(() => new HttpException('exception-secret', 422))`, simulate the exception filter by assigning status 422, then emit finish. In a separate case, let the interceptor emit normally while the response status is 409. Assert one WARN, zero ERROR, and no configured-level `completed 4XX` log.

- [ ] **Step 4: Add 2XX, transformed-status, 5XX, exclusion, and privacy assertions**

Cover:

- 201 with one call log and one completion log;
- a thrown error transformed by a filter to final 418, producing WARN;
- final 500 producing one ERROR and one explicit `Logger.notify(LogLevel.ERROR, ...)` call;
- `/health` excluded from all package-owned HTTP logs while retaining the response request-id header;
- failure console calls and notification context excluding `body-secret`, `query-secret`, `header-secret`, `response-secret`, and `exception-secret`.

For the 500 notification, assert the safe context literally:

```ts
expect(notifySpy).toHaveBeenCalledWith(
  LogLevel.ERROR,
  expect.stringContaining('POST /votes failed 500'),
  expect.objectContaining({
    className: 'HTTP',
    methodName: 'POST',
    args: [],
  }),
);
expect(notifySpy.mock.calls[0]?.[2]).not.toHaveProperty('error');
```

- [ ] **Step 5: Run the new test and verify RED**

Run:

```bash
npx vitest run --project nest packages/rvlog-nest/src/rvlog-http.lifecycle.test.ts
```

Expected: Guard cases fail because no finish observer exists; handler cases fail because the interceptor logs immediately with the pre-filter status and exception payload; explicit 4XX duplicates completion semantics.

---

### Task 2: Implement private request lifecycle coordination

**Files:**
- Create: `packages/rvlog-nest/src/rvlog-http.lifecycle.ts`
- Test: `packages/rvlog-nest/src/rvlog-http.lifecycle.test.ts`

**Interfaces:**
- Consumes: `Required<RvlogHttpLoggingOptions>`, optional `LoggerSystem`, `buildDuration`, and `runWithRvlogRequestContext`.
- Produces:
  - `initializeHttpRequestLogging(request, input): void`
  - `observeHttpResponseFinish(request, response, options, loggerSystem): boolean`
  - `enterHttpInterceptor(request): boolean`
  - `captureHttpResponsePayload(request, payload): void`
  - `resolveHttpFailureStatus(error, responseStatus): number`
  - `logHttpFailure(input): void`

- [ ] **Step 1: Create private lifecycle types and WeakMap state**

Use these internal shapes without exporting them from `src/index.ts`:

```ts
type HttpRequestLoggingState = {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
  excluded: boolean;
  interceptorEntered: boolean;
  observerInstalled: boolean;
  terminalLogged: boolean;
  responsePayload?: Record<string, unknown>;
};

const requestLoggingStates = new WeakMap<object, HttpRequestLoggingState>();
```

Every state operation resolves its key from the object-valued `request.raw ?? request`, allowing raw middleware requests and Fastify interceptor wrappers to coordinate. Initialization reuses an existing state instead of replacing it. State stores only the listed coordination fields and must not retain the request body, query, headers, or an exception.

- [ ] **Step 2: Implement one-shot final response observation**

Resolve the event target as the response itself when it has `once`, otherwise `response.raw`. Return `false` without throwing when neither is Node-event-compatible. Mark `observerInstalled` before registering `once('finish', ...)`.

The listener re-enters request context and atomically checks/sets `terminalLogged`. Resolve status from `response.statusCode`, then `response.raw?.statusCode`, then 200.

- [ ] **Step 3: Implement terminal log level and message routing**

Use status-driven branches:

```ts
if (statusCode >= 500) {
  logHttpFailure({ level: LogLevel.ERROR, ...safeFields });
} else if (statusCode >= 400) {
  logHttpFailure({ level: LogLevel.WARN, ...safeFields });
} else if (state.interceptorEntered) {
  logAtLevel(logger, options.level, completionMessage);
}
```

`logHttpFailure` calls `logger.warn(message)` for WARN. For ERROR it calls `logger.error(message)` with no additional argument, then calls `runtime.notify(LogLevel.ERROR, message, { className, methodName, args: [], duration, timestamp })` with no `error` field.

- [ ] **Step 4: Implement safe standalone status resolution**

`resolveHttpFailureStatus` invokes a duck-typed `getStatus()` only when it is a function and accepts only a finite numeric result. It catches a throwing getter and falls back to a finite response status or 500. It never converts the exception to text.

- [ ] **Step 5: Run lifecycle tests and verify they still fail only at integration points**

Run the focused lifecycle test. Expected: pure finalization behavior may pass when invoked through middleware later, but the suite remains RED because middleware and interceptor do not yet call the new lifecycle operations.

---

### Task 3: Connect middleware and interceptor to the final boundary

**Files:**
- Modify: `packages/rvlog-nest/src/rvlog-request-context.middleware.ts:22-56`
- Modify: `packages/rvlog-nest/src/rvlog-http.interceptor.ts:42-183`
- Modify: `packages/rvlog-nest/src/rvlog-http.interceptor.test.ts:193-217,377-406`
- Test: `packages/rvlog-nest/src/rvlog-http.lifecycle.test.ts`

**Interfaces:**
- Consumes: lifecycle operations from Task 2.
- Produces: middleware-owned final logging and payload-free standalone interceptor failure logging.

- [ ] **Step 1: Initialize and observe lifecycle state in middleware**

Extend the request type with `method`, `originalUrl`, and `url`; extend the response type with `statusCode`, `once`, and optional raw response. Resolve method/path and exclusion with the same defaults used by the interceptor.

Inside `runWithRvlogRequestContext({ requestId }, ...)`, initialize state, install the finish observer only for non-excluded paths, and then call `next()`.

- [ ] **Step 2: Defer observed terminal logging in interceptor**

After resolving request id, call `enterHttpInterceptor(request)`. Its boolean return is true only when the middleware installed a finish observer.

In `next`, build the existing masked response payload. When observed, store it and forward the value without logging completion. Otherwise retain the current immediate completion behavior.

In `error`, when observed, forward the original error without logging or retaining it. Otherwise resolve a safe status and call the shared payload-free `logHttpFailure` before forwarding the original error.

- [ ] **Step 3: Update standalone interceptor regression expectations**

Change the existing standalone 500 tests to require:

- one ERROR log with request id and status;
- no exception message or stack in the ERROR console call;
- one ERROR notification with `args: []` and no `error` property.

Add one standalone `HttpException` 400 case that expects one WARN, no ERROR, and no exception payload.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run --project nest packages/rvlog-nest/src/rvlog-http.lifecycle.test.ts packages/rvlog-nest/src/rvlog-http.interceptor.test.ts packages/rvlog-nest/src/rvlog-request-context.middleware.test.ts
```

Expected: all focused lifecycle, interceptor, and middleware tests pass with no unhandled RxJS errors.

- [ ] **Step 5: Refactor only after GREEN**

Remove duplicated message construction, keep lifecycle state private, and keep pure status/response-target resolution separate from middleware/interceptor orchestration. Re-run the same focused command and require GREEN.

---

### Task 4: Document, review, and verify the package

**Files:**
- Modify: `packages/rvlog-nest/README.md:5-97`
- Modify: `packages/rvlog-nest/README-KR.md:5-97`
- Review: all files changed by Tasks 1-3

**Interfaces:**
- Consumes: final tested status behavior.
- Produces: English/Korean consumer documentation and verification evidence.

- [ ] **Step 1: Update English documentation**

Document that middleware observes final response status, Guard/Pipe/controller/filter 4XX responses are WARN, 5XX responses are ERROR, failures are payload-free, normal completion remains configured-level, and excluded paths keep context without HTTP logs. Add representative 401 WARN and 500 ERROR lines.

- [ ] **Step 2: Update Korean documentation with the same contract**

Mirror the English behavior without adding new configuration fields or suggesting adapter-specific setup.

- [ ] **Step 3: Run focused and full verification**

Run in order:

```bash
npx vitest run --project nest
npm --prefix packages/rvlog-nest run build
npm test
npm --prefix packages/rvlog-nest run pack:check
```

Expected: all commands exit 0; package dry-run contains compiled lifecycle code and no source-only/test files outside the package's existing publication contract.

- [ ] **Step 4: Review privacy, duplication, API, and worktree scope**

Inspect `git diff --check`, `git diff -- packages/rvlog-nest docs/superpowers`, and `git status --short`. Confirm:

- no failure logger call passes an exception or request payload;
- no notification context includes `error` or non-empty `args`;
- only the finish observer logs terminal results when installed;
- no public export or option was removed;
- no pre-existing unrelated change was overwritten;
- no generated `dist` file is included in the source diff.

- [ ] **Step 5: Report without committing**

Report changed source/tests/docs, RED and GREEN evidence, final verification results, remaining adapter/event-boundary caveats, and explicitly state that no commit, push, PR, publish, or deployment was performed.
