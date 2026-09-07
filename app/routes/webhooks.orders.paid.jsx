import { authenticate } from "../shopify.server";
import { processOrderForCredit } from "../services/rules-engine.server";

export const action = async ({ request }) => {
  const { shop, payload, admin, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}. Order ID: ${payload?.id}`);

  if (admin && payload) {
    try {
      const outcome = await processOrderForCredit({
        admin,
        shop,
        order: payload,
      });
      console.log("Order credit evaluation result:", outcome);
    } catch (error) {
      console.error("Failed to process order for credit:", error);
    }
  }

  return new Response();
};
