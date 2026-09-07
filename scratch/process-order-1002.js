import prisma from "../app/db.server.js";
import { processOrderForCredit } from "../app/services/rules-engine.server.js";

async function main() {
  const session = await prisma.session.findFirst();
  if (!session) {
    console.error("No session found");
    return;
  }

  // 1. Fetch order details from Shopify Admin GraphQL
  const resp = await fetch(`https://${session.shop}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `
        query {
          order(id: "gid://shopify/Order/12885130379345") {
            id
            name
            createdAt
            displayFinancialStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              displayName
              email
              numberOfOrders
              amountSpent {
                amount
              }
            }
          }
        }
      `,
    }),
  });

  const data = await resp.json();
  const orderNode = data.data?.order;
  console.log("Found Order in Shopify:", orderNode?.name, orderNode?.totalPriceSet?.shopMoney);

  if (!orderNode) return;

  const admin = {
    graphql: async (query, { variables }) => {
      const r = await fetch(`https://${session.shop}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      return { json: () => r.json() };
    },
  };

  // Convert to order payload format expected by webhook & rules engine
  const payload = {
    id: orderNode.id.split("/").pop(),
    total_price: orderNode.totalPriceSet.shopMoney.amount,
    currency: orderNode.totalPriceSet.shopMoney.currencyCode,
    customer: {
      id: orderNode.customer.id.split("/").pop(),
      email: orderNode.customer.email,
      first_name: "Himanshu",
      last_name: "Yadav",
      orders_count: 1,
      total_spent: "749.95",
      tags: "",
    },
  };

  const outcome = await processOrderForCredit({
    admin,
    shop: session.shop,
    order: payload,
  });

  console.log("Order Process Result:", JSON.stringify(outcome, null, 2));

  // 2. Register webhook subscription for orders/paid if missing
  const appUrl = process.env.SHOPIFY_APP_URL || "https://analyst-diamonds-rooms-deaf.trycloudflare.com";
  const webhookResp = await fetch(`https://${session.shop}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, subscription: $subscription) {
            userErrors {
              field
              message
            }
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      `,
      variables: {
        topic: "ORDERS_PAID",
        subscription: {
          callbackUrl: `${appUrl}/webhooks/orders/paid`,
          format: "JSON",
        },
      },
    }),
  });

  const webhookData = await webhookResp.json();
  console.log("Webhook registration result:", JSON.stringify(webhookData, null, 2));
}

main().catch(console.error);
