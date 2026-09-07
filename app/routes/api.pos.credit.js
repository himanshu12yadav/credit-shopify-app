import prisma from "../db.server";
import { getCustomerTier } from "../services/tiers.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");
  const customerEmail = url.searchParams.get("email");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (!shop) {
    return new Response(JSON.stringify({ success: false, error: "Missing shop parameter" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Session inactive" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    let targetGid = customerId;
    if (!targetGid && customerEmail) {
      const qResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: `query findCust($q: String!) { customers(first: 1, query: $q) { nodes { id email displayName } } }`,
          variables: { q: `email:${customerEmail}` },
        }),
      });
      const qJson = await qResp.json();
      targetGid = qJson.data?.customers?.nodes?.[0]?.id;
    }

    if (!targetGid) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer not found on POS" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Query customer details & store credit balance
    const custResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
          query getPosCust($id: ID!) {
            customer(id: $id) {
              id
              displayName
              email
              phone
              numberOfOrders
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
        variables: { id: targetGid },
      }),
    });

    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";

    // Compute VIP Tier
    let vipTier = { name: "Bronze VIP", cashbackRate: 5.0 };
    try {
      vipTier = await getCustomerTier(shop, parseFloat(cust?.amountSpent?.amount || "0"));
    } catch {
      // fallback
    }

    // Recent in-store transactions
    const recentLedger = await prisma.creditLedger.findMany({
      where: { shop, customerId: targetGid },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return new Response(
      JSON.stringify({
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
    const { shop, customerId, customerEmail, amount, note = "POS In-Store Adjustment" } = body;

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Session invalid" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Issue in-store credit directly via GraphQL
    const creditMutation = `
      mutation posCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
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
    const newBal = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction?.account?.balance?.amount;

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId,
        customerEmail,
        amount: parseFloat(amount),
        currency: "USD",
        action: "CREDIT",
        source: "MANUAL",
        note: `[Shopify POS Register] ${note}`,
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully issued $${parseFloat(amount).toFixed(2)} on POS register!`,
        newBalance: newBal,
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
