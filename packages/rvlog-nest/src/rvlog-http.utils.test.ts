import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { MaskLog } from '@kangjuhyup/rvlog';
import {
  assignPrototype,
  buildDuration,
  buildRequestPayload,
  buildResponsePayload,
  defaultMaskedHeaders,
  findBodyMetadataPrototype,
  getBodyParameterIndex,
  getHandlerParameterTypes,
  isPrimitiveWrapperPrototype,
  maskRequestBody,
  normalizeHeaders,
  parseJsonBody,
  resolveHttpLoggingOptions,
  resolveRequestId,
  shouldExcludePath,
} from './rvlog-http.utils';

class CreateUserDto {
  @MaskLog({ type: 'email' })
  email!: string;
}

class UserController {
  create(_body: CreateUserDto) {
    return 'ok';
  }
}

Reflect.defineMetadata('design:paramtypes', [CreateUserDto], UserController.prototype, 'create');
Reflect.defineMetadata(
  ROUTE_ARGS_METADATA,
  {
    [`${RouteParamtypes.BODY}:0`]: { index: 0 },
  },
  UserController.prototype.create,
);

function createContext() {
  return {
    getClass: () => UserController,
    getHandler: () => UserController.prototype.create,
  };
}

describe('rvlog http utils', () => {
  it('handles prototype helpers and route metadata - prototype 및 route metadata 헬퍼를 처리한다', () => {
    const context = createContext() as never;
    const parameterTypes = getHandlerParameterTypes(context);

    expect(isPrimitiveWrapperPrototype(String.prototype)).toBe(true);
    expect(isPrimitiveWrapperPrototype(CreateUserDto.prototype)).toBe(false);
    expect(getBodyParameterIndex(context)).toBe(0);
    expect(findBodyMetadataPrototype(context, parameterTypes)).toBe(CreateUserDto.prototype);
  });

  it('normalizes headers, request ids, and options - 헤더/요청 ID/옵션 기본값을 정리한다', () => {
    expect(normalizeHeaders({ Authorization: 'token', foo: 'bar' }, ['authorization'])).toEqual({
      Authorization: '******',
      foo: 'bar',
    });
    expect(resolveRequestId({ headers: { 'x-request-id': 'req-1' } }, 'x-request-id')).toBe('req-1');
    expect(resolveRequestId({ headers: {} }, 'x-request-id')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(defaultMaskedHeaders()).toContain('authorization');
    expect(resolveHttpLoggingOptions({ context: 'HTTP' })).toEqual(
      expect.objectContaining({
        context: 'HTTP',
        logBody: true,
        setResponseHeader: true,
      }),
    );
  });

  it('builds request/response payloads and shared helpers - 요청/응답 payload와 공통 헬퍼를 만든다', () => {
    const context = createContext() as never;
    const parameterTypes = getHandlerParameterTypes(context);
    const options = resolveHttpLoggingOptions({
      logBody: true,
      logQuery: true,
      logParams: true,
      logHeaders: true,
      logResponseBody: true,
    });

    const requestPayload = buildRequestPayload(
      context,
      {
        body: { email: 'user@example.com' },
        query: { page: '1' },
        params: { id: '1' },
        headers: { authorization: 'token' },
      },
      parameterTypes,
      options,
    );

    expect(requestPayload).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'us***@example.com' }),
        query: { page: '1' },
        params: { id: '1' },
        headers: { authorization: '******' },
      }),
    );
    expect(buildResponsePayload({ ok: true }, options)).toEqual({ response: { ok: true } });
    expect(buildResponsePayload(undefined, options)).toBeUndefined();
    expect(assignPrototype({ email: 'a' }, CreateUserDto.prototype)).toBeInstanceOf(CreateUserDto);
    expect(shouldExcludePath('/users/1', ['/users'])).toBe(true);
    expect(buildDuration(0)).toMatch(/ms$/);
  });

  it('parses raw JSON bodies before applying MaskLog metadata - raw JSON body도 MaskLog 메타데이터로 마스킹한다', () => {
    expect(parseJsonBody('plain-text')).toBe('plain-text');
    expect(parseJsonBody('{"email":"user@example.com"}')).toEqual({ email: 'user@example.com' });
    expect(maskRequestBody('{"email":"user@example.com"}', CreateUserDto.prototype)).toEqual(
      expect.objectContaining({ email: 'us***@example.com' }),
    );
  });

  it('masks raw JSON array bodies with DTO metadata - raw JSON 배열 body도 DTO 메타데이터로 마스킹한다', () => {
    expect(maskRequestBody('[{"email":"user@example.com"}]', CreateUserDto.prototype)).toEqual([
      expect.objectContaining({ email: 'us***@example.com' }),
    ]);
  });

  it('keeps malformed JSON bodies as-is when JSON.parse fails - JSON.parse 실패 시 원본 body를 유지한다', () => {
    const malformedBody = '{"email":"user@example.com"';

    expect(() => parseJsonBody(malformedBody)).not.toThrow();
    expect(parseJsonBody(malformedBody)).toBe(malformedBody);
    expect(maskRequestBody(malformedBody, CreateUserDto.prototype)).toBe(malformedBody);
  });
});
