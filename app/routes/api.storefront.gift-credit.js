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
      senderName = "A friend",
      senderEmail,
      recipientName = "Valued Customer",
      recipientEmail,
      amount,
      message = "Enjoy this store credit gift!",
      skin = "emerald",
    } = body;

    if (!shop || !recipientEmail || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (shop, recipientEmail, amount)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid gift amount" }),
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

    // 1. Check if recipient customer exists in Shopify or create them
    const findCustomerQuery = `
      query findCustomer($email: String!) {
        customers(first: 1, query: $email) {
          nodes {
            id
            displayName
            email
          }
        }
      }
    `;

    const findResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: findCustomerQuery,
        variables: { email: `email:${recipientEmail}` },
      }),
    });

    const findJson = await findResp.json();
    let customerId = findJson.data?.customers?.nodes?.[0]?.id;

    // If customer doesn't exist, create account in Shopify
    if (!customerId) {
      const nameParts = recipientName.trim().split(" ");
      const firstName = nameParts[0] || "Gift";
      const lastName = nameParts.slice(1).join(" ") || "Recipient";

      const createCustMutation = `
        mutation createCust($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
            }
            userErrors {
              field
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
              firstName,
              lastName,
              email: recipientEmail,
              tags: ["GiftCardRecipient", "DigitalCredit"],
            },
          },
        }),
      });

      const createJson = await createResp.json();
      customerId = createJson.data?.customerCreate?.customer?.id;
    }

    let shopifyTxId = null;

    // 2. Issue Store Credit directly via GraphQL
    if (customerId) {
      const creditMutation = `
        mutation creditRecipient($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
          storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
            storeCreditAccountTransaction {
              account {
                id
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
                amount: numericAmount.toFixed(2),
                currencyCode: "USD",
              },
            },
          },
        }),
      });

      const creditJson = await creditResp.json();
      shopifyTxId = creditJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction?.account?.id || null;
    }

    // 3. Record in audit ledger
    const giftEntry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId: customerId || `synthetic_${Date.now()}`,
        customerEmail: recipientEmail,
        customerName: recipientName,
        amount: numericAmount,
        currency: "USD",
        action: "CREDIT",
        source: "GIFT_CARD",
        shopifyTransactionId: shopifyTxId,
        note: `Gift Card from ${senderName}: "${message}"`,
        metadata: JSON.stringify({
          senderName,
          senderEmail,
          recipientName,
          recipientEmail,
          message,
          skin,
          claimedAt: new Date().toISOString(),
        }),
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Gift card of $${numericAmount.toFixed(2)} successfully sent to ${recipientEmail}!`,
        giftId: giftEntry.id,
        recipientEmail,
        amount: numericAmount.toFixed(2),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Gift credit processing error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Failed to process gift credit" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ endpoint: "api.storefront.gift-credit", status: "active" }), {
    headers: { "Content-Type": "application/json" },
  });
};
