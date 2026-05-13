import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogContext } from '@kangjuhyup/rvlog';
import { SlackChannel } from './slack-channel';

const context: LogContext = {
  className: 'AlertSmokeTest',
  methodName: 'slack',
  args: [{ id: 'slack-smoke' }],
  error: new Error('slack smoke failure'),
  duration: '1.23ms',
  timestamp: new Date('2026-05-14T00:00:00.000Z'),
};

describe('SlackChannel package', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts a slack payload to the webhook - Slack 웹훅으로 payload를 전송한다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new SlackChannel('https://hooks.slack.test/services/test').send(
      LogLevel.ERROR,
      'package slack test',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://hooks.slack.test/services/test');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body ?? '{}');
    expect(body).toMatchObject({
      text: '[ERROR] AlertSmokeTest.slack package slack test',
    });
    expect(body.blocks[0].text.text).toContain('*ERROR* AlertSmokeTest.slack');
    expect(body.blocks[0].text.text).toContain('package slack test');
  });

  it('throws when slack returns a non-ok response - Slack 응답 실패 시 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    await expect(
      new SlackChannel('https://hooks.slack.test/services/test').send(
        LogLevel.ERROR,
        'package slack test',
        context,
      ),
    ).rejects.toThrow('Slack notification failed with status 500');
  });
});

describe('SlackChannel package smoke', () => {
  const webhookUrl = process.env.RVLOG_SLACK_WEBHOOK_URL;
  const smokeIt = webhookUrl ? it : it.skip;

  smokeIt(
    'sends to the real Slack webhook when RVLOG_SLACK_WEBHOOK_URL is set - env 설정 시 실제 Slack으로 전송한다',
    async () => {
      await new SlackChannel(webhookUrl as string).send(
        LogLevel.ERROR,
        `rvlog Slack smoke test ${new Date().toISOString()}`,
        {
          ...context,
          timestamp: new Date(),
        },
      );
    },
  );
});
