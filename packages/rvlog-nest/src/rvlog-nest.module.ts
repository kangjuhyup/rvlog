import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Logger, type LoggerOptions, type NotificationManager } from '@kangjuhyup/rvlog';
import {
  RvlogHttpInterceptor,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpLoggingOptions,
} from './rvlog-http.interceptor';

export interface RvlogNestModuleOptions {
  logger?: LoggerOptions & { notification?: NotificationManager };
  http?: RvlogHttpLoggingOptions;
}

@Global()
@Module({})
export class RvlogNestModule {
  static forRoot(options: RvlogNestModuleOptions = {}): DynamicModule {
    if (options.logger) {
      Logger.configure(options.logger);
    }

    return {
      module: RvlogNestModule,
      providers: [
        {
          provide: RVLOG_HTTP_LOGGING_OPTIONS,
          useValue: options.http ?? {},
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RvlogHttpInterceptor,
        },
      ],
      exports: [RVLOG_HTTP_LOGGING_OPTIONS],
    };
  }
}
