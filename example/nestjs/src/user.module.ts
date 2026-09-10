import { Module } from '@nestjs/common';
import { createRvlogLoggerProvider } from '@kangjuhyup/rvlog-nest';
import { NestAlertRoutingExample } from './features/alert-routing';
import {
  AuthorizationAuditService,
  VOTE_AUTHORIZATION_LOGGER,
  VoteAuthorizationController,
  VotePermissionGuard,
} from './features/authorization';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController, VoteAuthorizationController],
  providers: [
    UserService,
    NestAlertRoutingExample,
    AuthorizationAuditService,
    VotePermissionGuard,
    createRvlogLoggerProvider(VOTE_AUTHORIZATION_LOGGER, 'VoteAuthorization'),
  ],
})
export class UserModule {}
