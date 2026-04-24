import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../../log/log-level';
import type { LogContext } from '../notification-channel';
import { SlackChannel } from './slack-channel';

const context: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [{ id: 1 }],
  error: new Error('boom'),
  duration: '1.23ms',
  timestamp: new Date('2026-04-10T12:00:00.000Z'),
};

describe('SlackChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts a slack payload to the webhook - Slack 웹훅으로 올바른 payload를 전송한다', async () => {
    // Given: 성공 응답을 반환하는 fetch mock과 SlackChannel이 있다.
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new SlackChannel('https://hooks.slack.test');
    // When: Slack 채널로 ERROR 알림을 보낸다.
    await channel.send(LogLevel.ERROR, 'failed', context);

    // Then: Slack 웹훅 URL과 payload 형식이 올바르게 전달된다.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://hooks.slack.test');
    expect(fetchMock.mock.calls[0]?.[1].method).toBe('POST');
    expect(fetchMock.mock.calls[0]?.[1].body).toContain('"text":"[ERROR] UserService.create failed"');
  });

  it('throws when slack returns a non-ok response - Slack 응답이 실패면 예외를 던진다', async () => {
    // Given: 실패 응답을 반환하는 fetch mock이 있다.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    const channel = new SlackChannel('https://hooks.slack.test');
    // When / Then: Slack 전송은 예외를 던진다.
    await expect(channel.send(LogLevel.ERROR, 'failed', context)).rejects.toThrow('Slack notification failed');
  });
});
