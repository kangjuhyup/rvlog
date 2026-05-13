import { LogLevel, withLogging } from '@kangjuhyup/rvlog';
import { appLoggerSystem } from '../../logger.config';

const runFailingJob = withLogging(
  async (jobId: string) => {
    throw new Error(`invoice export failed for ${jobId}`);
  },
  {
    context: 'ExpressAlertRoutingExample',
    name: 'exportInvoice',
    level: LogLevel.INFO,
    system: appLoggerSystem,
  },
);

export async function triggerExpressAlertThreshold(): Promise<{
  attempts: number;
  status: string;
}> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runFailingJob('job-77');
    } catch {
      console.info(`[rvlog express example] invoice export failure attempt ${attempt} captured`);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    attempts: 3,
    status: 'threshold example completed',
  };
}
