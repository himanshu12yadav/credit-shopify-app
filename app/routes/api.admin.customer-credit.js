import { authenticate } from "../shopify.server";
import { getCustomerTier } from "../services/tiers.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// Called exclusively from the credit-admin / credit-admin-block Admin UI
// extensions (admin.customer-details.*), which send the extension's session
// token (api.idToken()) as an Authorization: Bearer header — the same
// verification embedded-app pages use. CORS stays permissive here (as in
// Shopify's own extension-backend examples) because authorization is
// enforced by authenticate.admin verifying that token, not by Origin.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GET_ADMIN_CUSTOMER_CREDIT_QUERY = `#graphql
  query getAdminCustomerCredit($id: ID!) {
    customer(id: $id) {
      id
      displayName
      email
      amountSpent {
        amount
        currencyCode
      }
      storeCreditAccounts(first: 1) {
        nodes {
          id
          balance {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");

  if (!customerId) {
    return Response.json({ success: false, error: "Missing required params" }, { status: 400, headers: corsHeaders });
  }

  try {
    const custResp = await admin.graphql(GET_ADMIN_CUSTOMER_CREDIT_QUERY, {
      variables: { id: customerId },
    });
    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";
    const totalSpent = parseFloat(cust?.amountSpent?.amount || "0");

    let tier = { name: "Bronze VIP", cashbackRate: 5.0 };
    try {
      tier = await getCustomerTier(session.shop, totalSpent);
    } catch {
      // fallback
    }

    return Response.json(
      {
        success: true,
        customer: {
          id: cust?.id || customerId,
          displayName: cust?.displayName,
          email: cust?.email,
          balance,
          currency,
          tierName: tier?.name || "Bronze VIP",
          cashbackRate: tier?.cashbackRate || 5.0,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("api.admin.customer-credit loader error:", err);
    return Response.json({ success: false, error: "Failed to load customer" }, { status: 500, headers: corsHeaders });
  }
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const { customerId, amount, reason = "Admin Customer Appeasement" } = body;

    if (!customerId) {
      return Response.json({ success: false, error: "Missing customerId" }, { status: 400, headers: corsHeaders });
    }

    const result = await creditCustomer({
      admin,
      shop,
      customerId,
      amount,
      currencyCode: "USD",
      source: "APPEASEMENT",
      note: `[Shopify Admin Customer Page] ${reason}`,
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.apiError || "Failed to issue credit" },
        { status: 502, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        message: `Successfully issued $${result.ledgerEntry.amount.toFixed(2)} to customer`,
        transactionId: result.shopifyTxId,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    if (err instanceof CreditValidationError) {
      return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
    }
    console.error("api.admin.customer-credit action error:", err);
    return Response.json({ success: false, error: "Failed to issue credit" }, { status: 500, headers: corsHeaders });
  }
};
