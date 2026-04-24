import { describe, expect, it } from 'vitest';
import { sanitizeLogValue, stringifyLogValue } from './log-serializer';

describe('log serializer', () => {
  it('truncates long strings and limits nested structures - 긴 문자열과 중첩 구조를 제한한다', () => {
    const value = {
      text: 'a'.repeat(20),
      list: Array.from({ length: 5 }, (_, index) => index),
      nested: {
        deep: {
          value: 'visible',
        },
      },
    };

    const sanitized = sanitizeLogValue(value, {
      maxStringLength: 5,
      maxArrayLength: 2,
      maxDepth: 2,
      truncateSuffix: '...',
    }) as {
      text: string;
      list: unknown[];
      nested: { deep: string };
    };

    expect(sanitized.text).toBe('aaaaa...');
    expect(sanitized.list).toEqual([0, 1, '[... 3 more items]']);
    expect(sanitized.nested.deep).toBe('[Object]');
  });

  it('stringifies circular objects safely - 순환 참조 객체도 안전하게 문자열화한다', () => {
    const value: Record<string, unknown> = { name: 'plain' };
    value.self = value;

    expect(stringifyLogValue(value)).toContain('[Circular]');
  });

  it('stringifyLogValue truncates plain string inputs directly - 문자열 입력도 직접 잘라낸다', () => {
    expect(
      stringifyLogValue('abcdefghij', {
        maxStringLength: 4,
        truncateSuffix: '...',
      }),
    ).toBe('abcd...');
  });

  it('sanitizeLogValue summarizes dates and extra object keys when limited - Date와 초과 키를 요약한다', () => {
    const value = {
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      one: 1,
      two: 2,
      three: 3,
    };

    const sanitized = sanitizeLogValue(value, {
      maxObjectKeys: 2,
    }) as Record<string, unknown>;

    expect(sanitized.createdAt).toBe('2026-04-24T00:00:00.000Z');
    expect(sanitized.__truncatedKeys).toBe(2);
  });

  it('summarizes arrays when maxDepth is reached - maxDepth에 도달하면 배열을 요약한다', () => {
    const sanitized = sanitizeLogValue(
      {
        nested: [[1, 2, 3]],
      },
      { maxDepth: 2 },
    ) as { nested: unknown[] };

    expect(sanitized.nested[0]).toBe('[Array(3)]');
  });

  it('falls back to String(value) when JSON.stringify fails - stringify 실패 시 String(value)로 fallback한다', () => {
    expect(stringifyLogValue(10n)).toBe('10');
  });
});
