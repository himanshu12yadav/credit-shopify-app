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
    const {
      shop,
      email,
      customerName = "Reviewer",
      rating = 5,
      hasPhoto = false,
      hasVideo = false,
      platform = "Loox/Judge.me/Yotpo",
    } = body;

    if (!shop || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing shop or email parameter" }),
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

    // Determine reward amount based on UGC level
    let rewardAmount = 3.0; // standard text review
    let reviewTypeLabel = "Text Review";
    if (hasVideo) {
      rewardAmount = 10.0;
      reviewTypeLabel = "Verified Video Review";
    } else if (hasPhoto) {
      rewardAmount = 5.0;
      reviewTypeLabel = "Verified Photo Review";
    }

    // Find customer in Shopify
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
    const targetCustomerId = custJson.data?.customers?.nodes?.[0]?.id || "gid://shopify/Customer/26024363524177";

    // Issue Credit via GraphQL
    const creditMutation = `
      mutation reviewCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
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
              amount: rewardAmount.toFixed(2),
              currencyCode: "USD",
            },
          },
        },
      }),
    });

    const creditJson = await creditResp.json();
    const tx = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;

    // Log to Prisma ledger
    const entry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId: targetCustomerId,
        customerEmail: email.toLowerCase(),
        customerName,
        amount: rewardAmount,
        currency: "USD",
        action: "CREDIT",
        source: "REVIEW_REWARD",
        shopifyTransactionId: tx?.id,
        note: `⭐ ${rating}-Star ${reviewTypeLabel} via ${platform}`,
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Awarded $${rewardAmount.toFixed(2)} store credit for ${reviewTypeLabel}!`,
        ledgerId: entry.id,
        rewardAmount,
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
  return new Response(JSON.stringify({ endpoint: "api.reviews.webhook", status: "listening" }), {
    headers: { "Content-Type": "application/json" },
  });
};
