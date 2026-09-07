import prisma from "../app/db.server.js";

async function seedSampleReferrals() {
  const shop = "pdf-store-15eu7f4v.myshopify.com";
  
  // Seed sample referral advocates
  const existing = await prisma.referral.count({ where: { shop } });
  if (existing === 0) {
    await prisma.referral.createMany({
      data: [
        {
          shop,
          referrerCustomerId: "gid://shopify/Customer/26024363524177",
          referrerEmail: "himanshuyadav.12jan@gmail.com",
          referralCode: "REF-HIMANSHU",
          advocateRewardAmount: 10.0,
          friendRewardAmount: 10.0,
          claimsCount: 5,
        },
        {
          shop,
          referrerCustomerId: "gid://shopify/Customer/demo_sarah",
          referrerEmail: "sarah.connor@example.com",
          referralCode: "REF-SARAH",
          advocateRewardAmount: 10.0,
          friendRewardAmount: 10.0,
          claimsCount: 3,
        },
        {
          shop,
          referrerCustomerId: "gid://shopify/Customer/demo_marcus",
          referrerEmail: "marcus.vance@example.com",
          referralCode: "REF-MARCUS",
          advocateRewardAmount: 10.0,
          friendRewardAmount: 10.0,
          claimsCount: 1,
        },
      ],
    });
    console.log("Seeded sample referral advocates for leaderboard!");
  } else {
    console.log("Referrals already exist:", existing);
  }
}

seedSampleReferrals().finally(() => process.exit());
