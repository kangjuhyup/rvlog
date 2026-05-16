import type { EmailMessage, EmailTransport } from './email-channel';

type MaybePromise<T> = T | Promise<T>;

export interface SendMailLike {
  sendMail(message: EmailMessage): MaybePromise<unknown>;
}

export type NodemailerLike = SendMailLike;
export type SmtpLike = SendMailLike;

export interface ResendLike {
  emails: {
    send(message: EmailMessage): MaybePromise<unknown>;
  };
}

export interface SesClientLike<TCommand> {
  send(command: TCommand): MaybePromise<unknown>;
}

export type SesCommandFactory<TCommand> = (message: EmailMessage) => TCommand;

export interface SesEmailInput {
  Source?: string;
  Destination: {
    ToAddresses: string[];
  };
  Message: {
    Subject: {
      Data: string;
    };
    Body: {
      Text: {
        Data: string;
      };
      Html?: {
        Data: string;
      };
    };
  };
}

export function createSendMailAdapter(transporter: SendMailLike): EmailTransport {
  return {
    async send(message) {
      await transporter.sendMail(message);
    },
  };
}

export function createNodemailerAdapter(transporter: NodemailerLike): EmailTransport {
  return createSendMailAdapter(transporter);
}

export function createSmtpAdapter(transporter: SmtpLike): EmailTransport {
  return createSendMailAdapter(transporter);
}

export function createResendAdapter(client: ResendLike): EmailTransport {
  return {
    async send(message) {
      await client.emails.send(message);
    },
  };
}

export function createSesAdapter<TCommand>(
  client: SesClientLike<TCommand>,
  createCommand: SesCommandFactory<TCommand>,
): EmailTransport {
  return {
    async send(message) {
      await client.send(createCommand(message));
    },
  };
}

export function toSesEmailInput(message: EmailMessage): SesEmailInput {
  const body: SesEmailInput['Message']['Body'] = {
    Text: {
      Data: message.text,
    },
  };

  if (message.html) {
    body.Html = {
      Data: message.html,
    };
  }

  return {
    Source: message.from,
    Destination: {
      ToAddresses: normalizeRecipients(message.to),
    },
    Message: {
      Subject: {
        Data: message.subject,
      },
      Body: body,
    },
  };
}

function normalizeRecipients(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}
