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
  toSesEmailInput,
  type NodemailerLike,
  type ResendLike,
  type SesClientLike,
  type SesCommandFactory,
  type SesEmailInput,
} from './email-adapters';
