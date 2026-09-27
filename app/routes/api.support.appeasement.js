import { unauthenticated } from "../shopify.server";
import { resolveShopFromExternalApiKey } from "../services/api-keys.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// Called by a merchant's external helpdesk (Zendesk/Gorgias macro), never by
// the embedded app itself — authenticated with a per-shop bearer key from
// getOrCreateExternalApiKey rather than a Shopify session token.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const FIND_CUSTOMER_BY_EMAIL_QUERY = `#graphql
  query findCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        displayName
        email
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
      customerEmail,
      amount,
      reason = "Customer Service Goodwill",
      ticketId = "ADMIN-DIRECT",
      agent = "Support Representative",
      note,
    } = body;

    if (!customerEmail || amount === undefined || amount === null) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (customerEmail, amount)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { admin } = await unauthenticated.admin(shop);

    const findResp = await admin.graphql(FIND_CUSTOMER_BY_EMAIL_QUERY, {
      variables: { query: `email:${customerEmail}` },
    });
    const findJson = await findResp.json();
    const customer = findJson.data?.customers?.nodes?.[0];

    if (!customer) {
      return new Response(
        JSON.stringify({ success: false, error: `Customer not found with email ${customerEmail}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Ticket IDs from a helpdesk are naturally unique per incident — use one
    // as the idempotency key so a retried webhook/macro can't double-credit.
    const idempotencyKey =
      ticketId && ticketId !== "ADMIN-DIRECT" ? `appeasement:${shop}:${ticketId}` : undefined;

    const result = await creditCustomer({
      admin,
      shop,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.displayName,
      amount,
      currencyCode: "USD",
      source: "APPEASEMENT",
      note: note ? `[${reason}] ${note}` : `Customer service appeasement: ${reason}`,
      metadata: { reason, ticketId, agent, appliedAt: new Date().toISOString() },
      idempotencyKey,
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
        message: `Successfully issued $${result.ledgerEntry.amount.toFixed(2)} appeasement to ${customer.displayName || customer.email}`,
        ledgerId: result.ledgerEntry.id,
        ticketId,
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
    console.error("Support appeasement error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process appeasement" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.support.appeasement", status: "active" }), {
    headers: { "Content-Type": "application/json" },
  });
};
