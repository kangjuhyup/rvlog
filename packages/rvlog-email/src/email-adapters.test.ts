import { describe, expect, it, vi } from 'vitest';
import {
  createNodemailerAdapter,
  createResendAdapter,
  createSesAdapter,
  createSmtpAdapter,
  toSesEmailInput,
  type EmailMessage,
} from './index';

const message: EmailMessage = {
  to: ['ops@example.com', 'dev@example.com'],
  from: 'rvlog@example.com',
  subject: '[rvlog:ERROR] UserService.create',
  text: 'failed',
  html: '<p>failed</p>',
};

describe('email adapters', () => {
  it('wraps a nodemailer-like transporter - nodemailer 형태의 transporter를 감싼다', async () => {
    const transporter = {
      sendMail: vi.fn(),
    };

    await createNodemailerAdapter(transporter).send(message);

    expect(transporter.sendMail).toHaveBeenCalledWith(message);
  });

  it('wraps an smtp-like transporter - SMTP 형태의 transporter를 감싼다', async () => {
    const transporter = {
      sendMail: vi.fn(),
    };

    await createSmtpAdapter(transporter).send(message);

    expect(transporter.sendMail).toHaveBeenCalledWith(message);
  });

  it('wraps a resend-like client - Resend 형태의 client를 감싼다', async () => {
    const resend = {
      emails: {
        send: vi.fn(),
      },
    };

    await createResendAdapter(resend).send(message);

    expect(resend.emails.send).toHaveBeenCalledWith(message);
  });

  it('wraps an SES-like client with a command factory - SES command factory를 사용한다', async () => {
    const command = { input: toSesEmailInput(message) };
    const createCommand = vi.fn(() => command);
    const client = {
      send: vi.fn(),
    };

    await createSesAdapter(client, createCommand).send(message);

    expect(createCommand).toHaveBeenCalledWith(message);
    expect(client.send).toHaveBeenCalledWith(command);
  });

  it('converts rvlog email messages to SES SendEmail input - SES 입력 형태로 변환한다', () => {
    expect(toSesEmailInput(message)).toEqual({
      Source: 'rvlog@example.com',
      Destination: {
        ToAddresses: ['ops@example.com', 'dev@example.com'],
      },
      Message: {
        Subject: {
          Data: '[rvlog:ERROR] UserService.create',
        },
        Body: {
          Text: {
            Data: 'failed',
          },
          Html: {
            Data: '<p>failed</p>',
          },
        },
      },
    });
  });

  it('normalizes a single recipient for SES input - SES 입력에서 단일 수신자를 배열로 정규화한다', () => {
    expect(toSesEmailInput({ ...message, to: 'ops@example.com', html: undefined })).toEqual({
      Source: 'rvlog@example.com',
      Destination: {
        ToAddresses: ['ops@example.com'],
      },
      Message: {
        Subject: {
          Data: '[rvlog:ERROR] UserService.create',
        },
        Body: {
          Text: {
            Data: 'failed',
          },
        },
      },
    });
  });
});
