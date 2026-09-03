# Nest Final HTTP Status Logging Design

## Context

`@kangjuhyup/rvlog-nest` currently records HTTP failures inside
`RvlogHttpInterceptor`. Nest executes guards before interceptors, so a guard
that rejects a request with 401 or 403 never enters the interceptor and never
produces an rvlog HTTP status log. The interceptor also observes thrown errors
before Nest exception filters produce the response, which means
`response.statusCode` is not a reliable final-status boundary.

The package must record every final HTTP 4XX response at `WARN` and every final
HTTP 5XX response at `ERROR`, exactly once per request. It must retain the
existing request id/context, `excludePaths`, request call logs, normal
completion logs, logger-system isolation, and public HTTP logging options.

## Requirements

- Observe the response after guards, pipes, controllers, and exception filters
  have completed their work.
- Record final status codes 400 through 499 at `WARN`.
- Record final status codes 500 and above at `ERROR`.
- Preserve normal 2XX/3XX completion logging at the configured HTTP level.
- Emit only one terminal HTTP log per request. A request call log is not a
  terminal log and remains unchanged.
- Do not put query, body, headers, tokens, response bodies, exception messages,
  exception objects, or exception stacks in 4XX/5XX terminal logs or their
  notification contexts.
- Preserve the current payload options and masking behavior for backward
  compatibility on request call logs and successful response completion logs.
- Preserve request id propagation and configured response request-id headers.
- Preserve `excludePaths`: excluded requests retain request context propagation
  but emit no package-owned HTTP call or terminal logs.
- Preserve direct use of the exported interceptor when module middleware is not
  installed, using a safe payload-free fallback failure log.
- Do not add Express- or Fastify-specific dependencies.

## Considered Approaches

### 1. Middleware response-finish observer with shared request state

The request-context middleware runs before guards and can subscribe to the
underlying Node response `finish` event. The final observer reads the response
status after Nest exception filters and coordinates terminal logging with the
interceptor through internal request state.

This is the selected approach because it covers thrown exceptions and explicit
4XX responses while remaining independent of exception-filter ordering.

### 2. Global exception filter

A package-owned global filter could see guard, pipe, and controller exceptions,
but it would not cover non-exception 4XX responses. Its view may also precede a
different filter's response transformation, so it cannot guarantee the final
status without affecting application filter ordering.

### 3. HTTP-adapter-specific hooks

Express and Fastify hooks can observe final responses, but this requires
adapter-specific registration, dependencies, and compatibility testing. That
complexity is unnecessary because both adapters ultimately expose a Node-style
response lifecycle to Nest middleware.

## Architecture

### Internal lifecycle state

A focused internal module will own request lifecycle coordination. It will use
a `WeakMap<object, HttpRequestLoggingState>` keyed by the canonical raw request
(`request.raw ?? request`) so Express/raw and Fastify/wrapper paths share the
same state without adding enumerable application request properties or public
types. Initialization is idempotent so repeated middleware registration cannot
install independent terminal-log state for the same request.

The state contains only logging coordination data:

- request id
- method and path
- start time
- excluded flag
- whether the interceptor was entered
- the last already-sanitized successful response payload, when enabled
- whether a terminal log was emitted
- whether a final-response observer was installed

It must not retain request query, body, headers, tokens, or thrown exception
objects. The lifecycle module exposes narrow operations rather than the map
itself so deduplication remains centralized.

### Request-context middleware

The middleware continues resolving the request id and setting the configured
response header before calling downstream middleware. Inside the request
context scope it creates lifecycle state and, for non-excluded paths, attaches
a one-shot `finish` listener to the response or its raw Node response.

The finish listener explicitly re-enters `runWithRvlogRequestContext` using the
captured request id. This prevents loss of request context when the response was
created outside the `AsyncLocalStorage` scope.

At finish, the observer reads the actual status code and atomically claims the
terminal-log slot:

- 200-399: emit the existing completion message only if the interceptor ran;
  include the interceptor's already-masked response payload when enabled.
- 400-499: emit one `WARN` message with method, path, status, and duration.
- 500 and above: emit one `ERROR` message with method, path, status, and
  duration, followed by the existing explicit error notification using an
  empty `args` array and no `error` field.

For 4XX, `logger.warn` remains the single log emission; the core logger's normal
notification routing may forward that WARN according to configured notification
rules. No second explicit notification call is made.

Excluded requests do not install a finish observer. They still run inside the
request context and may receive the configured request-id response header.

### HTTP interceptor

The interceptor continues to:

- skip non-HTTP and excluded requests;
- create the request call log at the configured level;
- build request payloads using the existing options and masking behavior;
- propagate the request id when middleware state is absent.

When middleware lifecycle state exists, the interceptor marks itself entered,
stores only an already-masked successful response payload, forwards values and
errors unchanged, and leaves every terminal log to the finish observer. It does
not store or log the thrown exception.

When lifecycle state does not exist, direct interceptor use retains a fallback
terminal path. The fallback derives an HTTP status from an exception's
`getStatus()` method when available, otherwise from `response.statusCode`, then
uses `WARN` for 4XX or `ERROR` for 5XX. The fallback message and notification
context remain payload-free.

### Message contract

Successful responses retain the current form:

```text
POST /users completed 201 (10.25ms)
```

Final client and server failures use the current `failed` terminology:

```text
POST /users failed 401 (10.25ms)
POST /users failed 500 (10.25ms)
```

Failure logs pass no additional logger arguments. Notification contexts use
`className`, `methodName`, an empty `args` array, `duration`, and `timestamp`;
they contain no exception or request payload.

## Data Flow

1. Middleware resolves request id, determines exclusion, initializes state, and
   subscribes to response finish.
2. Guard rejection bypasses the interceptor; Nest's filter writes 401/403; the
   finish observer logs one WARN.
3. For an accepted request, the interceptor logs the call and marks entry.
4. A pipe/controller exception is forwarded without an interceptor error log;
   the selected exception filter writes the response.
5. A successful controller result is retained only as an already-sanitized
   response payload when response logging is enabled.
6. Response finish reads the final status and emits exactly one terminal log.
7. The `WeakMap` entry becomes collectible with the request object.

## Error Handling and Compatibility

- Missing response lifecycle methods do not break the request. The interceptor
  fallback remains available for routes that enter it; no unsafe response
  monkey-patching is introduced.
- Non-Error throws are forwarded exactly as received and are never stringified
  into terminal logs.
- An exception filter may convert an error into any status; the final status,
  not the original exception type, determines WARN versus ERROR.
- The package prevents duplicates generated by `rvlog-nest`. Application code
  that explicitly logs inside a guard or exception filter remains outside the
  package's deduplication boundary.
- No public configuration field or exported type is removed or renamed.

## Test Strategy

Add lifecycle-focused tests using real `RvlogRequestContextMiddleware` and
`RvlogHttpInterceptor` instances with a Node-style event-emitting response.
Each test will assert console/transport-visible behavior rather than internal
state:

- guard-like 401 and 403 responses produce one WARN each without interceptor
  entry;
- pipe/handler `HttpException` 4XX produces one WARN and no ERROR/completion;
- a handler that completes with an explicit 4XX status produces one WARN and no
  normal completion log;
- a normal 2XX response retains one call and one configured-level completion;
- a final 5XX response produces one ERROR and one safe explicit notification;
- an exception-filter-like status transformation is logged at the transformed
  final level;
- excluded paths produce no package-owned HTTP logs;
- repeated finish signals do not duplicate terminal logs;
- Fastify-shaped raw middleware requests and interceptor wrappers share one
  lifecycle and one terminal log;
- repeated middleware initialization for one request remains idempotent;
- request id remains present in finish-time logs;
- terminal 4XX/5XX logs and notification contexts contain none of the supplied
  body, query, header, token, response, or exception sentinel values;
- standalone interceptor failure logging remains safe and level-correct.

Run the focused Nest test project first, then the package build, full repository
tests, and package dry-run validation. Build artifacts remain excluded from
coverage and are not manually edited.

## Documentation

Update `packages/rvlog-nest/README.md` and `README-KR.md` to explain that terminal
HTTP levels are status-driven, guards are covered by middleware finish
observation, failure logs are payload-free, and `excludePaths` still preserves
request context while suppressing HTTP logs.

No release, commit, push, pull request, or deployment action is part of this
work.
