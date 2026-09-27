import { authenticate } from "../shopify.server";
import { getVipTiers } from "../services/tiers.server";

// Mounted behind the Shopify App Proxy. `logged_in_customer_id` is populated
// by Shopify itself inside the HMAC-signed query string — it cannot be
// forged by editing the page/DOM, unlike a client-supplied customerId query
// param — so it's the only identity this route trusts.
const GET_CUST_LIVE_QUERY = `#graphql
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
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return Response.json({ success: false, error: "Shop session not active" }, { status: 401 });
  }
  const shop = session.shop;

  const url = new URL(request.url);
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");

  try {
    const tiers = await getVipTiers(shop);
    let customerData = null;

    if (loggedInCustomerId) {
      const fullGid = `gid://shopify/Customer/${loggedInCustomerId}`;
      const queryResp = await admin.graphql(GET_CUST_LIVE_QUERY, { variables: { id: fullGid } });
      const queryJson = await queryResp.json();
      const cNode = queryJson.data?.customer;

      if (cNode) {
        const ordersSum =
          cNode.orders?.nodes?.reduce((acc, o) => acc + parseFloat(o.totalPriceSet?.shopMoney?.amount || 0), 0) || 0;
        const officialSpent = parseFloat(cNode.amountSpent?.amount || 0);
        const totalSpent = Math.max(ordersSum, officialSpent);
        const ordersCount = Math.max(cNode.orders?.nodes?.length || 0, parseInt(cNode.numberOfOrders || "0", 10));
        const balance = cNode.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
        const currency = cNode.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";

        let matchedTier = tiers[0];
        for (const t of tiers) {
          if (totalSpent >= t.minSpend) matchedTier = t;
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

    const payload = {
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
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (err) {
    console.error("Error fetching storefront tiers:", err);
    return Response.json({ success: false, error: "Failed to load loyalty tiers" }, { status: 500 });
  }
};
