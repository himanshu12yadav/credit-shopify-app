import prisma from "../db.server";

export const DEFAULT_TIERS = [
  {
    name: "Bronze",
    minSpend: 0.0,
    cashbackRate: 5.0,
    perks: "Standard 5% cashback on every purchase",
    badgeColor: "#b45309", // Bronze amber
    orderIndex: 0,
  },
  {
    name: "Silver",
    minSpend: 250.0,
    cashbackRate: 8.0,
    perks: "Boosted 8% cashback + 60-day expiry grace",
    badgeColor: "#64748b", // Silver slate
    orderIndex: 1,
  },
  {
    name: "Gold",
    minSpend: 500.0,
    cashbackRate: 12.0,
    perks: "VIP 12% cashback + early access to bonus drops",
    badgeColor: "#d97706", // Gold
    orderIndex: 2,
  },
  {
    name: "Platinum",
    minSpend: 1000.0,
    cashbackRate: 15.0,
    perks: "Elite 15% cashback + lifetime credit guarantee",
    badgeColor: "#4f46e5", // Platinum indigo
    orderIndex: 3,
  },
];

/**
 * Fetch all VIP tiers for a shop, seeding defaults if none exist
 */
export async function getVipTiers(shop) {
  if (!shop) {
    throw new Error("getVipTiers requires a shop");
  }

  let tiers = await prisma.vipTier.findMany({
    where: { shop },
    orderBy: { minSpend: "asc" },
  });

  if (tiers.length === 0) {
    // Seed default tiers
    for (const t of DEFAULT_TIERS) {
      await prisma.vipTier.create({
        data: { shop, ...t },
      });
    }

    tiers = await prisma.vipTier.findMany({
      where: { shop },
      orderBy: { minSpend: "asc" },
    });
  }

  return tiers;
}

export const getAllTiers = getVipTiers;

/**
 * Calculate the customer's matching VIP tier based on their cumulative spend
 */
export async function getCustomerTier(shop, totalSpent = 0) {
  const tiers = await getVipTiers(shop);
  const numericSpend = parseFloat(totalSpent) || 0;

  // Find the highest tier that the customer qualifies for
  let matchedTier = tiers[0] || null;
  for (const tier of tiers) {
    if (numericSpend >= tier.minSpend) {
      matchedTier = tier;
    }
  }

  return matchedTier;
}

export async function createVipTier(shop, data) {
  return await prisma.vipTier.create({
    data: {
      shop,
      name: data.name,
      minSpend: parseFloat(data.minSpend) || 0,
      cashbackRate: parseFloat(data.cashbackRate) || 5,
      perks: data.perks || null,
      badgeColor: data.badgeColor || "#6366f1",
      orderIndex: parseInt(data.orderIndex, 10) || 0,
    },
  });
}

export async function updateVipTier(id, data) {
  return await prisma.vipTier.update({
    where: { id },
    data: {
      name: data.name,
      minSpend: parseFloat(data.minSpend),
      cashbackRate: parseFloat(data.cashbackRate),
      perks: data.perks,
      badgeColor: data.badgeColor,
    },
  });
}

export async function deleteVipTier(id) {
  return await prisma.vipTier.delete({
    where: { id },
  });
}
