import { describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogContext } from '@kangjuhyup/rvlog';
import { EmailChannel } from './email-channel';

const context: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [],
  error: new Error('boom'),
  duration: '1.23ms',
  timestamp: new Date('2026-04-10T12:00:00.000Z'),
  tags: { service: 'api' },
  fields: { tenantId: 't-1' },
};

describe('EmailChannel', () => {
  it('sends a default email payload - 기본 이메일 payload를 전송한다', async () => {
    const sendMail = vi.fn();
    const channel = new EmailChannel({
      to: 'ops@example.com',
      from: 'rvlog@example.com',
      sendMail,
    });

    await channel.send(LogLevel.ERROR, 'failed', context);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.com',
        from: 'rvlog@example.com',
        subject: '[rvlog:ERROR] UserService.create',
        text: expect.stringContaining('Error: Error: boom'),
      }),
    );
  });

  it('supports a custom subject - subject를 커스터마이징할 수 있다', async () => {
    const sendMail = vi.fn();
    const channel = new EmailChannel({
      to: 'ops@example.com',
      sendMail,
      subject: (level) => `custom ${level}`,
    });

    await channel.send(LogLevel.WARN, 'careful', context);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'custom WARN',
        text: expect.stringContaining('Message: careful'),
      }),
    );
  });

  it('supports a custom formatter - formatter를 커스터마이징할 수 있다', async () => {
    const sendMail = vi.fn();
    const channel = new EmailChannel({
      to: ['ops@example.com', 'dev@example.com'],
      sendMail,
      format: (level, message) => ({
        subject: `formatted ${level}`,
        text: `body ${message}`,
        html: `<p>${message}</p>`,
      }),
    });

    await channel.send(LogLevel.WARN, 'careful', context);

    expect(sendMail).toHaveBeenCalledWith({
      to: ['ops@example.com', 'dev@example.com'],
      from: undefined,
      subject: 'formatted WARN',
      text: 'body careful',
      html: '<p>careful</p>',
    });
  });
});
