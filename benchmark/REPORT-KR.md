# 성능 벤치마크

이 벤치마크 스위트는 `rvlog` 코어의 로깅, 마스킹, 직렬화, 요청 컨텍스트 전파 비용을 함께 측정합니다.

## 환경

| | |
|---|---|
| **Node.js** | v24.13.0 |
| **워밍업** | 1,000회 |
| **측정 횟수** | 시나리오당 10,000회 |
| **콘솔 출력** | CPU 비용만 분리해서 측정하기 위해 측정 중 비활성화 |
| **마지막 실행** | 2026-04-23T08:22:14.744Z |

## 측정 범위

현재 스위트는 다음 그룹을 포함합니다.

- **Decorator**
  - `noop`, light, nested, large-payload, heavy 작업에 대한 `@Logging`
  - `minLevel: ERROR` 기준 비활성화 경로
- **withLogging**
  - `noop`, light, large-payload 함수 래핑
- **Logger**
  - 단순 `Logger.info()`
  - `pretty` formatter
  - 큰 payload 직렬화
  - request-context / `requestId` resolver
  - 레벨 필터 fast path
- **Masking**
  - 일반 객체
  - plain-object fallback 마스킹
  - `@MaskLog`가 붙은 DTO 인스턴스
  - 중첩 DTO
  - 큰 payload 객체
- **Async**
  - async 메서드 baseline vs 데코레이터 적용

## 벤치마크 요약

| 메커니즘 | 최신 결과 |
|---|---|
| `@Logging` 데코레이터 (`noop`) | 평균 `21.57 us` |
| `@Logging` 데코레이터 (`light`) | 평균 `42.80 us` |
| `@Logging` 데코레이터 (nested DTO) | 평균 `39.48 us` |
| `@Logging` 데코레이터 (large payload) | 평균 `43.83 us` |
| `@Logging` 데코레이터 (`disabled`, large payload) | 평균 `5.56 us` |
| `withLogging()` (`noop`) | 평균 `2.73 us` |
| `withLogging()` (`light`) | 평균 `6.00 us` |
| `withLogging()` (`large payload`) | 평균 `6.58 us` |
| 단순 `Logger.info()` | 평균 `0.81 us` |
| `pretty` formatter가 켜진 `Logger.info()` | 평균 `1.03 us` |
| request context가 켜진 `Logger.info()` | 평균 `1.65 us` |
| 큰 payload 직렬화가 켜진 `Logger.info()` | 평균 `10.32 us` |
| 레벨 필터에 걸린 `Logger.info()` | 평균 `0.14 us` |
| `maskObject()` 일반 객체 | 평균 `1.11 us` |
| `maskObject()` plain-object fallback | 평균 `0.68 us` |
| `maskObject()` decorated DTO | 평균 `1.80 us` |
| `maskObject()` nested DTO | 평균 `1.47 us` |
| `maskObject()` large payload | 평균 `49.34 us` |
| `async` bare | 평균 `0.43 us` |
| `async` logged | 평균 `4.35 us` |

## 실행 결과 분석

직접 logger 호출 경로는 가장 단순한 형태에서 여전히 낮은 비용을 유지하였다. 단순 `Logger.info()`는 평균 `0.81 us`, `pretty` formatter를 적용한 경우는 평균 `1.03 us`로 측정되었다. 이 수치는 payload 자체가 작을 때 formatter 선택과 포맷 문자열 생성이 제한적인 추가 비용만 유발함을 보여준다.

request-context 전파는 직접 logger 비용을 증가시키지만 그 규모는 제한적이었다. `request-context` 시나리오는 `1.65 us`로 측정되었으며, 이는 단순 logger 경로의 `0.81 us` 대비 `requestId` 조회가 추가되었기 때문이다.

큰 payload가 포함된 경우에는 logger dispatch보다 직렬화와 마스킹 비용이 지배적으로 나타났다. `Logger.info(): serialize-large`는 `10.32 us`, `maskObject(): large-payload`는 `49.34 us`로 측정되었다. 이 차이는 문자열 절단, 배열 제한, 객체 키 제한, 중첩 순회 비용이 함께 반영된 결과이다.

데코레이터 기반 로깅은 작은 작업과 중간 규모 작업에서 원본 메서드보다 래퍼 처리 비용의 영향을 더 크게 받았다. `noop`, `light`, `nested`, `large-payload` 시나리오는 `21.57 us`에서 `43.83 us` 범위에 분포하였으며, 이는 timing, masking, 메시지 생성, 완료 로그 기록이 주요 비용 요소임을 시사한다.

로그 출력을 `minLevel: ERROR`로 비활성화하더라도 데코레이터 비용은 완전히 제거되지 않았다. `large-payload:disabled` 시나리오가 `5.56 us`로 측정된 점은 최종 출력은 우회되더라도 래퍼 내부의 마스킹과 메시지 준비가 계속 수행됨을 보여준다.

`withLogging()`은 동일한 의미의 자동 로깅을 제공하면서도 클래스 데코레이터 경로보다 낮은 비용을 보였다. 측정값은 `2.73 us`에서 `6.58 us` 범위였으며, 이는 함수 래핑 방식이 prototype 수준의 처리 일부를 피하기 때문으로 해석할 수 있다.

`heavy` 시나리오는 해석 시 주의가 필요하다. 이번 실행에서는 오버헤드가 음수처럼 관측되었는데, 이는 배열 생성과 정렬 비용이 고정 로깅 비용보다 훨씬 크고, 그 결과 측정 오차가 차이를 덮었기 때문이다.

## 오버헤드 하이라이트

| 시나리오 | Baseline | rvlog 적용 | 오버헤드 |
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

## 재현 방법

```bash
pnpm benchmark
```

벤치마크 실행기는 [`benchmark/index.ts`](./index.ts)에 있습니다. 최신 수치는 실행 환경에 따라 달라질 수 있으므로, 이 문서는 고정 수치보다 **측정 범위와 해석 기준**을 중심으로 설명합니다.
