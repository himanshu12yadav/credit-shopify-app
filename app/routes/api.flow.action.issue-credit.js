import { unauthenticated } from "../shopify.server";
import { resolveShopFromExternalApiKey } from "../services/api-keys.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// Configured as a "Send an HTTP request" step in Shopify Flow, or by a
// merchant's own automation tooling — authenticated with the shop's private
// external-integration API key (see app/services/api-keys.server.js) sent as
// an Authorization: Bearer header, since Flow HTTP actions carry merchant-
// configured headers rather than a Shopify session token.
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
      customerId,
      customerEmail,
      amount,
      note = "Issued via Shopify Flow Automation",
      triggerName = "Shopify Flow",
      expiryDays = 90,
      idempotencyKey,
    } = body;

    if ((!customerId && !customerEmail) || amount === undefined || amount === null) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters (customer, amount)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { admin } = await unauthenticated.admin(shop);

    let targetCustomerId = customerId;
    let targetCustomerEmail = customerEmail;
    if (!targetCustomerId && customerEmail) {
      const queryResp = await admin.graphql(FIND_CUSTOMER_BY_EMAIL_QUERY, {
        variables: { query: `email:${customerEmail}` },
      });
      const qJson = await queryResp.json();
      const match = qJson.data?.customers?.nodes?.[0];
      targetCustomerId = match?.id;
      targetCustomerEmail = match?.email || customerEmail;
    }

    if (!targetCustomerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Target customer not found in Shopify" }),
        { status: 404, headers: corsHeaders }
      );
    }

    let expiresAt = null;
    if (expiryDays && parseInt(expiryDays, 10) > 0) {
      const exp = new Date();
      exp.setDate(exp.getDate() + parseInt(expiryDays, 10));
      expiresAt = exp;
    }

    const result = await creditCustomer({
      admin,
      shop,
      customerId: targetCustomerId,
      customerEmail: targetCustomerEmail,
      amount,
      currencyCode: "USD",
      expiresAt,
      source: "FLOW_ACTION",
      note: `[Flow: ${triggerName}] ${note}`,
      metadata: { triggerName, executedAt: new Date().toISOString() },
      // Flow can pass its own run/workflow id for exactly-once semantics;
      // otherwise fall back to a per-shop+customer+trigger+day key so a
      // retried Flow step doesn't double-credit.
      idempotencyKey:
        idempotencyKey ||
        `flow:${shop}:${targetCustomerId}:${triggerName}:${new Date().toISOString().slice(0, 10)}`,
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
        message: `Shopify Flow issued $${result.ledgerEntry.amount.toFixed(2)} store credit`,
        transactionId: result.shopifyTxId,
        ledgerId: result.ledgerEntry.id,
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
    console.error("Shopify Flow execution error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to execute Flow action" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.flow.action.issue-credit", status: "ready" }), {
    headers: { "Content-Type": "application/json" },
  });
};
