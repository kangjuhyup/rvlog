import { Module } from '@nestjs/common';
import { RvlogNestModule } from 'rvlog-nest';
import {
  nestLoggerOptions,
  nestLoggerSystem,
} from './features/logger-system';
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
