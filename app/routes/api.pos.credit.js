import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getCustomerTier } from "../services/tiers.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";

// Called from the credit-pos POS UI extension, which sends the extension's
// session token (shopify.session.getSessionToken()) as an Authorization:
// Bearer header — verified the same way as embedded-app session tokens.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GET_POS_CUSTOMER_QUERY = `#graphql
  query getPosCust($id: ID!) {
    customer(id: $id) {
      id
      displayName
      email
      phone
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

const FIND_CUSTOMER_BY_EMAIL_QUERY = `#graphql
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

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const customerEmail = url.searchParams.get("email");

  try {
    let targetGid = customerId;
    if (!targetGid && customerEmail) {
      const qResp = await admin.graphql(FIND_CUSTOMER_BY_EMAIL_QUERY, {
        variables: { q: `email:${customerEmail}` },
      });
      const qJson = await qResp.json();
      targetGid = qJson.data?.customers?.nodes?.[0]?.id;
    }

    if (!targetGid) {
      return Response.json({ success: false, error: "Customer not found on POS" }, { status: 404, headers: corsHeaders });
    }

    const custResp = await admin.graphql(GET_POS_CUSTOMER_QUERY, { variables: { id: targetGid } });
    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";

    let vipTier = { name: "Bronze VIP", cashbackRate: 5.0 };
    try {
      vipTier = await getCustomerTier(shop, parseFloat(cust?.amountSpent?.amount || "0"));
    } catch {
      // fallback
    }

    const recentLedger = await prisma.creditLedger.findMany({
      where: { shop, customerId: targetGid },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return Response.json(
      {
        success: true,
        customer: {
          id: cust?.id,
          displayName: cust?.displayName,
          email: cust?.email,
          phone: cust?.phone,
          creditBalance: balance,
          currency,
          tierName: vipTier?.name || "Bronze VIP",
          cashbackRate: vipTier?.cashbackRate || 5.0,
        },
        recentTransactions: recentLedger,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("api.pos.credit loader error:", err);
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
    const { customerId, customerEmail, amount, note = "POS In-Store Adjustment" } = body;

    if (!customerId) {
      return Response.json({ success: false, error: "Missing customerId" }, { status: 400, headers: corsHeaders });
    }

    const result = await creditCustomer({
      admin,
      shop,
      customerId,
      customerEmail,
      amount,
      currencyCode: "USD",
      source: "POS",
      note: `[Shopify POS Register] ${note}`,
    });

    if (!result.success) {
      return Response.json({ success: false, error: result.apiError || "Failed to issue credit" }, { status: 502, headers: corsHeaders });
    }

    return Response.json(
      {
        success: true,
        message: `Successfully issued $${result.ledgerEntry.amount.toFixed(2)} on POS register!`,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    if (err instanceof CreditValidationError) {
      return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
    }
    console.error("api.pos.credit action error:", err);
    return Response.json({ success: false, error: "Failed to issue credit" }, { status: 500, headers: corsHeaders });
  }
};
