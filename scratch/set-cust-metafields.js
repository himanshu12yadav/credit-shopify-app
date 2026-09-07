import prisma from "../app/db.server.js";

async function setCustomerMetafields() {
  const session = await prisma.session.findFirst({ where: { shop: "pdf-store-15eu7f4v.myshopify.com" } });
  
  const mutation = `
    mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          metafields(first: 5) {
            nodes {
              namespace
              key
              value
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const resp = await fetch("https://pdf-store-15eu7f4v.myshopify.com/admin/api/2024-07/graphql.json", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          id: "gid://shopify/Customer/26024363524177",
          metafields: [
            {
              namespace: "credit_app",
              key: "total_spent",
              type: "number_decimal",
              value: "1499.90"
            },
            {
              namespace: "credit_app",
              key: "orders_count",
              type: "number_integer",
              value: "2"
            },
            {
              namespace: "credit_app",
              key: "vip_tier",
              type: "single_line_text_field",
              value: "Platinum"
            },
            {
              namespace: "credit_app",
              key: "store_credit_balance",
              type: "number_decimal",
              value: "89.99"
            }
          ]
        }
      }
    })
  });

  const data = await resp.json();
  console.log("Customer metafield update response:", JSON.stringify(data, null, 2));
}

setCustomerMetafields().finally(() => process.exit());
