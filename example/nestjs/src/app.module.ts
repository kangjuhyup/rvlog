import { Module } from '@nestjs/common';
import { LogLevel, NotificationManager, SlackChannel } from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';
import { RvlogNestModule } from '@kangjuhyup/rvlog-nest';
import { UserModule } from './user.module';

@Module({
  imports: [
    RvlogNestModule.forRoot({
      logger: {
        minLevel: LogLevel.INFO,
        pretty: true,
        notification: new NotificationManager().addRule({
          channel: new SlackChannel(process.env.SLACK_WEBHOOK_URL ?? 'https://hooks.slack.com/services/example'),
          levels: [LogLevel.ERROR],
          cooldownMs: 60_000,
          circuitBreaker: {
            failureThreshold: 3,
            recoveryTimeMs: 30_000,
            timeoutMs: 5_000,
          },
        }),
        transports: [
          new FileTransport({
            enabled: true,
            dirPath: 'logs',
            fileName: 'nestjs.log',
            rotate: {
              type: 'daily',
            },
          }),
        ],
      },
      http: {
        excludePaths: ['/health'],
      },
    }),
    UserModule,
  ],
})
export class AppModule {}
