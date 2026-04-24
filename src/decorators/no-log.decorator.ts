import 'reflect-metadata';

const NO_LOG_METADATA_KEY = Symbol('rvlog:no-log');

export function NoLog(target: object, propertyKey: string | symbol): void {
  Reflect.defineMetadata(NO_LOG_METADATA_KEY, true, target, propertyKey);
}

export function isNoLog(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(NO_LOG_METADATA_KEY, target, propertyKey) === true;
}
