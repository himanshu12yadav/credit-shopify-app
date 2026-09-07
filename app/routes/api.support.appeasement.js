import prisma from "../db.server";

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      shop,
      customerEmail,
      amount,
      reason = "Customer Service Goodwill",
      ticketId = "ADMIN-DIRECT",
      agent = "Support Representative",
      note,
    } = body;

    if (!shop || !customerEmail || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (shop, customerEmail, amount)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credit amount" }),
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

    // 1. Locate customer in Shopify GraphQL
    const findResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
          query findCust($email: String!) {
            customers(first: 1, query: $email) {
              nodes {
                id
                displayName
                email
              }
            }
          }
        `,
        variables: { email: `email:${customerEmail}` },
      }),
    });

    const findJson = await findResp.json();
    const customer = findJson.data?.customers?.nodes?.[0];

    if (!customer) {
      return new Response(
        JSON.stringify({ success: false, error: `Customer not found with email ${customerEmail}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Execute storeCreditAccountCredit GraphQL mutation
    const creditMutation = `
      mutation creditAppeasement($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
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
          id: customer.id,
          creditInput: {
            creditAmount: {
              amount: numericAmount.toFixed(2),
              currencyCode: "USD",
            },
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
    const newBalance = tx?.account?.balance?.amount || "N/A";

    // 3. Record in audit ledger with APPEASEMENT source
    const ledgerEntry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.displayName,
        amount: numericAmount,
        currency: "USD",
        action: "CREDIT",
        source: "APPEASEMENT",
        shopifyTransactionId: tx?.id || tx?.account?.id,
        note: note ? `[${reason}] ${note}` : `Customer service appeasement: ${reason}`,
        metadata: JSON.stringify({
          reason,
          ticketId,
          agent,
          appliedAt: new Date().toISOString(),
        }),
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully issued $${numericAmount.toFixed(2)} appeasement to ${customer.displayName || customer.email}`,
        newBalance,
        ledgerId: ledgerEntry.id,
        ticketId,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Support appeasement error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Failed to process appeasement" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.support.appeasement", status: "active" }), {
    headers: { "Content-Type": "application/json" },
  });
};
