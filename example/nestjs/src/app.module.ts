import { Module } from "@nestjs/common";
import { RvlogNestModule } from "@kangjuhyup/rvlog-nest";
import { UserModule } from "./user.module";
import { nestLoggerOptions, nestLoggerSystem } from "./features/logger-system";

@Module({
  imports: [
    RvlogNestModule.forRoot({
      loggerSystem: nestLoggerSystem,
      logger: nestLoggerOptions,
      http: {
        excludePaths: ["/health"],
      },
    }),
    UserModule,
  ],
})
export class AppModule {}
