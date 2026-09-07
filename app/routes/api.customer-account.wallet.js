import prisma from "../db.server";
import { getCustomerTier, getVipTiers } from "../services/tiers.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");
  const customerEmail = url.searchParams.get("email");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (!shop) {
    return new Response(JSON.stringify({ success: false, error: "Missing shop parameter" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Session inactive" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    let targetGid = customerId;
    if (!targetGid && customerEmail) {
      const qResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: `query findCust($q: String!) { customers(first: 1, query: $q) { nodes { id email displayName } } }`,
          variables: { q: `email:${customerEmail}` },
        }),
      });
      const qJson = await qResp.json();
      targetGid = qJson.data?.customers?.nodes?.[0]?.id;
    }

    // Default demo customer if none provided
    if (!targetGid) {
      targetGid = "gid://shopify/Customer/26024363524177";
    }

    // Query customer info & store credit balance via Admin API
    const custResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
          query getCustomerAccountWallet($id: ID!) {
            customer(id: $id) {
              id
              displayName
              email
              amountSpent {
                amount
                currencyCode
              }
              storeCreditAccounts(first: 1) {
                nodes {
                  id
                  balance {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        `,
        variables: { id: targetGid },
      }),
    });

    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "45.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";
    const totalSpent = parseFloat(cust?.amountSpent?.amount || "250.00");

    // Tier calculation
    let currentTier = { name: "Silver VIP", cashbackRate: 8.0, minSpend: 200 };
    let nextTier = { name: "Gold VIP", cashbackRate: 12.0, minSpend: 500 };
    try {
      currentTier = await getCustomerTier(shop, totalSpent);
      const allTiers = await getVipTiers(shop);
      const next = allTiers.find((t) => t.minSpend > totalSpent);
      if (next) {
        nextTier = next;
      } else {
        nextTier = null;
      }
    } catch {
      // fallback
    }

    const spendToNextTier = nextTier ? Math.max(0, nextTier.minSpend - totalSpent) : 0;

    // Fetch personal ledger entries
    const ledger = await prisma.creditLedger.findMany({
      where: { shop, customerId: targetGid },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return new Response(
      JSON.stringify({
        success: true,
        wallet: {
          customerId: cust?.id || targetGid,
          displayName: cust?.displayName || "Himanshu Yadav",
          email: cust?.email || "himanshuyadav.12jan@gmail.com",
          balance,
          currency,
          totalSpent,
          tier: {
            name: currentTier?.name || "Silver VIP",
            cashbackRate: currentTier?.cashbackRate || 8.0,
            nextTierName: nextTier?.name || null,
            spendToNextTier: spendToNextTier.toFixed(2),
          },
          transactions: ledger.map((tx) => ({
            id: tx.id,
            action: tx.action,
            amount: tx.amount,
            source: tx.source,
            note: tx.note,
            createdAt: tx.createdAt,
            expiresAt: tx.expiresAt,
          })),
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
