import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../../log/log-level';
import type { LogContext } from '../notification-channel';
import { DiscordChannel } from './discord-channel';

const context: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [],
  error: new Error('boom'),
  duration: '1.23ms',
  timestamp: new Date('2026-04-10T12:00:00.000Z'),
};

describe('DiscordChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts an embed payload to the webhook - Discord 웹훅으로 embed payload를 전송한다', async () => {
    // Given: Discord 웹훅 요청을 받을 fetch mock이 있다.
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new DiscordChannel('https://discord.test');
    // When: WARN 알림을 Discord 채널로 전송한다.
    await channel.send(LogLevel.WARN, 'warned', context);

    // Then: embed 형태의 payload가 전송된다.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1].body).toContain('"title":"UserService.create"');
    expect(fetchMock.mock.calls[0]?.[1].body).toContain('"description":"warned"');
  });

  it.each([
    [LogLevel.ERROR, 0xff3b30],
    [LogLevel.WARN, 0xffcc00],
    [LogLevel.INFO, 0x007aff],
    [LogLevel.DEBUG, 0x8e8e93],
  ])('maps level %s to embed color %s - 레벨별로 embed 색상이 매핑된다', async (level, color) => {
    // Given: 각 레벨별 색상이 payload에 포함되는지 확인할 fetch mock이 있다.
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new DiscordChannel('https://discord.test');
    // When: 특정 레벨의 알림을 전송한다.
    await channel.send(level, 'm', context);

    // Then: 해당 레벨의 embed color 숫자가 payload에 기록된다.
    expect(fetchMock.mock.calls[0]?.[1].body).toContain(`"color":${color}`);
  });

  it('throws when discord returns a non-ok response - 응답이 실패면 예외를 던진다', async () => {
    // Given: 500 응답을 내려주는 fetch mock이 있다.
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new DiscordChannel('https://discord.test');

    // When / Then: send 호출은 상태 코드를 포함한 Error를 던진다.
    await expect(channel.send(LogLevel.ERROR, 'boom', context)).rejects.toThrow(
      'Discord notification failed with status 500',
    );
  });
});
