# FAQ

## 메타데이터 기본 조건

이 항목들은 `@MaskLog` 전용이 아니라, 메타데이터 기반 `rvlog` 기능 전반에 필요한 기본 조건입니다.

### 1. `reflect-metadata`를 앱 시작 시점에 먼저 import 했는지 확인

데코레이터 메타데이터를 읽으려면 엔트리 포인트에서 가장 먼저 `reflect-metadata`가 로드되어야 합니다.

```ts
import 'reflect-metadata';
```

예:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
```

아래 기능을 사용할 때는 함께 로드해야 합니다.

- `@Logging`
- `@MaskLog`
- `rvlog-nest`가 사용하는 런타임 DTO 메타데이터
- `design:paramtypes`, `design:type`에 의존하는 경로

이 값이 없으면 다음 기능이 깨지거나 부정확해질 수 있습니다.

- 필드 마스킹
- 프레임워크 payload에 대한 plain object 마스킹
- 파라미터 타입 추론
- nested DTO 메타데이터 조회

### 2. `tsconfig.json`에 데코레이터 메타데이터 옵션이 켜져 있는지 확인

아래 옵션이 필요합니다.

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

이 옵션이 빠지면 `@MaskLog` 자체는 붙어 있어도, 런타임 타입 정보가 부족해서 기대한 마스킹이 동작하지 않을 수 있습니다. `rvlog` 자체는 실행되더라도 메타데이터 기반 기능은 정확도가 떨어질 수 있습니다.

## `@MaskLog`가 동작하지 않을 때

`@MaskLog`는 필드에 붙은 메타데이터를 읽어서 로그 직전에 값을 마스킹합니다. 아래 조건이 맞지 않으면 평문이 그대로 찍힐 수 있습니다.

### 1. DTO를 `import type`으로 가져오지 않았는지 확인

다음처럼 `import type`으로 가져오면 런타임에 클래스 정보가 사라져서 파라미터 타입 메타데이터를 읽을 수 없습니다.

```ts
import type { CreateUserDto } from './create-user.dto';
```

다음처럼 일반 `import`를 사용해야 합니다.

```ts
import { CreateUserDto } from './create-user.dto';
```

이 문제는 특히 `@Logging`이 붙은 메서드가 DTO 타입 정보를 기준으로 마스킹할 때 중요합니다.

### 2. NestJS에서 `@Body()`가 plain object로 들어온다는 점 확인

NestJS의 `@Body()` 값은 DTO 인스턴스가 아니라 plain object인 경우가 많습니다.  
rvlog는 메서드 파라미터 타입 메타데이터를 사용해 이 경우도 마스킹하도록 처리하지만, 위의 `import type` 문제나 메타데이터 설정 문제가 있으면 평문으로 남을 수 있습니다.

예:

```ts
@Post()
async create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

이 경우 `CreateUserDto`가 런타임에 실제 클래스로 남아 있어야 합니다.

### 3. raw JSON 문자열 파싱은 `rvlog-nest`에서만 처리

core 패키지인 `@kangjuhyup/rvlog`는 객체를 마스킹합니다. 임의의 문자열을 자동으로 JSON 파싱하지는 않습니다.

```ts
maskObject('{"email":"abc@abc.com"}'); // 문자열 그대로 유지
```

반면 `@kangjuhyup/rvlog-nest`는 HTTP request body라는 컨텍스트를 알고 있으므로, raw JSON 문자열 또는 `Buffer` body를 먼저 파싱한 뒤 DTO 메타데이터가 있으면 `@MaskLog`를 적용합니다. 파싱에 실패하면 원본 body를 유지하고 로깅은 계속 진행합니다.

즉 raw body 마스킹은 adapter 쪽 책임입니다.

- `rvlog`: 객체와 DTO 인스턴스를 마스킹하지만 문자열을 파싱하지 않음
- `rvlog-nest`: raw JSON request body를 파싱한 뒤 가능한 경우 `@MaskLog` 메타데이터 적용

### 4. `@MaskLog`를 DTO 필드에 붙였는지 확인

메서드 파라미터 자체가 아니라, 실제 마스킹할 필드에 붙어 있어야 합니다.

```ts
export class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;
}
```

### 5. 로그를 남기는 경로가 rvlog를 통하는지 확인

다음 경로에서는 `@MaskLog`가 적용됩니다.

- `@Logging`
- `withLogging()`
- `rvlog-nest` HTTP request/response logging
- `maskObject()`를 내부적으로 사용하는 rvlog 자동 로깅 경로

반대로 직접 `console.log(dto)` 하거나, rvlog 밖에서 객체를 직렬화하면 마스킹되지 않습니다.

- `console.log(dto)`
- rvlog 밖에서 직접 `JSON.stringify(dto)`

## 가장 흔한 원인

실제로 가장 자주 발생하는 원인은 아래 두 가지입니다.

- DTO를 `import type`으로 가져와서 런타임 메타데이터가 사라지는 경우
- `reflect-metadata` 또는 `emitDecoratorMetadata` 설정이 빠진 경우

## 기대 로그 예시

정상 동작 시:

```txt
[INF] 2026:04:23 16:48:11 UserService :: create() called {"name":"강*협","email":"ab***@abc.com"}
```

문제 상황:

```txt
[INF] 2026:04:23 16:48:11 UserService :: create() called {"name":"강주협","email":"abc@abc.com"}
```
