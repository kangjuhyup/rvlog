# Performance Benchmark

This benchmark suite measures the runtime cost of core `rvlog` features across logging, masking, serialization, and request-context propagation.

## Environment

| | |
|---|---|
| **Node.js** | v24.13.0 |
| **Warmup** | 1,000 iterations |
| **Measured** | 10,000 iterations per scenario |
| **Console** | Suppressed during measurement to isolate CPU cost |
| **Last run** | 2026-04-23T08:22:14.744Z |

## Coverage

The current suite includes these groups:

- **Decorator**
  - `@Logging` on `noop`, light, nested, large-payload, and heavy workloads
  - disabled logging path via `minLevel: ERROR`
- **withLogging**
  - `noop`, light, and large-payload function wrapping
- **Logger**
  - simple `Logger.info()`
  - `pretty` formatter
  - large payload serialization
  - request-context / `requestId` resolution
  - level-filtered fast path
- **Masking**
  - plain object
  - plain-object fallback masking
  - decorated DTO instance
  - nested DTO
  - large payload object
- **Async**
  - async method baseline vs decorated logging

## Benchmark Summary

| Mechanism | Latest result |
|---|---|
| `@Logging` decorator (`noop`) | `21.57 us` mean |
| `@Logging` decorator (`light`) | `42.80 us` mean |
| `@Logging` decorator (`nested DTO`) | `39.48 us` mean |
| `@Logging` decorator (`large payload`) | `43.83 us` mean |
| `@Logging` decorator (`disabled`, large payload) | `5.56 us` mean |
| `withLogging()` (`noop`) | `2.73 us` mean |
| `withLogging()` (`light`) | `6.00 us` mean |
| `withLogging()` (`large payload`) | `6.58 us` mean |
| `Logger.info()` simple | `0.81 us` mean |
| `Logger.info()` with pretty formatter | `1.03 us` mean |
| `Logger.info()` with request context | `1.65 us` mean |
| `Logger.info()` with large-payload serialization | `10.32 us` mean |
| `Logger.info()` filtered by level | `0.14 us` mean |
| `maskObject()` plain object | `1.11 us` mean |
| `maskObject()` plain-object fallback | `0.68 us` mean |
| `maskObject()` decorated DTO | `1.80 us` mean |
| `maskObject()` nested DTO | `1.47 us` mean |
| `maskObject()` large payload | `49.34 us` mean |
| `async` bare | `0.43 us` mean |
| `async` logged | `4.35 us` mean |

## Result Analysis

Direct logger calls remained in the sub-microsecond range for the simplest path. A simple `Logger.info()` measured `0.81 us`, while enabling the `pretty` formatter increased the mean to `1.03 us`. This indicates that formatter selection and formatted string construction add only a limited incremental cost when the payload itself is small.

Request-context propagation produced a measurable but still modest increase in direct logger cost. The `request-context` scenario measured `1.65 us`, compared with `0.81 us` for the simple logger path. The difference reflects the additional context lookup required to attach `requestId` to each record.

Large payload handling shifted the cost profile from logger dispatch to serialization and masking work. `Logger.info(): serialize-large` measured `10.32 us`, while `maskObject(): large-payload` measured `49.34 us`. The increase is consistent with the additional processing required for string truncation, array limiting, object-key limiting, and nested traversal.

Decorator-based logging was governed primarily by wrapper-side processing rather than the underlying method body for small and medium workloads. The `noop`, `light`, `nested`, and `large-payload` decorator scenarios were distributed between `21.57 us` and `43.83 us`, indicating that timing, masking, message construction, and completion logging account for most of the observed overhead in these cases.

The disabled logging path reduced, but did not eliminate, decorator cost. The `large-payload:disabled` scenario still measured `5.56 us`, which shows that suppressing final log emission through `minLevel: ERROR` does not remove wrapper-side masking and message preparation.

`withLogging()` remained materially lighter than the class-decorator path under equivalent workload shapes. The measured range of `2.73 us` to `6.58 us` suggests that function wrapping avoids part of the prototype-level work associated with decorator-based instrumentation while preserving the same observable logging behavior.

The `heavy` scenario should be interpreted with caution. In this execution, the measured overhead appeared negative because array allocation and sort cost dominated the run, and the fixed logging overhead was smaller than the benchmark noise at that workload size.

## Overhead Highlights

| Scenario | Baseline | With rvlog | Overhead |
|---|---:|---:|---:|
| Decorator `noop` | `0.56 us` | `21.57 us` | `+21.01 us` |
| Decorator `light` | `3.98 us` | `42.80 us` | `+38.82 us` |
| Decorator `nested` | `0.24 us` | `39.48 us` | `+39.24 us` |
| Decorator `large-payload` | `0.27 us` | `43.83 us` | `+43.56 us` |
| Decorator `large-payload:disabled` | `0.27 us` | `5.56 us` | `+5.29 us` |
| `withLogging()` `noop` | `0.12 us` | `2.73 us` | `+2.61 us` |
| `withLogging()` `light` | `0.52 us` | `6.00 us` | `+5.48 us` |
| `withLogging()` `large-payload` | `0.09 us` | `6.58 us` | `+6.49 us` |
| Logger `pretty` | `0.81 us` | `1.03 us` | `+0.23 us` |
| Logger `serialize-large` | `0.81 us` | `10.32 us` | `+9.51 us` |
| Logger `request-context` | `0.81 us` | `1.65 us` | `+0.85 us` |
| Async logged | `0.43 us` | `4.35 us` | `+3.92 us` |

## Reproducing

```bash
pnpm benchmark
```

The benchmark runner is located at [`benchmark/index.ts`](./index.ts). It prints the latest measured values directly in the terminal, so this report intentionally documents **scope and interpretation** rather than hard-coding one machine's numbers forever.
