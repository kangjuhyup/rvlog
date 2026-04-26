# AGENTS

이 문서는 이 저장소에서 작업하는 모든 AI 에이전트를 위한 공통 가이드입니다.

적용 대상:
- Claude
- Cursor
- Codex

공통 문서 위치:
- 역할 문서: `.agents/`
- 스킬 문서: `.skills/`

우선순위:
1. 사용자 요청
2. 저장소의 명시적 설정 파일
3. 이 문서

## Project Overview

`rvlog`는 TypeScript 기반 로깅 라이브러리 모노레포입니다.

주요 패키지:
- `@kangjuhyup/rvlog`
- `@kangjuhyup/rvlog-react`
- `@kangjuhyup/rvlog-nest`

예제 앱:
- `example/basic`
- `example/express`
- `example/nestjs`
- `example/react`
- `example/vanilla`

## Working Principles

- 공개 API 변경 시 관련 README와 JSDoc를 함께 갱신합니다.
- 구조 변경 시 테스트 파일 경로와 import도 함께 정리합니다.
- 예제 코드는 라이브러리 코드와 분리해서 다룹니다.
- 빌드 산출물(`dist`, `dist-benchmark`)은 테스트/커버리지 대상에서 제외합니다.
- 사용자가 요청하지 않은 파괴적 git 명령은 사용하지 않습니다.

## Commands

기본 개발 명령:

```bash
npm install
npm test
npm run build
npm run pack:check:all
```

릴리즈 관련 명령:

```bash
npm run changeset
npm run changeset:version
npm run release
```

## Release Notes

- 릴리즈는 Changesets + GitHub Actions 기반으로 관리합니다.
- `main`에 changeset이 머지되면 release branch와 Version PR이 생성됩니다.
- 실제 npm publish는 Version PR 머지 후 실행됩니다.
- npm publish 전에는 `npm run pack:check:all` 결과를 우선 확인합니다.

## Code Style

- TypeScript는 가능한 한 명확한 이름을 사용합니다.
- 클래스는 orchestration 중심으로 유지하고, 순수 계산/변환 로직은 유틸로 분리합니다.
- 큰 구조 변경 시 모듈 디렉토리 단위로 정리합니다.
- 테스트는 공개 동작 테스트와 분리된 유틸 테스트를 함께 유지합니다.
- 파일 분리는 "한 파일 한 책임"보다 "한 파일 한 변화 이유"를 우선 기준으로 봅니다.
- 클래스 전용의 작은 타입과 인터페이스는 같은 파일 또는 같은 모듈 경계에 두는 것을 우선합니다.
- 여러 파일에서 재사용되는 타입은 모듈 단위 `types.ts`로 분리합니다.
- 순수 보조 함수는 `utils.ts`, 상수는 `constants.ts`처럼 역할이 드러나는 이름을 사용합니다.
- `property`처럼 형태만 설명하는 디렉토리명보다는 `types`, `utils`, `constants`, `contracts`처럼 책임이 보이는 구조를 선호합니다.

## Documentation

- 공개 API는 `src/index.ts`와 실제 선언 위치 모두에서 이해 가능해야 합니다.
- 패키지 README는 영어/한글 문서를 분리할 수 있습니다.
- 배포 절차 변경 시 `RELEASE.md`를 함께 갱신합니다.

## AI-Specific Guidance

- Claude, Cursor, Codex는 모두 이 문서를 공통 기준으로 참조합니다.
- 도구별 전용 문서가 있어도, 공통 규칙의 원본은 이 문서로 유지합니다.
- 도구별 설정 파일은 이 문서를 참조하는 얇은 포인터로 유지합니다.
- 공통 역할은 `.agents/`에 둡니다.
- 공통 작업 절차는 `.skills/`에 둡니다.
- 구현 작업은 가능하면 다음 순서를 따릅니다:
  1. 설계
  2. 코드 작성
  3. 테스트/검증
  4. 리뷰
  5. 문서 반영
  6. 커밋
