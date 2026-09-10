import { type StructuredLoggerLike } from '@kangjuhyup/rvlog';
import {
  enrichRvlogContext,
  runWithRvlogContext,
} from '@kangjuhyup/rvlog-nest';

interface VoteCountJob {
  id: string;
  traceId: string;
  tenantId: string;
  requestedBy: string;
  voteId: string;
}

export async function handleVoteCountJob(
  job: VoteCountJob,
  logger: StructuredLoggerLike,
): Promise<void> {
  await runWithRvlogContext(
    { requestId: job.id, traceId: job.traceId },
    async () => {
      enrichRvlogContext({
        tenantId: job.tenantId,
        userPrincipalId: job.requestedBy,
      });

      logger.event('vote.count.completed', { voteId: job.voteId });
    },
  );
}
