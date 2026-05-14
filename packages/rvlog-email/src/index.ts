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
  createSmtpAdapter,
  toSesEmailInput,
  type NodemailerLike,
  type ResendLike,
  type SesClientLike,
  type SesCommandFactory,
  type SesEmailInput,
  type SmtpLike,
} from './email-adapters';
