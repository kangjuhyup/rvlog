import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import {
  Logger,
  LoggerSystem,
  type LoggerOptions,
  type NotificationManager,
} from "@kangjuhyup/rvlog";
import {
  RvlogHttpInterceptor,
} from "./rvlog-http.interceptor";
import {
  RVLOG_HTTP_LOGGER_SYSTEM,
  RVLOG_HTTP_LOGGING_OPTIONS,
  type RvlogHttpLoggingOptions,
} from "./rvlog-http.options";
import { RvlogRequestContextMiddleware } from './rvlog-request-context.middleware';

export interface RvlogNestModuleOptions {
  logger?: LoggerOptions;
  loggerSystem?: LoggerSystem;
  http?: RvlogHttpLoggingOptions;
}

@Global()
@Module({})
export class RvlogNestModule implements NestModule {
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
        RvlogRequestContextMiddleware,
      ],
      exports: [RVLOG_HTTP_LOGGING_OPTIONS, RVLOG_HTTP_LOGGER_SYSTEM],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RvlogRequestContextMiddleware).forRoutes('*');
  }
}
