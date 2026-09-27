import { unauthenticated } from "../shopify.server";
import { resolveShopFromExternalApiKey } from "../services/api-keys.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// NOTE: there is currently no persistent birthday storage in this app — the
// storefront birthday-collector block and src/trigger/birthday-credits.ts
// are both stubs that don't yet write/read a customer birthdate anywhere.
// This route is the issuance step of that (currently unbuilt) pipeline; it
// authenticates the caller with the shop's external API key so an external
// automation (e.g. a Klaviyo/Flow birthday trigger) can call it safely once
// wired up, and requires an explicit customer identity rather than ever
// falling back to demo data.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

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
    const { customerId, email, amount = 10.0 } = body;

    if (!customerId && !email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters (customerId or email)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { admin } = await unauthenticated.admin(shop);

    let targetCustomerId = customerId;
    if (!targetCustomerId && email) {
      const resp = await admin.graphql(
        `#graphql
        query findCust($q: String!) { customers(first: 1, query: $q) { nodes { id } } }`,
        { variables: { q: `email:${email}` } }
      );
      const json = await resp.json();
      targetCustomerId = json.data?.customers?.nodes?.[0]?.id;
    }

    if (!targetCustomerId) {
      return new Response(JSON.stringify({ success: false, error: "Customer not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const result = await creditCustomer({
      admin,
      shop,
      customerId: targetCustomerId,
      customerEmail: email,
      amount,
      currencyCode: "USD",
      expiresAt,
      source: "BIRTHDAY_REWARD",
      note: `🎂 Happy Birthday! Birthday Gift Credit (Expires in 14 Days)`,
      idempotencyKey: `birthday:${shop}:${targetCustomerId}:${new Date().getUTCFullYear()}`,
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
        message: `Successfully deposited $${result.ledgerEntry.amount.toFixed(2)} Birthday Perk!`,
        ledgerId: result.ledgerEntry.id,
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
    console.error("Birthday credit error:", err);
    return new Response(JSON.stringify({ success: false, error: "Failed to process birthday credit" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ status: "birthday cron listening" }), {
    headers: { "Content-Type": "application/json" },
  });
};
