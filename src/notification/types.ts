import type { LogLevel } from '../log/log-level';
import type { CircuitBreakerOptions } from './circuit-breaker';
import type { LogContext, NotificationChannel } from './notification-channel';

export type NotificationResourceName = string;

export type NotificationResourceFactory = () => NotificationChannel | Promise<NotificationChannel>;

export type NotificationFingerprintPreset =
  | 'level+context+method+message+error'
  | 'context+method+message+error'
  | 'message';

export type NotificationFingerprintResolver = (
  level: LogLevel,
  message: string,
  context: LogContext,
) => string;

export interface NotificationThresholdOptions {
  /** Number of matching notifications required inside the window. */
  count: number;
  /** Rolling window duration in milliseconds. */
  windowMs: number;
  /** Fingerprint strategy used to decide which notifications count together. */
  key?: NotificationFingerprintPreset | NotificationFingerprintResolver;
  /** Defaults to first-match, which emits only when count is reached. */
  emit?: 'first-match' | 'every-match-after-threshold';
}

export interface NotificationCondition {
  /** Shared fingerprint strategy for cooldown and threshold checks. */
  key?: NotificationFingerprintPreset | NotificationFingerprintResolver;
  /** Suppresses repeated sends after a route emits. */
  cooldownMs?: number;
  /** Requires N matching notifications within the configured time window. */
  threshold?: NotificationThresholdOptions;
}

export interface NotificationRoute {
  /** Resource names registered with addResource/addLazyResource. */
  resources: NotificationResourceName[];
  /** Levels that should be evaluated by this route. */
  levels: LogLevel[];
  /** Optional delivery conditions applied before any resource is loaded. */
  when?: NotificationCondition;
  /** Optional circuit breaker settings for resources in this route. */
  circuitBreaker?: CircuitBreakerOptions;
}

/** Legacy rule shape kept for existing addRule users. */
export interface NotificationRule {
  /** Channel that receives matching notifications. */
  channel: NotificationChannel;
  /** Levels that should be forwarded to the channel. */
  levels: LogLevel[];
  /** Optional deduplication cooldown per channel/message/context combination. */
  cooldownMs?: number;
  /** Optional circuit breaker settings for the channel. */
  circuitBreaker?: CircuitBreakerOptions;
}
