import { LogLevel, withLogging } from '@kangjuhyup/rvlog';

const failCheckout = withLogging(
  async (orderId: string) => {
    throw new Error(`checkout failed for ${orderId}`);
  },
  {
    context: 'AlertRoutingExample',
    name: 'checkout',
    level: LogLevel.INFO,
  },
);

export async function runAlertRoutingExample(): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await failCheckout('order-1001');
    } catch {
      console.info(`[rvlog example] checkout failure attempt ${attempt} captured`);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
}
