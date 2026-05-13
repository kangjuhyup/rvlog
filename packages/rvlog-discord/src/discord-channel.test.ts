import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogContext } from '@kangjuhyup/rvlog';
import { DiscordChannel } from './discord-channel';

const context: LogContext = {
  className: 'AlertSmokeTest',
  methodName: 'discord',
  args: [{ id: 'discord-smoke' }],
  error: new Error('discord smoke failure'),
  duration: '1.23ms',
  timestamp: new Date('2026-05-14T00:00:00.000Z'),
};

describe('DiscordChannel package', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts an embed payload to the webhook - Discord 웹훅으로 embed payload를 전송한다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new DiscordChannel('https://discord.test/api/webhooks/test').send(
      LogLevel.WARN,
      'package discord test',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://discord.test/api/webhooks/test');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body ?? '{}');
    expect(body.embeds[0]).toMatchObject({
      title: 'AlertSmokeTest.discord',
      description: 'package discord test',
      color: 0xffcc00,
      timestamp: '2026-05-14T00:00:00.000Z',
    });
  });

  it.each([
    [LogLevel.ERROR, 0xff3b30],
    [LogLevel.WARN, 0xffcc00],
    [LogLevel.INFO, 0x007aff],
    [LogLevel.DEBUG, 0x8e8e93],
  ])('maps level %s to embed color %s - 레벨별 embed 색상을 매핑한다', async (level, color) => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new DiscordChannel('https://discord.test/api/webhooks/test').send(
      level,
      'package discord test',
      context,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body ?? '{}');
    expect(body.embeds[0].color).toBe(color);
  });

  it('throws when discord returns a non-ok response - Discord 응답 실패 시 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    await expect(
      new DiscordChannel('https://discord.test/api/webhooks/test').send(
        LogLevel.ERROR,
        'package discord test',
        context,
      ),
    ).rejects.toThrow('Discord notification failed with status 500');
  });
});

describe('DiscordChannel package smoke', () => {
  const webhookUrl = process.env.RVLOG_DISCORD_WEBHOOK_URL;
  const smokeIt = webhookUrl ? it : it.skip;

  smokeIt(
    'sends to the real Discord webhook when RVLOG_DISCORD_WEBHOOK_URL is set - env 설정 시 실제 Discord로 전송한다',
    async () => {
      await new DiscordChannel(webhookUrl as string).send(
        LogLevel.ERROR,
        `rvlog Discord smoke test ${new Date().toISOString()}`,
        {
          ...context,
          timestamp: new Date(),
        },
      );
    },
  );
});
