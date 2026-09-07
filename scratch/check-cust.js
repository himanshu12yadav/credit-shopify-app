import prisma from "../app/db.server.js";

async function run() {
  const session = await prisma.session.findFirst({ where: { shop: "pdf-store-15eu7f4v.myshopify.com" } });
  const resp = await fetch("https://pdf-store-15eu7f4v.myshopify.com/admin/api/2024-07/graphql.json", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
    body: JSON.stringify({
      query: `query {
        customer(id: "gid://shopify/Customer/26024363524177") {
          id
          displayName
          numberOfOrders
          amountSpent { amount currencyCode }
          orders(first: 5) {
            nodes {
              id
              name
              displayFinancialStatus
              totalPriceSet { shopMoney { amount } }
            }
          }
        }
      }`
    })
  });
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}

run().finally(() => process.exit());
