import { describe, expect, it, vi } from 'vitest';
import { postJson, type FetchLike } from './webhook.utils';

describe('webhook utils', () => {
  it('posts json with merged headers - JSON과 헤더를 함께 전송한다', async () => {
    const fetcher: FetchLike = vi.fn(async () => ({ ok: true, status: 200 }));

    await postJson(fetcher, 'https://hook.test', { ok: true }, 'Webhook notification', {
      authorization: 'Bearer token',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://hook.test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/json',
          authorization: 'Bearer token',
        }),
        body: '{"ok":true}',
      }),
    );
  });

  it('throws a labeled error on non-ok responses - 실패 응답이면 레이블이 포함된 에러를 던진다', async () => {
    const fetcher: FetchLike = vi.fn(async () => ({ ok: false, status: 503 }));

    await expect(postJson(fetcher, 'https://hook.test', {}, 'Webhook notification')).rejects.toThrow(
      'Webhook notification failed with status 503',
    );
  });
});
