# 릴리즈 설정

이 저장소는 `Changesets + GitHub Actions` 조합으로 여러 npm 패키지를 함께 릴리즈합니다.

## 릴리즈 대상 패키지

- `@kangjuhyup/rvlog`
- `@kangjuhyup/rvlog-react`
- `@kangjuhyup/rvlog-nest`

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
