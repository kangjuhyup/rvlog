# 릴리즈 설정

이 저장소는 `Changesets + GitHub Actions` 조합으로 여러 npm 패키지를 함께 릴리즈합니다.

## 릴리즈 대상 패키지

- `@kangjuhyup/rvlog`
- `@kangjuhyup/rvlog-react`
- `@kangjuhyup/rvlog-nest`
- `@kangjuhyup/rvlog-otel`
- `@kangjuhyup/rvlog-slack`
- `@kangjuhyup/rvlog-discord`
- `@kangjuhyup/rvlog-webhook`
- `@kangjuhyup/rvlog-sentry`
- `@kangjuhyup/rvlog-email`

## 최초 1회 설정

1. 기본 브랜치가 `main`인지 확인합니다.
2. npm publish 방식 하나를 선택합니다.
3. 토큰 방식을 쓰면 `bypass 2FA`가 켜진 granular token을 생성해 GitHub 저장소 secrets에 `NPM_TOKEN`으로 등록합니다.
4. trusted publishing을 쓰면 npm 패키지 설정에서 각 패키지에 GitHub Actions trusted publisher를 연결합니다.

## 평소 작업 흐름

1. 패키지 변경 작업을 합니다.
2. `npm run changeset`을 실행합니다.
3. 변경된 패키지와 버전 증가 방식(`patch`, `minor`, `major`)을 선택합니다.
4. 생성된 `.changeset/*.md` 파일을 커밋합니다.
5. 해당 변경을 `main`에 머지합니다.

## 여러 PR을 모아서 릴리즈하는 흐름

이 저장소의 기본 릴리즈 방식은 **배치 릴리즈**로 운영합니다.

기능 PR마다 npm publish를 바로 실행하지 않고, 각 PR에 changeset을 포함한 뒤 `main`에 순차적으로 머지합니다.  
Changesets가 자동으로 만든 **Version PR**은 릴리즈 후보를 모아두는 PR로 취급하고, 실제 배포할 시점까지 머지하지 않습니다.

권장 흐름은 아래와 같습니다.

1. 기능/수정 PR마다 필요한 `.changeset/*.md`를 포함합니다.
2. 각 PR은 일반 코드 리뷰와 CI 검증 후 `main`에 머지합니다.
3. 첫 changeset이 `main`에 들어오면 GitHub Actions가 Version PR을 생성합니다.
4. 이후 추가 PR이 `main`에 머지되면 같은 Version PR이 자동 갱신됩니다.
5. 릴리즈할 PR 묶음이 충분히 모이면 Version PR에서 버전, changelog, 포함 패키지를 검토합니다.
6. 필요하면 `npm run pack:check:all` 결과를 확인합니다.
7. Version PR을 머지하면 그 시점에 모인 변경만 npm publish 됩니다.

운영 규칙:

- Version PR은 “이번 릴리즈 묶음”이 확정될 때까지 열어둡니다.
- 릴리즈에서 제외할 PR은 Version PR 머지 전에 `main`에 머지하지 않습니다.
- 긴급 패치는 별도 브랜치/별도 changeset으로 처리하고, 필요한 경우 기존 Version PR과 분리해 릴리즈합니다.
- 한 PR에 여러 패키지 변경이 있으면 하나의 changeset에 관련 패키지를 함께 적습니다.
- 서로 독립적인 PR은 changeset 파일도 PR별로 분리해두면 Version PR changelog를 검토하기 쉽습니다.

## 머지 후 자동으로 일어나는 일

아직 배포되지 않은 changeset이 포함된 커밋이 `main`에 들어오면 `Release` 워크플로우가 자동 실행됩니다.

이 첫 실행에서 바로 npm publish가 되지는 않습니다.
대신 Changesets가 아래 작업을 수행합니다.

1. Changesets가 관리하는 **release branch**를 자동으로 생성하거나 갱신합니다.
2. 그 브랜치에서 **Version PR**을 자동으로 생성하거나 갱신합니다.
3. 이 PR에는 아래 내용이 포함됩니다.
   - 배포 대상 패키지의 버전 변경
   - `.changeset/*.md`를 바탕으로 생성된 changelog 변경

## release branch와 Version PR

release branch는 `changesets/action`이 자동으로 만듭니다.  
직접 브랜치를 만들 필요는 없습니다.

실제 흐름은 보통 이렇게 됩니다.

1. changeset이 포함된 기능 변경을 `main`에 머지합니다.
2. GitHub Actions가 실행됩니다.
3. Changesets가 release branch를 생성하거나 갱신합니다.
4. Changesets가 **Version packages** PR을 생성하거나 갱신합니다.
5. 이 PR을 일반 릴리즈 PR처럼 검토합니다.
6. 검토가 끝나면 Version PR을 `main`에 머지합니다.

## npm publish는 언제 일어나는가

npm publish는 **Version PR이 머지된 뒤에** 실행됩니다.

조금 더 구체적으로 보면:

1. Version PR 머지로 인해 `main`에 다시 커밋이 들어옵니다.
2. `Release` 워크플로우가 다시 실행됩니다.
3. 이 시점에는 PR로 만들 unpublished changeset이 더 이상 없습니다.
4. Changesets가 “PR 생성/갱신 모드”에서 “publish 모드”로 전환합니다.
5. 워크플로우가 아래 패키지를 npm에 배포합니다.
   - `@kangjuhyup/rvlog`
   - `@kangjuhyup/rvlog-react`
   - `@kangjuhyup/rvlog-nest`
   - `@kangjuhyup/rvlog-otel`
   - `@kangjuhyup/rvlog-slack`
   - `@kangjuhyup/rvlog-discord`
   - `@kangjuhyup/rvlog-webhook`
   - `@kangjuhyup/rvlog-sentry`
   - `@kangjuhyup/rvlog-email`

## 한눈에 보는 요약

릴리즈 자동화는 2단계입니다.

1. changeset을 `main`에 머지
   결과: release branch와 Version PR이 자동 생성됨
2. Version PR을 머지
   결과: npm publish가 자동 실행됨

## 자주 쓰는 명령어

```bash
npm run changeset
npm run changeset:version
npm run release
npm run pack:check:all
```
