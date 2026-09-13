import prisma from "../db.server";
import { getVipTiers } from "../services/tiers.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
  };

  if (!shop) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing shop parameter" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const tiers = await getVipTiers(shop);
    let customerData = null;

    if (customerId) {
      try {
        const session = await prisma.session.findFirst({ where: { shop } });
        if (session) {
          const fullGid = customerId.includes("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;
          const queryResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": session.accessToken,
            },
            body: JSON.stringify({
              query: `
                query getCustLive($id: ID!) {
                  customer(id: $id) {
                    id
                    displayName
                    numberOfOrders
                    amountSpent {
                      amount
                      currencyCode
                    }
                    orders(first: 20) {
                      nodes {
                        id
                        totalPriceSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                    storeCreditAccounts(first: 1) {
                      nodes {
                        balance {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              `,
              variables: { id: fullGid },
            }),
          });
          const queryJson = await queryResp.json();
          const cNode = queryJson.data?.customer;
          if (cNode) {
            const ordersSum = cNode.orders?.nodes?.reduce(
              (acc, o) => acc + parseFloat(o.totalPriceSet?.shopMoney?.amount || 0),
              0
            ) || 0;
            const officialSpent = parseFloat(cNode.amountSpent?.amount || 0);
            const totalSpent = Math.max(ordersSum, officialSpent);
            const ordersCount = Math.max(cNode.orders?.nodes?.length || 0, parseInt(cNode.numberOfOrders || "0", 10));
            const balance = cNode.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
            const currency = cNode.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";

            // Find matching tier
            let matchedTier = tiers[0];
            for (const t of tiers) {
              if (totalSpent >= t.minSpend) {
                matchedTier = t;
              }
            }

            customerData = {
              id: cNode.id,
              displayName: cNode.displayName,
              totalSpent,
              ordersCount,
              creditBalance: balance,
              currency,
              tier: matchedTier,
            };
          }
        }
      } catch (err) {
        console.error("Error hydrating live customer tier:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          minSpend: t.minSpend,
          cashbackRate: t.cashbackRate,
          perks: t.perks,
          badgeColor: t.badgeColor,
        })),
        customer: customerData,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Error fetching storefront tiers:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to load loyalty tiers" }),
      { status: 500, headers: corsHeaders }
    );
  }
};
