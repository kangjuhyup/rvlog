import type { LogLevel } from '../log/log-level';
import type { LogContext } from './notification-channel';
import type {
  NotificationFingerprintPreset,
  NotificationFingerprintResolver,
} from './types';

const defaultFingerprintPreset: NotificationFingerprintPreset =
  'level+context+method+message+error';

export function createNotificationFingerprint(
  level: LogLevel,
  message: string,
  context: LogContext,
  key: NotificationFingerprintPreset | NotificationFingerprintResolver = defaultFingerprintPreset,
): string {
  if (typeof key === 'function') {
    return key(level, message, context);
  }

  const errorMessage = context.error?.message ?? '';

  switch (key) {
    case 'message':
      return message;
    case 'context+method+message+error':
      return `${context.className}:${context.methodName}:${message}:${errorMessage}`;
    case 'level+context+method+message+error':
    default:
      return `${level}:${context.className}:${context.methodName}:${message}:${errorMessage}`;
  }
}
