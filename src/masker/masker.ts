import 'reflect-metadata';
import { getMaskOptions, type MaskOptions } from './mask-options';

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBuiltinPrototype(prototype: object | null): boolean {
  return prototype === null || prototype === Object.prototype || prototype === Array.prototype;
}

function resolveMetadataSource(
  inputPrototype: object | null,
  metadataPrototype?: object | null,
): object | null {
  if (metadataPrototype && !isBuiltinPrototype(metadataPrototype)) {
    return metadataPrototype;
  }

  return inputPrototype;
}

function resolveNestedMetadataPrototype(
  metadataSource: object | null,
  key: string,
  value: unknown,
): object | null | undefined {
  if (!metadataSource || !isObjectLike(value) || Array.isArray(value)) {
    return undefined;
  }

  const propertyType = Reflect.getMetadata('design:type', metadataSource, key) as
    | { prototype?: object | null }
    | undefined;

  return propertyType?.prototype;
}

export function maskValue(value: string, options: MaskOptions): string {
  switch (options.type) {
    case 'full':
      return '******';
    case 'partial':
      return value.length <= 2 ? '******' : `${value.slice(0, 2)}******`;
    case 'email': {
      const atIndex = value.indexOf('@');

      if (atIndex <= 0) {
        return '******';
      }

      const localPart = value.slice(0, atIndex);
      const domain = value.slice(atIndex);
      const visibleCount = Math.min(2, Math.max(1, localPart.length - 1));
      return `${localPart.slice(0, visibleCount)}***${domain}`;
    }
    case 'phone': {
      const digits = value.replace(/\D/g, '');

      if (digits.length < 7) {
        return '******';
      }

      const prefix = digits.slice(0, 3);
      const suffix = digits.slice(-4);
      return `${prefix}-****-${suffix}`;
    }
    case 'name': {
      if (value.length <= 1) {
        return '******';
      }

      if (value.length === 2) {
        return `${value[0]}*`;
      }

      return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
    }
    default:
      return '******';
  }
}

export function maskObject<T>(
  input: T,
  visited = new WeakMap<object, unknown>(),
  metadataPrototype?: object | null,
): T {
  if (!isObjectLike(input)) {
    return input;
  }

  if (visited.has(input)) {
    return visited.get(input) as T;
  }

  if (input instanceof Date) {
    return input;
  }

  if (Array.isArray(input)) {
    const clonedArray: unknown[] = [];
    visited.set(input, clonedArray);

    input.forEach((item, index) => {
      clonedArray[index] = maskObject(item, visited, metadataPrototype);
    });

    return clonedArray as T;
  }

  const prototype = Object.getPrototypeOf(input);
  const metadataSource = resolveMetadataSource(prototype, metadataPrototype);
  const clonePrototype = metadataSource && !isBuiltinPrototype(prototype) ? prototype : metadataSource ?? prototype;
  const clone = Object.create(clonePrototype) as Record<string, unknown>;
  visited.set(input, clone);

  for (const key of Object.keys(input)) {
    const value = (input as Record<string, unknown>)[key];
    const maskOptions = getMaskOptions(metadataSource, key);

    if (maskOptions && value !== undefined && value !== null) {
      clone[key] = maskValue(String(value), maskOptions);
      continue;
    }

    const nestedMetadataPrototype = resolveNestedMetadataPrototype(metadataSource, key, value);
    clone[key] = isObjectLike(value) ? maskObject(value, visited, nestedMetadataPrototype) : value;
  }

  return clone as T;
}
