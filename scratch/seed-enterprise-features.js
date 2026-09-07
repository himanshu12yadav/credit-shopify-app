import prisma from "../app/db.server.js";

async function seedEnterpriseFeatures() {
  const shop = "pdf-store-15eu7f4v.myshopify.com";

  // 1. Seed Milestone Credit Drop Campaigns
  const campaignCount = await prisma.campaign.count({ where: { shop, type: "CREDIT_DROP" } });
  if (campaignCount === 0) {
    const now = new Date();
    await prisma.campaign.createMany({
      data: [
        {
          shop,
          name: "🌟 $15 VIP Gold Loyalty Milestone Drop",
          type: "CREDIT_DROP",
          targetSegment: "VIP_GOLD",
          dropAmount: 15.0,
          expiryDays: 30,
          startDate: now,
          endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
          status: "COMPLETED",
          recipientCount: 4,
          totalDisbursed: 60.0,
        },
        {
          shop,
          name: "💌 $20 Win-Back (Dormant 60+ Days)",
          type: "CREDIT_DROP",
          targetSegment: "DORMANT_60D",
          dropAmount: 20.0,
          expiryDays: 14,
          startDate: now,
          endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          isActive: true,
          status: "SCHEDULED",
          recipientCount: 0,
          totalDisbursed: 0.0,
        },
      ],
    });
    console.log("Seeded Milestone Credit Drop Campaigns.");
  }

  // 2. Seed Customer Support Appeasements
  const appeasementCount = await prisma.creditLedger.count({ where: { shop, source: "APPEASEMENT" } });
  if (appeasementCount === 0) {
    await prisma.creditLedger.createMany({
      data: [
        {
          shop,
          customerId: "gid://shopify/Customer/26024363524177",
          customerEmail: "himanshuyadav.12jan@gmail.com",
          customerName: "Himanshu Yadav",
          amount: 25.0,
          currency: "USD",
          action: "CREDIT",
          source: "APPEASEMENT",
          note: "[Damaged Merchandise] Replaced order damaged during transit",
          metadata: JSON.stringify({
            reason: "Damaged / Defective Merchandise",
            ticketId: "ZD-49102",
            agent: "Sarah Connor (Tier 2)",
            issuedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
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
          source: "APPEASEMENT",
          note: "[Late Shipping] Courier experienced 3-day hub weather delay",
          metadata: JSON.stringify({
            reason: "Late Shipping / Delayed Order",
            ticketId: "GORG-8821",
            agent: "Alex Rivera",
            issuedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          }),
          status: "COMPLETED",
        },
      ],
    });
    console.log("Seeded Support Appeasement entries.");
  }

  // 3. Seed Digital Gift Card entries
  const giftCount = await prisma.creditLedger.count({ where: { shop, source: "GIFT_CARD" } });
  if (giftCount === 0) {
    await prisma.creditLedger.createMany({
      data: [
        {
          shop,
          customerId: "gid://shopify/Customer/26024363524177",
          customerEmail: "himanshuyadav.12jan@gmail.com",
          customerName: "Himanshu Yadav",
          amount: 50.0,
          currency: "USD",
          action: "CREDIT",
          source: "GIFT_CARD",
          note: 'Gift Card from Elena R.: "Happy Birthday Himanshu! Have fun shopping 🎉"',
          metadata: JSON.stringify({
            senderName: "Elena Rostova",
            senderEmail: "elena@example.com",
            recipientName: "Himanshu Yadav",
            recipientEmail: "himanshuyadav.12jan@gmail.com",
            message: "Happy Birthday Himanshu! Have fun shopping 🎉",
            skin: "emerald",
            claimedAt: new Date().toISOString(),
          }),
          status: "COMPLETED",
        },
      ],
    });
    console.log("Seeded Digital Gift Card entries.");
  }

  console.log("Enterprise features seeding complete!");
}

seedEnterpriseFeatures().finally(() => process.exit());
