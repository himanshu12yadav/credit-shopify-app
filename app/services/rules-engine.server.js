import prisma from "../db.server";
import { creditCustomer } from "./store-credit.server";
import { getCustomerTier } from "./tiers.server";

/**
 * Rules and Automation Engine for Store Credit
 */

export async function processOrderForCredit({ admin, shop, order }) {
  if (!order || !order.customer) {
    console.log("Order has no associated customer, skipping credit processing.");
    return { rewarded: false, reason: "NO_CUSTOMER" };
  }

  const customerId = order.customer.admin_graphql_api_id || `gid://shopify/Customer/${order.customer.id}`;
  const customerEmail = order.customer.email;
  const customerName = `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email;
  const orderId = order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`;
  const orderTotal = parseFloat(order.total_price || "0");
  const currency = order.currency || "USD";
  const customerOrdersCount = parseInt(order.customer.orders_count || "1", 10);
  const customerTotalSpent = parseFloat(order.customer.total_spent || "0");
  const customerTags = (order.customer.tags || "").split(",").map((t) => t.trim().toLowerCase());

  // Avoid processing the same order twice
  const existingReward = await prisma.creditLedger.findFirst({
    where: {
      shop,
      orderId: String(orderId),
      action: "CREDIT",
    },
  });

  if (existingReward) {
    console.log(`Order ${orderId} has already received credit, skipping.`);
    return { rewarded: false, reason: "ALREADY_PROCESSED" };
  }

  // Fetch shop settings
  let settings = await prisma.creditSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await prisma.creditSettings.create({
      data: { shop, defaultCurrency: currency },
    });
  }

  // Fetch active rules for this shop
  const rules = await prisma.creditRule.findMany({
    where: { shop, isActive: true },
  });

  // Fetch active campaigns for bonus multipliers
  const now = new Date();
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      shop,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  let totalCreditToAward = 0;
  let appliedRules = [];
  let noteParts = [];
  let maxExpiryDays = settings.defaultExpiryDays || 90;

  // 1. VIP Tier lookup and Cashback rate determination
  const vipTier = await getCustomerTier(shop, customerTotalSpent);
  const effectiveCashbackRate =
    vipTier && vipTier.cashbackRate > (settings.cashbackRate || 0)
      ? vipTier.cashbackRate
      : (settings.cashbackRate || 5.0);

  if (settings.cashbackEnabled && effectiveCashbackRate > 0) {
    const cashbackAmount = orderTotal * (effectiveCashbackRate / 100);
    if (cashbackAmount > 0) {
      totalCreditToAward += cashbackAmount;
      if (vipTier && vipTier.cashbackRate > (settings.cashbackRate || 0)) {
        noteParts.push(`${vipTier.name} VIP ${effectiveCashbackRate}% cashback`);
        appliedRules.push(`${vipTier.name} VIP Tier`);
      } else {
        noteParts.push(`${effectiveCashbackRate}% standard cashback`);
      }
    }
  }

  // 2. Evaluate specific custom rules
  for (const rule of rules) {
    let qualifies = false;

    if (rule.trigger === "ORDER_PAID") {
      qualifies = orderTotal >= rule.minSpend;
    } else if (rule.trigger === "FIRST_ORDER") {
      qualifies = customerOrdersCount <= 1 && orderTotal >= rule.minSpend;
    } else if (rule.trigger === "SPEND_THRESHOLD") {
      qualifies = orderTotal >= rule.minSpend;
    } else if (rule.trigger === "CUSTOMER_TAG" && rule.customerTag) {
      qualifies = customerTags.includes(rule.customerTag.toLowerCase().trim()) && orderTotal >= rule.minSpend;
    }

    if (qualifies) {
      let award = 0;
      if (rule.creditType === "PERCENTAGE") {
        award = (orderTotal * (rule.creditValue / 100));
        if (rule.maxCredit && award > rule.maxCredit) {
          award = rule.maxCredit;
        }
      } else {
        award = rule.creditValue;
      }

      if (award > 0) {
        totalCreditToAward += award;
        appliedRules.push(rule.title);
        noteParts.push(`${rule.title}: +$${award.toFixed(2)}`);
        if (rule.expiryDays) {
          maxExpiryDays = Math.min(maxExpiryDays, rule.expiryDays);
        }
      }
    }
  }

  // 3. Evaluate Campaign bonus multipliers
  for (const campaign of activeCampaigns) {
    if (orderTotal >= campaign.minSpend) {
      if (campaign.bonusMultiplier > 1.0) {
        const bonus = totalCreditToAward * (campaign.bonusMultiplier - 1.0);
        totalCreditToAward += bonus;
        noteParts.push(`Campaign ${campaign.name} (${campaign.bonusMultiplier}x multiplier)`);
      }
      if (campaign.bonusFixedAmount > 0) {
        totalCreditToAward += campaign.bonusFixedAmount;
        noteParts.push(`Campaign ${campaign.name} (+$${campaign.bonusFixedAmount.toFixed(2)})`);
      }
    }
  }

  // 4. Process Advocate Referral Reward
  if (settings.referralsEnabled) {
    const noteAttrs = order.note_attributes || [];
    const refAttr = noteAttrs.find((a) => a.name === "referral_code" || a.name === "ref");
    const refCodeFromNote = refAttr?.value || null;

    const refCodeFromTags = [...(order.tags ? order.tags.split(",") : []), ...customerTags]
      .map((t) => t.trim())
      .find((t) => t.toUpperCase().startsWith("REF-"));

    const matchedRefCode = refCodeFromNote || refCodeFromTags;

    if (matchedRefCode) {
      try {
        const referral = await prisma.referral.findFirst({
          where: { shop, referralCode: matchedRefCode.toUpperCase() },
        });

        if (referral && referral.referrerCustomerId !== customerId) {
          const advocateAward = referral.advocateRewardAmount || 10.0;
          await creditCustomer({
            admin,
            shop,
            customerId: referral.referrerCustomerId,
            customerEmail: referral.referrerEmail,
            customerName: referral.referrerEmail || "Advocate",
            orderId,
            amount: advocateAward,
            currencyCode: currency,
            notify: settings.autoNotifyCustomer,
            source: "REFERRAL",
            note: `Referral reward from ${customerName || customerEmail} (${matchedRefCode})`,
            idempotencyKey: `referral:${matchedRefCode.toUpperCase()}:${orderId}`,
          });

          await prisma.referral.update({
            where: { id: referral.id },
            data: { claimsCount: { increment: 1 } },
          });

          appliedRules.push(`Advocate Referral Bonus ($${advocateAward})`);
        }
      } catch (refErr) {
        console.error("Error processing referral reward:", refErr);
      }
    }
  }

  if (totalCreditToAward <= 0) {
    return { rewarded: false, reason: "NO_RULES_MATCHED" };
  }

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + maxExpiryDays);

  const finalNote = noteParts.join(", ") || "Order reward credit";

  // Issue the credit
  const result = await creditCustomer({
    admin,
    shop,
    customerId,
    customerEmail,
    customerName,
    orderId,
    amount: totalCreditToAward,
    currencyCode: currency,
    expiresAt,
    notify: settings.autoNotifyCustomer,
    source: appliedRules.length > 0 ? "RULE_AWARD" : "CASHBACK",
    note: finalNote,
    idempotencyKey: `order:${orderId}`,
    // Amount here is computed server-side from a verified webhook's order
    // total plus merchant-configured rules, not user input — use a high
    // sanity ceiling rather than the generic per-source cap.
    maxAmount: 100000,
  });

  // Sync customer loyalty metafields for real-time storefront display
  try {
    const newTotalSpent = customerTotalSpent + orderTotal;
    const newOrdersCount = customerOrdersCount + 1;
    const newTier = await getCustomerTier(shop, newTotalSpent);

    await admin.graphql(
      `#graphql
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: customerId,
            metafields: [
              {
                namespace: "credit_app",
                key: "total_spent",
                type: "number_decimal",
                value: newTotalSpent.toFixed(2),
              },
              {
                namespace: "credit_app",
                key: "orders_count",
                type: "number_integer",
                value: String(newOrdersCount),
              },
              {
                namespace: "credit_app",
                key: "vip_tier",
                type: "single_line_text_field",
                value: newTier?.name || "Bronze",
              },
            ],
          },
        },
      }
    );
  } catch (err) {
    console.error("Failed to sync customer loyalty metafields:", err);
  }

  return {
    rewarded: true,
    amountAwarded: totalCreditToAward,
    currency,
    appliedRules,
    result,
  };
}

/**
 * Process return / refund to store credit with incentive bonus
 */
export async function issueRefundStoreCredit({
  admin,
  shop,
  customerId,
  customerEmail,
  customerName,
  refundAmount,
  currency = "USD",
  currencyCode,
  applyBonus = true,
  customBonusPercent = null,
  bonusPercentage = null,
  reason,
}) {
  const activeCurrency = (currencyCode || currency || "USD").toUpperCase();
  const settings = await prisma.creditSettings.findUnique({
    where: { shop },
  });

  const bonusPercent =
    bonusPercentage !== null
      ? parseFloat(bonusPercentage)
      : customBonusPercent !== null
      ? parseFloat(customBonusPercent)
      : (settings?.returnCreditBonusPercent || 10.0);

  const numericRefund = parseFloat(refundAmount);
  let totalCredit = numericRefund;
  let bonusAmount = 0;

  if (applyBonus && bonusPercent > 0) {
    bonusAmount = numericRefund * (bonusPercent / 100);
    totalCredit += bonusAmount;
  }

  let note = reason || `Refund converted to Store Credit ($${numericRefund.toFixed(2)})`;
  if (applyBonus && bonusAmount > 0) {
    note += ` + ${bonusPercent}% Return Bonus (+$${bonusAmount.toFixed(2)})`;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (settings?.defaultExpiryDays || 365));

  const creditRes = await creditCustomer({
    admin,
    shop,
    customerId,
    customerEmail,
    customerName,
    amount: totalCredit,
    currencyCode: activeCurrency,
    expiresAt,
    notify: true,
    source: "REFUND_CREDIT",
    note,
  });

  return {
    ...creditRes,
    totalCredited: totalCredit.toFixed(2),
    refundAmount: numericRefund.toFixed(2),
    bonusAmount: bonusAmount.toFixed(2),
    bonusPercent,
  };
}
