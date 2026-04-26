import { Module } from '@nestjs/common';
import { LogLevel, NotificationManager, SlackChannel } from '@kangjuhyup/rvlog';
import { FileTransport } from '@kangjuhyup/rvlog/node';
import { RvlogNestModule } from '@kangjuhyup/rvlog-nest';
import { UserModule } from './user.module';

@Module({
  imports: [
    RvlogNestModule.forRoot({
      loggerSystem: nestLoggerSystem,
      logger: nestLoggerOptions,
      http: {
        excludePaths: ['/health'],
      },
    }),
    UserModule,
  ],
})
export class AppModule {}
