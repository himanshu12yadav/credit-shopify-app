import prisma from "../db.server";
import { getCustomerTier } from "../services/tiers.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (!shop || !customerId) {
    return new Response(JSON.stringify({ success: false, error: "Missing required params" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Shop inactive" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const custResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
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
        `,
        variables: { id: customerId },
      }),
    });

    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";
    const totalSpent = parseFloat(cust?.amountSpent?.amount || "0");

    let tier = { name: "Bronze VIP", cashbackRate: 5.0 };
    try {
      tier = await getCustomerTier(shop, totalSpent);
    } catch {
      // fallback
    }

    return new Response(
      JSON.stringify({
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
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { shop, customerId, amount, reason = "Admin Customer Appeasement" } = body;

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Session invalid" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const creditMutation = `
      mutation adminCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
        storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
          storeCreditAccountTransaction {
            id
            account {
              balance {
                amount
              }
            }
          }
          userErrors {
            message
          }
        }
      }
    `;

    const creditResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: creditMutation,
        variables: {
          id: customerId,
          creditInput: {
            creditAmount: {
              amount: parseFloat(amount).toFixed(2),
              currencyCode: "USD",
            },
          },
        },
      }),
    });

    const creditJson = await creditResp.json();
    const tx = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId,
        amount: parseFloat(amount),
        currency: "USD",
        action: "CREDIT",
        source: "APPEASEMENT",
        shopifyTransactionId: tx?.id,
        note: `[Shopify Admin Customer Page] ${reason}`,
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully issued $${parseFloat(amount).toFixed(2)} to customer`,
        transactionId: tx?.id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
