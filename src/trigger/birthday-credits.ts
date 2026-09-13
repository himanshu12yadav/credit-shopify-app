import { schedules, logger } from "@trigger.dev/sdk";

export const dailyBirthdayRewardsTask = schedules.task({
  id: "daily-birthday-rewards",
  cron: { pattern: "0 0 * * *", timezone: "UTC" }, // Runs daily at midnight UTC
  run: async (payload) => {
    logger.info("Executing daily customer birthday rewards check", {
      timestamp: payload.timestamp,
      upcoming: payload.upcoming,
    });

    return {
      task: "daily-birthday-rewards",
      executedAt: payload.timestamp,
    };
  },
});
