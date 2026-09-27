import { unauthenticated } from "../shopify.server";
import { resolveShopFromExternalApiKey } from "../services/api-keys.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// Inbound webhook from a third-party review platform (Loox/Judge.me/Yotpo),
// configured by the merchant with the shop's external API key as a Bearer
// token (see app/routes/app.reviews.jsx). This is a direct server-to-server
// call from the review platform, not a storefront request, so it is not an
// App Proxy route.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

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

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const shop = await resolveShopFromExternalApiKey(request);
  if (!shop) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const body = await request.json();
    const {
      email,
      customerName = "Reviewer",
      rating = 5,
      hasPhoto = false,
      hasVideo = false,
      platform = "Loox/Judge.me/Yotpo",
      reviewId,
    } = body;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Missing email parameter" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    let rewardAmount = 3.0;
    let reviewTypeLabel = "Text Review";
    if (hasVideo) {
      rewardAmount = 10.0;
      reviewTypeLabel = "Verified Video Review";
    } else if (hasPhoto) {
      rewardAmount = 5.0;
      reviewTypeLabel = "Verified Photo Review";
    }

    const { admin } = await unauthenticated.admin(shop);

    const custResp = await admin.graphql(FIND_CUSTOMER_QUERY, {
      variables: { q: `email:${email.toLowerCase()}` },
    });
    const custJson = await custResp.json();
    const customer = custJson.data?.customers?.nodes?.[0];

    if (!customer) {
      return new Response(
        JSON.stringify({ success: false, error: `Customer not found with email ${email}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    const result = await creditCustomer({
      admin,
      shop,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.displayName || customerName,
      amount: rewardAmount,
      currencyCode: "USD",
      source: "REVIEW_REWARD",
      note: `⭐ ${rating}-Star ${reviewTypeLabel} via ${platform}`,
      // De-dupe on the review platform's own review id when supplied, so a
      // webhook retry can't double-credit the same review.
      idempotencyKey: reviewId ? `review:${shop}:${platform}:${reviewId}` : undefined,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.apiError || "Failed to issue credit" }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Awarded $${result.ledgerEntry.amount.toFixed(2)} store credit for ${reviewTypeLabel}!`,
        ledgerId: result.ledgerEntry.id,
        rewardAmount: result.ledgerEntry.amount,
        duplicate: Boolean(result.duplicate),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    if (err instanceof CreditValidationError) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    console.error("Reviews webhook error:", err);
    return new Response(JSON.stringify({ success: false, error: "Failed to process review reward" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.reviews.webhook", status: "listening" }), {
    headers: { "Content-Type": "application/json" },
  });
};
