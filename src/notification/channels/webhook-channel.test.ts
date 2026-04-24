import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../../log/log-level';
import type { LogContext } from '../notification-channel';
import { WebhookChannel } from './webhook-channel';

const context: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [],
  error: new Error('boom'),
  duration: '1.23ms',
  timestamp: new Date('2026-04-10T12:00:00.000Z'),
};

describe('WebhookChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts raw json with custom headers - 사용자 정의 헤더와 함께 JSON 본문을 전송한다', async () => {
    // Given: custom header를 검사할 fetch mock과 WebhookChannel이 있다.
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new WebhookChannel('https://webhook.test', { authorization: 'Bearer token' });
    // When: ERROR 알림을 generic webhook으로 전송한다.
    await channel.send(LogLevel.ERROR, 'failed', context);

    // Then: 헤더와 JSON 본문이 함께 전달된다.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1].headers.authorization).toBe('Bearer token');
    expect(fetchMock.mock.calls[0]?.[1].body).toContain('"level":"ERROR"');
    expect(fetchMock.mock.calls[0]?.[1].body).toContain('"message":"failed"');
  });

  it('throws when webhook returns a non-ok response - 응답이 실패면 상태 코드를 포함한 예외를 던진다', async () => {
    // Given: 500 응답을 내려주는 fetch mock과 채널이 있다.
    const fetchMock = vi.fn(async () => ({ ok: false, status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = new WebhookChannel('https://webhook.test');

    // When / Then: send 호출은 상태 코드를 포함한 Error를 던진다.
    await expect(channel.send(LogLevel.ERROR, 'failed', context)).rejects.toThrow(
      'Webhook notification failed with status 502',
    );
  });
});
