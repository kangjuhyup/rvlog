import { LogLevel } from '../log/log-level';
import { CircuitBreaker, type CircuitBreakerOptions } from './circuit-breaker';
import type { LogContext, NotificationChannel } from './notification-channel';

/** Rule describing which levels should be delivered to a notification channel. */
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

interface RegisteredRule extends NotificationRule {
  breaker: CircuitBreaker;
}

/** Routes matching log events to registered notification channels. */
export class NotificationManager {
  private readonly rules: RegisteredRule[] = [];
  private readonly cooldowns = new Map<string, number>();
  private static readonly defaultCircuitBreaker: CircuitBreakerOptions = {
    failureThreshold: 3,
    recoveryTimeMs: 30_000,
    timeoutMs: 5_000,
  };

  /** Registers a channel rule and returns the same manager for chaining. */
  addRule(rule: NotificationRule): this {
    const circuitBreaker = rule.circuitBreaker ?? NotificationManager.defaultCircuitBreaker;

    this.rules.push({
      ...rule,
      circuitBreaker,
      breaker: new CircuitBreaker(rule.channel.constructor.name, circuitBreaker),
    });

    return this;
  }

  /** Delivers a log event to every registered channel that matches the level. */
  async notify(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const targets = this.rules.filter((rule) => rule.levels.includes(level));

    if (targets.length === 0) {
      return;
    }

    this.pruneCooldowns();

    await Promise.allSettled(
      targets.map(async (rule) => {
        const cooldownMs = rule.cooldownMs ?? 0;
        const dedupKey = this.createDedupKey(level, message, context);
        const now = Date.now();
        const lastSentAt = this.cooldowns.get(`${rule.channel.constructor.name}:${dedupKey}`);

        if (cooldownMs > 0 && lastSentAt !== undefined && now - lastSentAt < cooldownMs) {
          return;
        }

        this.cooldowns.set(`${rule.channel.constructor.name}:${dedupKey}`, now);

        try {
          await rule.breaker.execute(() => rule.channel.send(level, message, context));
        } catch {
          return;
        }
      }),
    );
  }

  private createDedupKey(level: LogLevel, message: string, context: LogContext): string {
    const errorMessage = context.error?.message ?? '';
    return `${level}:${context.className}:${context.methodName}:${message}:${errorMessage}`;
  }

  private pruneCooldowns(): void {
    if (this.cooldowns.size < 1000) {
      return;
    }

    const now = Date.now();

    for (const [key, timestamp] of this.cooldowns.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        this.cooldowns.delete(key);
      }
    }
  }
}
