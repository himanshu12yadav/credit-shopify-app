import prisma from "../app/db.server.js";

async function seedBatch2Features() {
  const shop = "pdf-store-15eu7f4v.myshopify.com";

  // 1. Seed Return Conversions
  const returnCount = await prisma.creditLedger.count({ where: { shop, source: "REFUND_CREDIT" } });
  if (returnCount === 0) {
    await prisma.creditLedger.createMany({
      data: [
        {
          shop,
          customerId: "gid://shopify/Customer/26024363524177",
          customerEmail: "himanshuyadav.12jan@gmail.com",
          customerName: "Himanshu Yadav",
          amount: 60.0,
          currency: "USD",
          action: "CREDIT",
          source: "REFUND_CREDIT",
          orderId: "gid://shopify/Order/1002",
          note: "Return converted to credit: $50.00 base + 20% bonus ($10.00)",
          metadata: JSON.stringify({
            orderId: "#1002",
            baseRefund: 50.0,
            bonusPercent: 20,
            bonusAmount: 10.0,
            cashSaved: 50.0,
            convertedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          }),
          status: "COMPLETED",
        },
        {
          shop,
          customerId: "gid://shopify/Customer/demo_sarah",
          customerEmail: "sarah.connor@example.com",
          customerName: "Sarah Connor",
          amount: 115.0,
          currency: "USD",
          action: "CREDIT",
          source: "REFUND_CREDIT",
          orderId: "gid://shopify/Order/1005",
          note: "Return converted to credit: $100.00 base + 15% bonus ($15.00)",
          metadata: JSON.stringify({
            orderId: "#1005",
            baseRefund: 100.0,
            bonusPercent: 15,
            bonusAmount: 15.0,
            cashSaved: 100.0,
            convertedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
          }),
          status: "COMPLETED",
        },
      ],
    });
    console.log("Seeded Return Conversions.");
  }

  // 2. Seed Flow Actions
  const flowCount = await prisma.creditLedger.count({ where: { shop, source: "FLOW_ACTION" } });
  if (flowCount === 0) {
    await prisma.creditLedger.createMany({
      data: [
        {
          shop,
          customerId: "gid://shopify/Customer/26024363524177",
          customerEmail: "himanshuyadav.12jan@gmail.com",
          customerName: "Himanshu Yadav",
          amount: 5.0,
          currency: "USD",
          action: "CREDIT",
          source: "FLOW_ACTION",
          note: "[Flow: Judge.me 5-Star Review] Verified buyer 5-star review bonus",
          metadata: JSON.stringify({
            triggerName: "Judge.me 5-Star Review",
            executedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
            flowId: "flow-judgeme-review-01",
          }),
          status: "COMPLETED",
        },
        {
          shop,
          customerId: "gid://shopify/Customer/demo_marcus",
          customerEmail: "marcus.vance@example.com",
          customerName: "Marcus Vance",
          amount: 10.0,
          currency: "USD",
          action: "CREDIT",
          source: "FLOW_ACTION",
          note: "[Flow: Recharge Subscription #3] 3rd recurring delivery milestone perk",
          metadata: JSON.stringify({
            triggerName: "Recharge Subscription #3",
            executedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
            flowId: "flow-recharge-milestone-03",
          }),
          status: "COMPLETED",
        },
      ],
    });
    console.log("Seeded Flow Actions.");
  }

  console.log("Batch 2 seeding complete!");
}

seedBatch2Features().finally(() => process.exit());
