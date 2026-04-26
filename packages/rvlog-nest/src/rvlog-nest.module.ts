import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import {
  Logger,
  LoggerSystem,
  type LoggerOptions,
  type NotificationManager,
} from "@kangjuhyup/rvlog";
import {
  RvlogHttpInterceptor,
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpLoggingOptions,
} from "./rvlog-http.interceptor";

export interface RvlogNestModuleOptions {
  logger?: LoggerOptions;
  loggerSystem?: LoggerSystem;
  http?: RvlogHttpLoggingOptions;
}

@Global()
@Module({})
export class RvlogNestModule {
  static forRoot(options: RvlogNestModuleOptions = {}): DynamicModule {
    if (options.loggerSystem && options.logger) {
      options.loggerSystem.configure(options.logger);
    } else if (options.logger) {
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
          provide: RVLOG_HTTP_LOGGER_SYSTEM,
          useValue: options.loggerSystem ?? null,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RvlogHttpInterceptor,
        },
      ],
      exports: [RVLOG_HTTP_LOGGING_OPTIONS, RVLOG_HTTP_LOGGER_SYSTEM],
    };
  }
}
