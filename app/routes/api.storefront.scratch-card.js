import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";
import { isRateLimited, getClientIp } from "../services/rate-limit.server";

// Mounted behind the Shopify App Proxy (extensions/credit-storefront/blocks/
// scratch-card-modal.liquid posts to /apps/credit/api/storefront/scratch-card).
// The prize tier is picked server-side — never trust a client-supplied
// prizeAmount, since the scratch reveal is purely cosmetic client JS.
const PRIZE_TIERS = [
  { threshold: 0.05, amount: 50 },
  { threshold: 0.2, amount: 25 },
  { threshold: 0.65, amount: 10 },
  { threshold: 1, amount: 5 },
];

function rollPrize() {
  const rand = Math.random();
  let cumulative = 0;
  for (const tier of PRIZE_TIERS) {
    cumulative = tier.threshold;
    if (rand < cumulative) return tier.amount;
  }
  return PRIZE_TIERS[PRIZE_TIERS.length - 1].amount;
}

const RATE_LIMIT = { windowMs: 60_000, max: 5 };

const FIND_CUSTOMER_QUERY = `#graphql
  query findCust($q: String!) {
    customers(first: 1, query: $q) {
      nodes {
        id
        email
        displayName
      }
    }
  }
`;

const CREATE_CUSTOMER_MUTATION = `#graphql
  mutation custCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      userErrors {
        message
      }
    }
  }
`;

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return Response.json({ success: false, error: "Shop session not active" }, { status: 401 });
  }
  const shop = session.shop;

  const clientIp = getClientIp(request);
  if (isRateLimited(`scratch-card:${shop}:${clientIp}`, RATE_LIMIT)) {
    return Response.json({ success: false, error: "Too many attempts, please try again later" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, email } = body;

    if (!email) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase();

    // Abuse prevention: one claim per email per 30 days, plus a per-IP rate
    // limit above so a script can't just cycle through disposable emails.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingClaim = await prisma.creditLedger.findFirst({
      where: { shop, customerEmail: normalizedEmail, source: "SCRATCH_CARD", createdAt: { gte: thirtyDaysAgo } },
    });

    if (existingClaim) {
      return Response.json(
        { success: false, error: "You have already claimed a scratch card prize this month! Check back soon." },
        { status: 429 }
      );
    }

    const findResp = await admin.graphql(FIND_CUSTOMER_QUERY, {
      variables: { q: `email:${normalizedEmail}` },
    });
    const findJson = await findResp.json();
    let targetCustomerId = findJson.data?.customers?.nodes?.[0]?.id;

    if (!targetCustomerId) {
      const createResp = await admin.graphql(CREATE_CUSTOMER_MUTATION, {
        variables: {
          input: { firstName: name || "Customer", email: normalizedEmail, tags: ["scratch-card-lead", "store-credit-recipient"] },
        },
      });
      const createJson = await createResp.json();
      targetCustomerId = createJson.data?.customerCreate?.customer?.id;
    }

    if (!targetCustomerId) {
      return Response.json({ success: false, error: "Could not create customer account" }, { status: 500 });
    }

    const prizeAmount = rollPrize();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const result = await creditCustomer({
      admin,
      shop,
      customerId: targetCustomerId,
      customerEmail: normalizedEmail,
      customerName: name || "Shopper",
      amount: prizeAmount,
      currencyCode: "USD",
      expiresAt,
      source: "SCRATCH_CARD",
      note: `🎰 Won $${prizeAmount.toFixed(2)} Store Credit on Mystery Scratch Card`,
      idempotencyKey: `scratchcard:${shop}:${normalizedEmail}:${new Date().toISOString().slice(0, 10)}`,
    });

    if (!result.success) {
      return Response.json({ success: false, error: result.apiError || "Failed to issue prize" }, { status: 502 });
    }

    return Response.json({
      success: true,
      message: `Successfully deposited $${result.ledgerEntry.amount.toFixed(2)} to your wallet!`,
      prizeAmount: result.ledgerEntry.amount,
    });
  } catch (err) {
    if (err instanceof CreditValidationError) {
      return Response.json({ success: false, error: err.message }, { status: 400 });
    }
    console.error("Scratch card processing error:", err);
    return Response.json({ success: false, error: "Failed to process scratch card claim" }, { status: 500 });
  }
};

export const loader = async () => {
  return Response.json({ status: "ready" });
};
