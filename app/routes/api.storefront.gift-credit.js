import { authenticate } from "../shopify.server";
import { creditCustomer } from "../services/store-credit.server";
import { CreditValidationError } from "../services/credit-validation.server";
import { isRateLimited, getClientIp } from "../services/rate-limit.server";

// Mounted behind the Shopify App Proxy (see [app_proxy] in shopify.app.toml
// and extensions/credit-storefront/blocks/gift-credit-card.liquid, which
// posts to /apps/credit/api/storefront/gift-credit). authenticate.public.appProxy
// verifies Shopify's HMAC signature over the request, so `shop` comes from
// the verified session rather than a client-supplied body field.
const RATE_LIMIT = { windowMs: 60_000, max: 10 };

const FIND_CUSTOMER_QUERY = `#graphql
  query findCustomer($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        displayName
        email
      }
    }
  }
`;

const CREATE_CUSTOMER_MUTATION = `#graphql
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

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return Response.json({ success: false, error: "Shop session not active" }, { status: 401 });
  }
  const shop = session.shop;

  if (isRateLimited(`gift-credit:${shop}:${getClientIp(request)}`, RATE_LIMIT)) {
    return Response.json({ success: false, error: "Too many requests, please try again shortly" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      senderName = "A friend",
      senderEmail,
      recipientName = "Valued Customer",
      recipientEmail,
      amount,
      message = "Enjoy this store credit gift!",
      skin = "emerald",
    } = body;

    if (!recipientEmail || amount === undefined || amount === null) {
      return Response.json(
        { success: false, error: "Missing required fields (recipientEmail, amount)" },
        { status: 400 }
      );
    }

    // 1. Find or create the recipient customer in Shopify
    const findResp = await admin.graphql(FIND_CUSTOMER_QUERY, {
      variables: { query: `email:${recipientEmail}` },
    });
    const findJson = await findResp.json();
    let customerId = findJson.data?.customers?.nodes?.[0]?.id;
    let customerDisplayName = findJson.data?.customers?.nodes?.[0]?.displayName;

    if (!customerId) {
      const nameParts = recipientName.trim().split(" ");
      const firstName = nameParts[0] || "Gift";
      const lastName = nameParts.slice(1).join(" ") || "Recipient";

      const createResp = await admin.graphql(CREATE_CUSTOMER_MUTATION, {
        variables: {
          input: {
            firstName,
            lastName,
            email: recipientEmail,
            tags: ["GiftCardRecipient", "DigitalCredit"],
          },
        },
      });
      const createJson = await createResp.json();
      customerId = createJson.data?.customerCreate?.customer?.id;
      customerDisplayName = recipientName;
    }

    if (!customerId) {
      return Response.json({ success: false, error: "Could not create customer account" }, { status: 500 });
    }

    const result = await creditCustomer({
      admin,
      shop,
      customerId,
      customerEmail: recipientEmail,
      customerName: customerDisplayName || recipientName,
      amount,
      currencyCode: "USD",
      source: "GIFT_CARD",
      note: `Gift Card from ${senderName}: "${message}"`,
      metadata: { senderName, senderEmail, recipientName, recipientEmail, message, skin, claimedAt: new Date().toISOString() },
    });

    if (!result.success) {
      return Response.json({ success: false, error: result.apiError || "Failed to issue gift credit" }, { status: 502 });
    }

    return Response.json({
      success: true,
      message: `Gift card of $${result.ledgerEntry.amount.toFixed(2)} successfully sent to ${recipientEmail}!`,
      giftId: result.ledgerEntry.id,
      recipientEmail,
      amount: result.ledgerEntry.amount.toFixed(2),
    });
  } catch (err) {
    if (err instanceof CreditValidationError) {
      return Response.json({ success: false, error: err.message }, { status: 400 });
    }
    console.error("Gift credit processing error:", err);
    return Response.json({ success: false, error: "Failed to process gift credit" }, { status: 500 });
  }
};

export const loader = async () => {
  return Response.json({ endpoint: "api.storefront.gift-credit", status: "active" });
};
