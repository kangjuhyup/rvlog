import type { NotificationChannel } from './notification-channel';
import type { NotificationResourceFactory, NotificationResourceName } from './types';

interface RegisteredNotificationResource {
  factory: NotificationResourceFactory;
  channel?: NotificationChannel;
  loading?: Promise<NotificationChannel>;
}

export class NotificationResourceRegistry {
  private readonly resources = new Map<NotificationResourceName, RegisteredNotificationResource>();
  private anonymousId = 0;

  add(name: NotificationResourceName, channel: NotificationChannel): void {
    this.resources.set(name, { factory: () => channel, channel });
  }

  addLazy(name: NotificationResourceName, factory: NotificationResourceFactory): void {
    this.resources.set(name, { factory });
  }

  addAnonymous(channel: NotificationChannel): NotificationResourceName {
    const name = `${channel.constructor.name || 'NotificationChannel'}#${this.anonymousId}`;
    this.anonymousId += 1;
    this.add(name, channel);
    return name;
  }

  async resolve(name: NotificationResourceName): Promise<NotificationChannel | null> {
    const resource = this.resources.get(name);

    if (!resource) {
      return null;
    }

    if (resource.channel) {
      return resource.channel;
    }

    resource.loading ??= Promise.resolve(resource.factory()).then((channel) => {
      resource.channel = channel;
      return channel;
    });

    return resource.loading;
  }
}
