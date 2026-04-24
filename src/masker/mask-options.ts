import 'reflect-metadata';

export type MaskType = 'full' | 'partial' | 'email' | 'phone' | 'name';

export interface MaskOptions {
  type: MaskType;
}

export const MASK_METADATA_KEY = Symbol('rvlog:mask');
const fallbackMaskOptionsByProperty = new Map<string, MaskOptions | null>();

export function getMaskOptions(
  target: object | null | undefined,
  propertyKey: string,
): MaskOptions | undefined {
  const directMaskOptions = target
    ? (Reflect.getMetadata(MASK_METADATA_KEY, target, propertyKey) as MaskOptions | undefined)
    : undefined;

  if (directMaskOptions) {
    return directMaskOptions;
  }

  return fallbackMaskOptionsByProperty.get(propertyKey) ?? undefined;
}

export function setMaskOptions(
  target: object,
  propertyKey: string | symbol,
  options: MaskOptions,
): void {
  Reflect.defineMetadata(MASK_METADATA_KEY, options, target, propertyKey);

  const normalizedKey = String(propertyKey);
  const existing = fallbackMaskOptionsByProperty.get(normalizedKey);

  if (!existing) {
    fallbackMaskOptionsByProperty.set(normalizedKey, options);
    return;
  }

  if (existing.type !== options.type) {
    fallbackMaskOptionsByProperty.set(normalizedKey, null);
  }
}
