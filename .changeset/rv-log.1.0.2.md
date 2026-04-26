---
"@kangjuhyup/rvlog": patch
"@kangjuhyup/rvlog-react": patch
"@kangjuhyup/rvlog-nest": patch
---

0.1.2 로깅 사용성 및 어댑터 안정성 개선 릴리즈입니다.

- `pretty` 옵션 객체를 추가해 구분자, 타임스탬프 표시 여부, 레벨 라벨, 레벨별 색상을 커스텀할 수 있도록 개선
- `defineLoggerOptions()`를 추가해 재사용 가능한 로거 설정 객체의 타입 안정성 보강
- `LoggerSystem` 기반 격리 로깅과 구조화 메타데이터(`tags`, `fields`) 사용성 개선
- 배열 데이터와 raw JSON request body의 `@MaskLog` 마스킹 처리 보강
- `@kangjuhyup/rvlog/node` 서브패스 export 해석 안정성 개선
