import { schedules, logger } from "@trigger.dev/sdk";

export const dailyCreditExpirationTask = schedules.task({
  id: "daily-credit-expiration-sweep",
  cron: { pattern: "0 1 * * *", timezone: "UTC" }, // Runs daily at 1:00 AM UTC
  run: async (payload) => {
    logger.info("Executing daily credit ledger expiration sweep", {
      timestamp: payload.timestamp,
    });

    return {
      task: "daily-credit-expiration-sweep",
      executedAt: payload.timestamp,
    };
  },
});
