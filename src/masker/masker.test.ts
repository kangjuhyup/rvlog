import { describe, expect, it } from 'vitest';
import { MaskLog } from '../decorators/mask-log.decorator';
import { maskObject, maskValue } from './masker';

class BuyerDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'phone' })
  phone!: string;
}

class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;

  @MaskLog({ type: 'full' })
  residentId!: string;

  buyer!: BuyerDto;
}

describe('maskValue - 단일 값 마스킹', () => {
  it('masks each supported type - 지원하는 마스킹 타입별로 올바르게 변환한다', () => {
    // Given / When: 각 마스킹 타입에 대응하는 입력값을 변환한다.
    // Then: 타입별 기대 포맷으로 마스킹된다.
    expect(maskValue('abcdefgh', { type: 'partial' })).toBe('ab******');
    expect(maskValue('hong@gmail.com', { type: 'email' })).toBe('ho***@gmail.com');
    expect(maskValue('01012345678', { type: 'phone' })).toBe('010-****-5678');
    expect(maskValue('홍길동', { type: 'name' })).toBe('홍*동');
    expect(maskValue('anything', { type: 'full' })).toBe('******');
  });
});

describe('maskObject - 객체 마스킹', () => {
  it('masks decorated fields recursively without mutating the original - 원본을 변경하지 않고 재귀적으로 마스킹한다', () => {
    // Given: 중첩 DTO 구조와 마스킹 메타데이터가 설정된 객체가 있다.
    const dto = new CreateUserDto();
    dto.name = '홍길동';
    dto.email = 'hong@gmail.com';
    dto.residentId = '9001011234567';
    dto.buyer = new BuyerDto();
    dto.buyer.name = '김철수';
    dto.buyer.phone = '01012345678';

    // When: 객체 전체에 대해 maskObject를 적용한다.
    const masked = maskObject(dto);

    // Then: 마스킹 대상만 재귀적으로 바뀌고 원본 객체는 보존된다.
    expect(masked).not.toBe(dto);
    expect(masked.name).toBe('홍*동');
    expect(masked.email).toBe('ho***@gmail.com');
    expect(masked.residentId).toBe('******');
    expect(masked.buyer.name).toBe('김*수');
    expect(masked.buyer.phone).toBe('010-****-5678');
    expect(dto.name).toBe('홍길동');
  });

  it('handles circular references safely - 순환 참조가 있어도 무한 재귀에 빠지지 않는다', () => {
    // Given: 자기 자신을 참조하는 순환 객체가 있다.
    const value: Record<string, unknown> = { name: 'plain' };
    value.self = value;

    // When: 순환 객체를 마스킹한다.
    const masked = maskObject(value);

    // Then: 순환 구조를 유지한 채 안전하게 처리된다.
    expect(masked.self).toBe(masked);
  });

  it('recurses through arrays and plain nested objects safely - 배열과 일반 중첩 객체도 안전하게 순회한다', () => {
    // Given: DTO 배열과 일반 객체가 함께 섞인 입력이 있다.
    const dto = new CreateUserDto();
    dto.name = '홍길동';
    dto.email = 'hong@gmail.com';
    dto.residentId = '9001011234567';
    dto.buyer = new BuyerDto();
    dto.buyer.name = '김철수';
    dto.buyer.phone = '01012345678';

    const input = {
      list: [dto, { nested: dto }],
      plain: {
        value: 'visible',
      },
    };

    // When: 복합 구조 전체를 마스킹한다.
    const masked = maskObject(input);

    // Then: DTO 내부는 마스킹되고 일반 객체 값은 그대로 유지된다.
    expect(masked.list[0]).not.toBe(dto);
    expect((masked.list[0] as CreateUserDto).name).toBe('홍*동');
    expect(((masked.list[1] as { nested: CreateUserDto }).nested).buyer.phone).toBe('010-****-5678');
    expect(masked.plain.value).toBe('visible');
  });

  it('applies explicit metadata prototypes to array items - 명시적 메타데이터 prototype을 배열 원소에도 적용한다', () => {
    const masked = maskObject(
      [
        {
          name: '홍길동',
          email: 'hong@gmail.com',
        },
      ],
      undefined,
      CreateUserDto.prototype,
    );

    expect(masked[0]).toEqual(
      expect.objectContaining({
        name: '홍*동',
        email: 'ho***@gmail.com',
      }),
    );
  });

  it('falls back to full mask for unknown mask type - 알 수 없는 타입은 기본적으로 full 마스킹을 사용한다', () => {
    // Given / When: 지원하지 않는 type이 들어온다.
    const value = maskValue('any', { type: 'unknown' as never });

    // Then: 안전하게 전체 마스킹 값을 반환한다.
    expect(value).toBe('******');
  });

  it('returns primitives and Date inputs unchanged - 원시값과 Date는 그대로 반환한다', () => {
    // Given / When / Then: 객체가 아닌 입력은 즉시 반환되고, Date는 참조 보존된다.
    expect(maskObject(42)).toBe(42);
    expect(maskObject('plain')).toBe('plain');
    expect(maskObject(null)).toBe(null);

    const date = new Date('2026-04-10T12:00:00.000Z');
    expect(maskObject(date)).toBe(date);
  });

  it('masks non-string decorated values by string conversion - 문자열이 아닌 값도 문자열 변환 후 마스킹한다', () => {
    // Given: 숫자 타입이지만 마스킹 메타데이터가 있는 DTO가 있다.
    class NumericDto {
      @MaskLog({ type: 'full' })
      secret!: number;
    }

    const dto = new NumericDto();
    dto.secret = 1234;

    // When: 객체를 마스킹한다.
    const masked = maskObject(dto);

    // Then: 숫자 값도 문자열로 처리되어 마스킹된다.
    expect(masked.secret).toBe('******');
  });

  it('falls back to globally registered field metadata for plain objects - plain object도 등록된 필드명 기준으로 마스킹한다', () => {
    const masked = maskObject({
      name: '홍길동',
      email: 'hong@gmail.com',
      residentId: '9001011234567',
    });

    expect(masked.name).toBe('홍*동');
    expect(masked.email).toBe('ho***@gmail.com');
    expect(masked.residentId).toBe('******');
  });
});
