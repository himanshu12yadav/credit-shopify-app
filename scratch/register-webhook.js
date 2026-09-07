import prisma from "../app/db.server.js";

async function main() {
  const session = await prisma.session.findFirst();
  const appUrl = "https://analyst-diamonds-rooms-deaf.trycloudflare.com";

  const resp = await fetch(`https://${session.shop}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            userErrors {
              field
              message
            }
            webhookSubscription {
              id
              topic
              endpoint {
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
        webhookSubscription: {
          callbackUrl: `${appUrl}/webhooks/orders/paid`,
          format: "JSON",
        },
      },
    }),
  });

  const data = await resp.json();
  console.log("Registered Webhook:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
