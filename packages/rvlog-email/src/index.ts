export {
  EmailChannel,
  type EmailChannelOptions,
  type EmailContent,
  type EmailMessage,
  type EmailSendMail,
  type EmailTransport,
} from './email-channel';

export {
  createNodemailerAdapter,
  createResendAdapter,
  createSesAdapter,
  createSendMailAdapter,
  createSmtpAdapter,
  toSesEmailInput,
  type NodemailerLike,
  type ResendLike,
  type SesClientLike,
  type SesCommandFactory,
  type SesEmailInput,
  type SendMailLike,
  type SmtpLike,
} from './email-adapters';
