# FAQ

## Metadata Requirements

These requirements are not specific to `@MaskLog`. They are the baseline for metadata-driven `rvlog` features in general.

### 1. Check that `reflect-metadata` is imported before your app boots

Decorators in `rvlog` rely on runtime metadata. Import `reflect-metadata` once, as early as possible in your entry point:

```ts
import 'reflect-metadata';
```

Example:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
```

You should load it when you use:

- `@Logging`
- `@MaskLog`
- runtime DTO metadata used by `rvlog-nest`
- any flow that depends on `design:paramtypes` or `design:type`

Without it, decorator metadata may be missing or incomplete, which affects:

- field masking
- plain-object masking for framework payloads
- parameter-type detection
- nested DTO metadata lookup

### 2. Check your `tsconfig.json`

These options should be enabled:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

If these options are disabled, `rvlog` can still run, but metadata-driven behavior may stop working or become less accurate.

## When `@MaskLog` Does Not Work

`@MaskLog` reads field metadata and masks values right before logging. If the metadata or runtime type information is missing, plain values may appear in logs.

### 1. Check that DTOs are not imported with `import type`

If you import a DTO like this:

```ts
import type { CreateUserDto } from './create-user.dto';
```

the class disappears at runtime, so parameter type metadata cannot point back to the DTO.

Use a normal import instead:

```ts
import { CreateUserDto } from './create-user.dto';
```

This matters especially when `@Logging` or `rvlog-nest` needs parameter metadata to mask plain framework payloads.

### 2. NestJS `@Body()` is often a plain object

NestJS commonly passes `@Body()` as a plain object instead of a DTO instance.

`rvlog` and `rvlog-nest` try to mask these payloads using runtime type metadata, but that only works reliably when:

- DTO classes are preserved at runtime
- `reflect-metadata` is loaded
- `emitDecoratorMetadata` is enabled

Example:

```ts
@Post()
async create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### 3. Check that `@MaskLog` is placed on fields

The decorator should be applied to the actual DTO fields you want to mask:

```ts
export class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;
}
```

### 4. Check that the log path goes through `rvlog`

Masking applies on these paths:

- `@Logging`
- `withLogging()`
- `rvlog-nest` HTTP request/response logging
- `maskObject()` or internal rvlog masking paths

It does not apply if you bypass `rvlog`, for example:

- `console.log(dto)`
- custom `JSON.stringify(dto)` outside rvlog

## Most Common Causes

The most common causes are:

- importing DTOs with `import type`
- missing `reflect-metadata`
- missing `emitDecoratorMetadata`

## Expected Log Example

Working as expected:

```txt
[INF] 2026:04:23 16:48:11 UserService :: create() called {"name":"K***g","email":"ab***@abc.com"}
```

Not masked:

```txt
[INF] 2026:04:23 16:48:11 UserService :: create() called {"name":"Kang","email":"abc@abc.com"}
```
