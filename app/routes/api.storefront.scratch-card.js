import prisma from "../db.server";

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
    const { shop, name, email, prizeAmount } = body;

    if (!shop || !email || !prizeAmount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
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

    // Abuse prevention: Check if this email already claimed a scratch card in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingClaim = await prisma.creditLedger.findFirst({
      where: {
        shop,
        customerEmail: email.toLowerCase(),
        source: "SCRATCH_CARD",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (existingClaim) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "You have already claimed a scratch card prize this month! Check back soon.",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Look up or create customer in Shopify
    const queryCust = `
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

    const custResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: queryCust,
        variables: { q: `email:${email.toLowerCase()}` },
      }),
    });

    const custJson = await custResp.json();
    let targetCustomerId = custJson.data?.customers?.nodes?.[0]?.id;

    if (!targetCustomerId) {
      // Create new customer
      const createCustMutation = `
        mutation custCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
            }
            userErrors {
              message
            }
          }
        }
      `;

      const createResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: createCustMutation,
          variables: {
            input: {
              firstName: name || "Customer",
              email: email.toLowerCase(),
              tags: ["scratch-card-lead", "store-credit-recipient"],
            },
          },
        }),
      });

      const createJson = await createResp.json();
      targetCustomerId = createJson.data?.customerCreate?.customer?.id;
    }

    if (!targetCustomerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not create customer account" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Expiry: 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Issue Credit via GraphQL
    const creditMutation = `
      mutation scratchCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
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
          id: targetCustomerId,
          creditInput: {
            creditAmount: {
              amount: parseFloat(prizeAmount).toFixed(2),
              currencyCode: "USD",
            },
            expiresAt: expiresAt.toISOString(),
          },
        },
      }),
    });

    const creditJson = await creditResp.json();
    const tx = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;

    // Log to Prisma ledger
    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: targetCustomerId,
        customerEmail: email.toLowerCase(),
        customerName: name || "Shopper",
        amount: parseFloat(prizeAmount),
        currency: "USD",
        action: "CREDIT",
        source: "SCRATCH_CARD",
        shopifyTransactionId: tx?.id,
        note: `🎰 Won $${parseFloat(prizeAmount).toFixed(2)} Store Credit on Mystery Scratch Card`,
        expiresAt,
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deposited $${parseFloat(prizeAmount).toFixed(2)} to your wallet!`,
        prizeAmount,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ status: "ready" }), {
    headers: { "Content-Type": "application/json" },
  });
};
