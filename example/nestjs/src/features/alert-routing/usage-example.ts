import { Injectable } from "@nestjs/common";
import { LogLevel, withLogging } from "@kangjuhyup/rvlog";
import { nestLoggerSystem } from "../logger-system";

const runFailingJob = withLogging(
  async (jobId: string) => {
    throw new Error(`billing sync failed for ${jobId}`);
  },
  {
    context: "NestAlertRoutingExample",
    name: "syncBilling",
    level: LogLevel.INFO,
    system: nestLoggerSystem,
  },
);

@Injectable()
export class NestAlertRoutingExample {
  async triggerThreshold(): Promise<{ attempts: number; status: string }> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await runFailingJob("job-42");
      } catch {
        console.info(`[rvlog nest example] billing sync failure attempt ${attempt} captured`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      attempts: 3,
      status: "threshold example completed",
    };
  }
}
