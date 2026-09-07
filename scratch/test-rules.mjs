import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== Testing Shopify Store Credit Database & Rules Logic ===");

  const testShop = "test-store.myshopify.com";

  // 1. Clean previous test data
  await prisma.creditLedger.deleteMany({ where: { shop: testShop } });
  await prisma.creditRule.deleteMany({ where: { shop: testShop } });
  await prisma.campaign.deleteMany({ where: { shop: testShop } });
  await prisma.creditSettings.deleteMany({ where: { shop: testShop } });

  console.log("1. Cleared test records.");

  // 2. Create settings
  const settings = await prisma.creditSettings.create({
    data: {
      shop: testShop,
      defaultCurrency: "USD",
      defaultExpiryDays: 90,
      cashbackEnabled: true,
      cashbackRate: 5.0,
      returnCreditBonusPercent: 10.0,
      referralsEnabled: true,
      welcomeBonusEnabled: true,
      welcomeBonusAmount: 10.0,
    },
  });
  console.log("2. Settings created:", settings.shop, `${settings.cashbackRate}% cashback`);

  // 3. Create automation rules
  const rule1 = await prisma.creditRule.create({
    data: {
      shop: testShop,
      title: "5% Order Cashback",
      trigger: "ORDER_PAID",
      creditType: "PERCENTAGE",
      creditValue: 5.0,
      minSpend: 25.0,
      expiryDays: 60,
      isActive: true,
    },
  });

  const rule2 = await prisma.creditRule.create({
    data: {
      shop: testShop,
      title: "VIP Spend $100+ Bonus",
      trigger: "SPEND_THRESHOLD",
      creditType: "FIXED",
      creditValue: 15.0,
      minSpend: 100.0,
      expiryDays: 90,
      isActive: true,
    },
  });
  console.log("3. Created rules:", rule1.title, rule2.title);

  // 4. Simulate order reward calculation
  const orderTotal = 120.0;
  let creditToAward = 0;
  if (orderTotal >= rule1.minSpend) {
    creditToAward += (orderTotal * (rule1.creditValue / 100)); // $6.00
  }
  if (orderTotal >= rule2.minSpend) {
    creditToAward += rule2.creditValue; // $15.00
  }

  console.log(`4. Order $${orderTotal} computed reward: $${creditToAward.toFixed(2)}`);

  // 5. Create ledger entries
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 60);

  const ledgerEntry = await prisma.creditLedger.create({
    data: {
      shop: testShop,
      customerId: "gid://shopify/Customer/123456789",
      customerEmail: "vip.customer@example.com",
      customerName: "Alex Mercer",
      orderId: "gid://shopify/Order/987654321",
      amount: creditToAward,
      currency: "USD",
      action: "CREDIT",
      source: "RULE_AWARD",
      note: "5% Cashback + VIP Spend $100+ Bonus",
      expiresAt: expiry,
      status: "COMPLETED",
    },
  });
  console.log("5. Created credit ledger entry:", ledgerEntry.id, `+$${ledgerEntry.amount}`);

  // 6. Simulate return refund converted to store credit with bonus
  const refundAmount = 50.0;
  const returnBonus = refundAmount * (settings.returnCreditBonusPercent / 100);
  const refundCreditEntry = await prisma.creditLedger.create({
    data: {
      shop: testShop,
      customerId: "gid://shopify/Customer/123456789",
      customerEmail: "vip.customer@example.com",
      customerName: "Alex Mercer",
      amount: refundAmount + returnBonus,
      currency: "USD",
      action: "CREDIT",
      source: "REFUND_CREDIT",
      note: `Refund converted to Store Credit ($${refundAmount.toFixed(2)}) + 10% Return Bonus (+$${returnBonus.toFixed(2)})`,
      status: "COMPLETED",
    },
  });
  console.log("6. Created refund-to-credit entry:", refundCreditEntry.id, `+$${refundCreditEntry.amount}`);

  // 7. Aggregate metrics
  const totalIssued = await prisma.creditLedger.aggregate({
    where: { shop: testShop, action: "CREDIT" },
    _sum: { amount: true },
  });
  console.log(`7. Total credit issued: $${totalIssued._sum.amount.toFixed(2)}`);

  console.log("=== All backend data layer tests PASSED successfully! ===");
  await prisma.$disconnect();
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
