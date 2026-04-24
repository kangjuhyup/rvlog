import type { MaskOptions } from '../masker/mask-options';
import { setMaskOptions } from '../masker/mask-options';

export function MaskLog(options: MaskOptions): PropertyDecorator {
  return (target, propertyKey) => {
    setMaskOptions(target, propertyKey, options);
  };
}
