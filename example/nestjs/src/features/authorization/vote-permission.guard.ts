import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { enrichRvlogContext } from '@kangjuhyup/rvlog-nest';
import { AuthorizationAuditService } from './authorization-audit.service';

interface VoteRequest {
  headers: Record<string, string | string[] | undefined>;
  params?: { voteId?: string };
}

function firstHeader(
  headers: VoteRequest['headers'],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class VotePermissionGuard implements CanActivate {
  constructor(private readonly audit: AuthorizationAuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VoteRequest>();
    const tenantId = firstHeader(request.headers, 'x-tenant-id') ?? 'unknown';
    const userPrincipalId = firstHeader(request.headers, 'x-user-principal-id') ?? 'anonymous';
    const role = firstHeader(request.headers, 'x-vote-role');
    const allowed = role === 'admin' || role === 'operator';

    enrichRvlogContext({ tenantId, userPrincipalId });
    this.audit.recordDecision({
      action: 'vote.read',
      resourceType: 'vote',
      resourceId: request.params?.voteId,
      allowed,
      reason: allowed ? 'role-allowed' : 'role-denied',
    });

    if (!allowed) {
      throw new ForbiddenException('Vote read permission is required');
    }

    return true;
  }
}
