import { schedules, logger } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const PIXEL_EVENT_RETENTION_DAYS = 90;

export const purgeOldPixelEventsTask = schedules.task({
  id: "purge-old-pixel-events",
  cron: { pattern: "0 2 * * *", timezone: "UTC" }, // Runs daily at 2:00 AM UTC
  run: async (payload) => {
    const prisma = new PrismaClient();

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - PIXEL_EVENT_RETENTION_DAYS);

      const { count } = await prisma.pixelEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      logger.info("Purged old PixelEvent rows", {
        timestamp: payload.timestamp,
        cutoff: cutoff.toISOString(),
        deletedCount: count,
      });

      return { task: "purge-old-pixel-events", deletedCount: count };
    } finally {
      await prisma.$disconnect();
    }
  },
});
