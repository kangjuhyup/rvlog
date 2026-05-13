import { LogLevel } from '../log/log-level';
import { CircuitBreaker, type CircuitBreakerOptions } from './circuit-breaker';
import { createNotificationFingerprint } from './dedupe';
import type { LogContext, NotificationChannel } from './notification-channel';
import { NotificationResourceRegistry } from './resource-registry';
import { NotificationThresholdStore } from './threshold';
import type {
  NotificationResourceFactory,
  NotificationResourceName,
  NotificationRoute,
  NotificationRule,
} from './types';

export type {
  NotificationCondition,
  NotificationFingerprintPreset,
  NotificationFingerprintResolver,
  NotificationResourceFactory,
  NotificationResourceName,
  NotificationRoute,
  NotificationRule,
  NotificationThresholdOptions,
} from './types';

interface RegisteredRoute extends NotificationRoute {
  id: number;
  breakers: Map<NotificationResourceName, CircuitBreaker>;
}

/** Routes matching log events to registered notification channels. */
export class NotificationManager {
  private readonly resources = new NotificationResourceRegistry();
  private readonly routes: RegisteredRoute[] = [];
  private readonly cooldowns = new Map<string, number>();
  private readonly thresholds = new NotificationThresholdStore();
  private routeId = 0;
  private static readonly defaultCircuitBreaker: CircuitBreakerOptions = {
    failureThreshold: 3,
    recoveryTimeMs: 30_000,
    timeoutMs: 5_000,
  };

  /** Registers an eagerly-created notification resource. */
  addResource(name: NotificationResourceName, channel: NotificationChannel): this {
    this.resources.add(name, channel);
    return this;
  }

  /** Registers a resource factory that is loaded only when a matching route emits. */
  addLazyResource(name: NotificationResourceName, factory: NotificationResourceFactory): this {
    this.resources.addLazy(name, factory);
    return this;
  }

  /** Registers a route that can fan out matching notifications to many resources. */
  addRoute(route: NotificationRoute): this {
    if (route.resources.length === 0) {
      throw new Error('NotificationRoute.resources must include at least one resource');
    }

    const circuitBreaker = route.circuitBreaker ?? NotificationManager.defaultCircuitBreaker;
    const id = this.routeId;
    this.routeId += 1;

    this.routes.push({
      ...route,
      circuitBreaker,
      id,
      breakers: new Map(
        route.resources.map((resource) => [
          resource,
          new CircuitBreaker(resource, circuitBreaker),
        ]),
      ),
    });

    return this;
  }

  /** Registers a channel rule and returns the same manager for chaining. */
  addRule(rule: NotificationRule): this {
    const resource = this.resources.addAnonymous(rule.channel);

    return this.addRoute({
      resources: [resource],
      levels: rule.levels,
      when: { cooldownMs: rule.cooldownMs },
      circuitBreaker: rule.circuitBreaker,
    });
  }

  /** Delivers a log event to every registered channel that matches the level. */
  async notify(level: LogLevel, message: string, context: LogContext): Promise<void> {
    const targets = this.routes.filter((route) => route.levels.includes(level));

    if (targets.length === 0) {
      return;
    }

    const now = Date.now();
    this.pruneState(now);

    await Promise.allSettled(
      targets.map(async (route) => {
        const fingerprint = createNotificationFingerprint(
          level,
          message,
          context,
          route.when?.threshold?.key ?? route.when?.key,
        );
        const routeKey = `${route.id}:${fingerprint}`;
        const threshold = route.when?.threshold;

        if (threshold && !this.thresholds.shouldEmit(routeKey, threshold, now)) {
          return;
        }

        const cooldownMs = route.when?.cooldownMs ?? 0;
        const lastSentAt = this.cooldowns.get(routeKey);

        if (cooldownMs > 0 && lastSentAt !== undefined && now - lastSentAt < cooldownMs) {
          return;
        }

        this.cooldowns.set(routeKey, now);

        await Promise.allSettled(
          route.resources.map((resource) => this.notifyResource(route, resource, level, message, context)),
        );
      }),
    );
  }

  private async notifyResource(
    route: RegisteredRoute,
    resource: NotificationResourceName,
    level: LogLevel,
    message: string,
    context: LogContext,
  ): Promise<void> {
    const channel = await this.resources.resolve(resource);

    if (!channel) {
      return;
    }

    const breaker = route.breakers.get(resource);

    try {
      if (breaker) {
        await breaker.execute(() => channel.send(level, message, context));
        return;
      }

      await channel.send(level, message, context);
    } catch {
      return;
    }
  }

  private pruneState(now: number): void {
    if (this.cooldowns.size < 1000) {
      this.thresholds.prune(now);
      return;
    }

    for (const [key, timestamp] of this.cooldowns.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        this.cooldowns.delete(key);
      }
    }

    this.thresholds.prune(now);
  }
}
