import { authenticate, unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import { getCustomerTier, getVipTiers } from "../services/tiers.server";

// Called from the credit-customer-account UI extension, which sends the
// extension's session token (api.sessionToken.get()) as an Authorization:
// Bearer header. authenticate.public.customerAccount verifies it and
// returns the decoded token — `dest` is the shop domain, `sub` is the
// logged-in customer's id. Only ever returns this signed-in customer's own
// wallet, never an arbitrary customerId from a query param.
const GET_CUSTOMER_ACCOUNT_WALLET_QUERY = `#graphql
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
`;

export const loader = async ({ request }) => {
  const { sessionToken, cors } = await authenticate.public.customerAccount(request);

  const shop = sessionToken.dest.replace(/^https?:\/\//, "");
  const rawCustomerId = sessionToken.sub;
  const targetGid = rawCustomerId.startsWith("gid://")
    ? rawCustomerId
    : `gid://shopify/Customer/${rawCustomerId}`;

  try {
    const { admin } = await unauthenticated.admin(shop);

    const custResp = await admin.graphql(GET_CUSTOMER_ACCOUNT_WALLET_QUERY, { variables: { id: targetGid } });
    const custJson = await custResp.json();
    const cust = custJson.data?.customer;
    const balance = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
    const currency = cust?.storeCreditAccounts?.nodes?.[0]?.balance?.currencyCode || "USD";
    const totalSpent = parseFloat(cust?.amountSpent?.amount || "0");

    let currentTier = { name: "Bronze VIP", cashbackRate: 5.0 };
    let nextTier = null;
    try {
      currentTier = await getCustomerTier(shop, totalSpent);
      const allTiers = await getVipTiers(shop);
      nextTier = allTiers.find((t) => t.minSpend > totalSpent) || null;
    } catch {
      // fallback
    }

    const spendToNextTier = nextTier ? Math.max(0, nextTier.minSpend - totalSpent) : 0;

    const ledger = await prisma.creditLedger.findMany({
      where: { shop, customerId: targetGid },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return cors(
      Response.json({
        success: true,
        wallet: {
          customerId: cust?.id || targetGid,
          displayName: cust?.displayName,
          email: cust?.email,
          balance,
          currency,
          totalSpent,
          tier: {
            name: currentTier?.name || "Bronze VIP",
            cashbackRate: currentTier?.cashbackRate || 5.0,
            nextTierName: nextTier?.name || null,
            spendToNextTier: spendToNextTier.toFixed(2),
          },
          walletPassAppleUrl: `https://${shop}/apps/credit/api/storefront/wallet-pass?format=apple`,
          walletPassGoogleUrl: `https://${shop}/apps/credit/api/storefront/wallet-pass?format=google`,
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
      })
    );
  } catch (err) {
    console.error("Customer account wallet error:", err);
    return cors(Response.json({ success: false, error: "Failed to load wallet" }, { status: 500 }));
  }
};
