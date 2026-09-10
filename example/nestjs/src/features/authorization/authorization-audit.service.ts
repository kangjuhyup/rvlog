import { Inject, Injectable } from '@nestjs/common';
import {
  LogLevel,
  type StructuredLoggerLike,
} from '@kangjuhyup/rvlog';

export const VOTE_AUTHORIZATION_LOGGER = Symbol('VOTE_AUTHORIZATION_LOGGER');

export interface AuthorizationDecisionMetadata {
  action: 'vote.read';
  resourceType: 'vote';
  resourceId?: string;
  allowed: boolean;
  reason: 'role-allowed' | 'role-denied';
}

@Injectable()
export class AuthorizationAuditService {
  constructor(
    @Inject(VOTE_AUTHORIZATION_LOGGER)
    private readonly logger: StructuredLoggerLike,
  ) {}

  recordDecision(metadata: AuthorizationDecisionMetadata): void {
    this.logger.event<AuthorizationDecisionMetadata>(
      'authorization.decision',
      metadata,
      metadata.allowed ? LogLevel.INFO : LogLevel.WARN,
    );
  }
}
