import type { NotificationThresholdOptions } from './types';

interface ThresholdWindow {
  startedAt: number;
  count: number;
}

export class NotificationThresholdStore {
  private readonly windows = new Map<string, ThresholdWindow>();

  shouldEmit(key: string, options: NotificationThresholdOptions, now: number): boolean {
    const current = this.windows.get(key);
    const window =
      current && now - current.startedAt < options.windowMs
        ? current
        : { startedAt: now, count: 0 };

    window.count += 1;
    this.windows.set(key, window);

    if (options.emit === 'every-match-after-threshold') {
      return window.count >= options.count;
    }

    return window.count === options.count;
  }

  prune(now: number): void {
    if (this.windows.size < 1000) {
      return;
    }

    for (const [key, window] of this.windows.entries()) {
      if (now - window.startedAt > 60 * 60 * 1000) {
        this.windows.delete(key);
      }
    }
  }
}
