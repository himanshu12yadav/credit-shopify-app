import prisma from "../db.server";

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Shopify-Shop-Domain",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      shop,
      customerId,
      customerEmail,
      amount,
      note = "Issued via Shopify Flow Automation",
      triggerName = "Shopify Flow",
      expiryDays = 90,
    } = body;

    if (!shop || (!customerId && !customerEmail) || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters (shop, customer, amount)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Shop session not active" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Admin context using fetch
    let targetCustomerId = customerId;
    if (!targetCustomerId && customerEmail) {
      const queryResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
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
      const qJson = await queryResp.json();
      targetCustomerId = qJson.data?.customers?.nodes?.[0]?.id;
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

    // Issue credit via GraphQL
    const creditMutation = `
      mutation creditFromFlow($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
        storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
          storeCreditAccountTransaction {
            id
            account {
              id
              balance {
                amount
                currencyCode
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
          id: targetCustomerId,
          creditInput: {
            creditAmount: {
              amount: parseFloat(amount).toFixed(2),
              currencyCode: "USD",
            },
            ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
          },
        },
      }),
    });

    const creditJson = await creditResp.json();
    const userErrors = creditJson.data?.storeCreditAccountCredit?.userErrors || [];
    if (userErrors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: userErrors.map((e) => e.message).join(", ") }),
        { status: 400, headers: corsHeaders }
      );
    }

    const tx = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;

    // Record in ledger with source FLOW_ACTION
    const entry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId: targetCustomerId,
        customerEmail,
        amount: parseFloat(amount),
        currency: "USD",
        action: "CREDIT",
        source: "FLOW_ACTION",
        shopifyTransactionId: tx?.id || tx?.account?.id,
        note: `[Flow: ${triggerName}] ${note}`,
        expiresAt,
        metadata: JSON.stringify({
          triggerName,
          executedAt: new Date().toISOString(),
          flowId: "shopify-flow-direct",
        }),
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Shopify Flow issued $${parseFloat(amount).toFixed(2)} store credit`,
        transactionId: tx?.id,
        ledgerId: entry.id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Shopify Flow execution error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Failed to execute Flow action" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.flow.action.issue-credit", status: "ready" }), {
    headers: { "Content-Type": "application/json" },
  });
};
