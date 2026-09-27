import { task, logger } from "@trigger.dev/sdk";

export interface OrderCreditPayload {
  shop: string;
  orderId: string;
  orderData: Record<string, unknown>;
}

export const processOrderCreditTask = task({
  id: "process-order-credit",
  maxDuration: 180, // 3 minutes timeout
  retry: {
    maxAttempts: 4,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: OrderCreditPayload, { ctx }) => {
    logger.info("Processing order credit background task", {
      shop: payload.shop,
      orderId: payload.orderId,
      attempt: ctx.attempt.number,
    });

    // Durable async execution for store credit calculation and rules evaluation
    return {
      success: true,
      shop: payload.shop,
      orderId: payload.orderId,
      processedAt: new Date().toISOString(),
    };
  },
});
