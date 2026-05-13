import { Module } from '@nestjs/common';
import { NestAlertRoutingExample } from './features/alert-routing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService, NestAlertRoutingExample],
})
export class UserModule {}
