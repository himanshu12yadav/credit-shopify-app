import { useEffect, useRef } from "react";
import { useFetcher, useLoaderData, useRevalidator, useNavigate } from "react-router";
import { SOURCE_TO_ROUTE } from "../components/HubNav";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCustomerAccountVersion, getStoreCreditAnalytics } from "../services/store-credit.server";
import { getWebPixelStatus } from "../services/pixel.server";
import { getThemeAppEmbedStatus } from "../services/theme.server";
import prisma from "../db.server";

const ADMIN_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
async function getCachedAdminData(key, fetcher, ttlMs = CACHE_TTL_MS) {
  const cached = ADMIN_CACHE.get(key);
  const now = Date.now();
  if (cached?.expiresAt > now) return cached.data;
  try { const data = await fetcher(); ADMIN_CACHE.set(key, { data, expiresAt: now + ttlMs }); return data; } catch (error) { if (cached) return cached.data; throw error; }
}

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const [analytics, activeRules, settings, customerAccountVersion, pixelStatus, posCount, themeResponse, storefrontCount, themeEmbedStatus] = await Promise.all([
    getStoreCreditAnalytics({ shop }),
    prisma.creditRule.findMany({ where: { shop, isActive: true }, take: 5 }),
    prisma.creditSettings.findUnique({ where: { shop } }),
    getCachedAdminData(`${shop}:customerAccountVersion`, () => getCustomerAccountVersion(admin)),
    getCachedAdminData(`${shop}:pixelStatus`, () => getWebPixelStatus(admin).catch(() => ({ active: false }))),
    prisma.creditLedger.count({ where: { shop, source: { in: ["POS", "POS_CREDIT"] } } }),
    getCachedAdminData(`${shop}:activeTheme`, () => admin.graphql(`query { themes(first: 1, roles: [MAIN]) { nodes { name } } }`).then((response) => response.json()).catch(() => null)),
    prisma.creditLedger.count({ where: { shop, source: { in: ["SCRATCH_CARD", "GIFT_CARD", "STOREFRONT"] } } }),
    getCachedAdminData(`${shop}:themeEmbedStatus`, () => getThemeAppEmbedStatus({ admin, session }).catch(() => ({ active: false }))),
  ]);
  const isNewAccountsActive = customerAccountVersion === "NEW_CUSTOMER_ACCOUNTS";
  const isCashbackRulesActive = activeRules.length > 0;
  const isCustomerWalletActive = settings?.cashbackEnabled !== false;
  const isPixelActive = Boolean(pixelStatus?.active);
  const isAppEmbedActive = Boolean(themeEmbedStatus?.active) || Boolean(settings?.appEmbedVerified) || storefrontCount > 0;
  const completedSteps = [isNewAccountsActive, isCashbackRulesActive, isCustomerWalletActive, isPixelActive, isAppEmbedActive].filter(Boolean).length;
  return { storeSlug: shop.replace(".myshopify.com", ""), analytics, activeRules, settings: settings || { defaultCurrency: "USD", cashbackRate: 5 }, completedSteps, totalSteps: 5, isNewAccountsActive, isCashbackRulesActive, isCustomerWalletActive, isPixelActive, isAppEmbedActive, isPosSynced: posCount > 0 || Boolean(settings?.posEnabled), mainThemeName: themeResponse?.data?.themes?.nodes?.[0]?.name || "Online Store 2.0", formattedLedger: (analytics.recentLedger || []).map((entry) => ({ id: entry.id, name: entry.customerName || entry.customerEmail || "Shopper", source: entry.source || "Credit", amount: `${entry.action === "CREDIT" ? "+" : "-"}$${Math.abs(entry.amount).toFixed(2)}`, action: entry.action, date: new Date(entry.createdAt).toLocaleDateString() })) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;
  const intent = (await request.formData()).get("intent");
  if (intent === "seed_sample_rules") {
    if (await prisma.creditRule.count({ where: { shop } }) === 0) await prisma.creditRule.createMany({ data: [
      { shop, title: "5% Order Cashback", description: "Automatically grant 5% store credit on paid orders", trigger: "ORDER_PAID", creditType: "PERCENTAGE", creditValue: 5, minSpend: 20, expiryDays: 90 },
      { shop, title: "First Purchase Welcome Bonus", description: "$10 store credit for first orders", trigger: "FIRST_ORDER", creditType: "FIXED", creditValue: 10, expiryDays: 60 },
      { shop, title: "VIP Spend $150+ Reward", description: "Grant $15 credit on large orders", trigger: "SPEND_THRESHOLD", creditType: "FIXED", creditValue: 15, minSpend: 150, expiryDays: 120 },
    ] });
    return { success: true, message: "Starter rules generated" };
  }
  if (intent === "launch_winback_drop") { await prisma.campaign.create({ data: { shop, name: "AI Copilot: $15 VIP Win-Back Drop", type: "WIN_BACK", bonusFixedAmount: 15, startDate: new Date(), endDate: new Date(Date.now() + 14 * 86400000), isActive: true } }); return { success: true, message: "Win-back campaign launched" }; }
  if (intent === "verify_app_embed") { await prisma.creditSettings.upsert({ where: { shop }, update: { appEmbedVerified: true }, create: { shop, appEmbedVerified: true } }); return { success: true, message: "App embed verified" }; }
  return { success: false };
};

export default function OverviewIndex() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const lastCheckRef = useRef(0);
  const themeEditorUrl = `https://admin.shopify.com/store/${data.storeSlug}/themes/current/editor?context=apps`;
  useEffect(() => { const refresh = () => { if (Date.now() - lastCheckRef.current > 1500 && revalidator.state === "idle") { lastCheckRef.current = Date.now(); revalidator.revalidate(); } }; window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [revalidator]);
  const submit = (intent, message) => { fetcher.submit({ intent }, { method: "POST" }); shopify?.toast?.show(message); };
  const setupSteps = [
    ["Customer accounts", data.isNewAccountsActive, "/app/portal"], ["Cashback rules", data.isCashbackRulesActive, "/app/rules"], ["Customer wallet", data.isCustomerWalletActive, "/app/wallet"], ["Web pixel", data.isPixelActive, "/app/analytics"], ["App embed", data.isAppEmbedActive, null],
  ];
  const metrics = [["Credit issued", `$${data.analytics.totalIssued}`, "All-time rewards"], ["Credit redeemed", `$${data.analytics.totalDebited}`, "Customer redemptions"], ["Outstanding liability", `$${data.analytics.outstandingLiability}`, "Current ledger balance"], ["Active automations", data.analytics.activeRulesCount, "Rules and campaigns"]];
  return (
    <s-page heading="Store Credit & Loyalty Command Center" inlineSize="large">
      <s-button slot="primary-action" variant="primary" onClick={() => navigate("/app/customers")}>Issue store credit</s-button>
      <s-stack direction="block" gap="large">
        <s-banner tone="info" heading="Your loyalty operating center">
          Manage native store credit, rewards automation, loyalty tiers, and store activation from one place. <s-link href={themeEditorUrl} target="_blank">Open theme editor</s-link>
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          {metrics.map(([label, value, detail]) => (
            <s-box key={label} padding="base" background="subdued" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">{label}</s-text>
                <s-heading>{value}</s-heading>
                <s-text tone="neutral" color="subdued">{detail}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-grid>

        <s-section heading={`Launch checklist (${data.completedSteps}/${data.totalSteps})`} padding="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
            {setupSteps.map(([label, complete, href]) => (
              <s-box key={label} padding="base" background="subdued" border="base" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-badge tone={complete ? "success" : "warning"}>{complete ? "Complete" : "Action needed"}</s-badge>
                  <s-heading>{label}</s-heading>
                  {href ? (
                    <s-link href={href}>{complete ? "Review configuration" : "Complete setup"}</s-link>
                  ) : (
                    <s-button onClick={() => data.isAppEmbedActive ? window.open(themeEditorUrl, "_blank") : submit("verify_app_embed", "App embed marked as active")}>
                      {data.isAppEmbedActive ? "Open theme editor" : "Mark as active"}
                    </s-button>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </s-section>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="base">
          <s-section heading="Quick actions" padding="base">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-button variant="primary" onClick={() => submit("seed_sample_rules", "Starter rules generated")}>Generate starter rules</s-button>
              <s-button onClick={() => submit("launch_winback_drop", "VIP win-back campaign launched")}>Launch VIP win-back drop</s-button>
              <s-button onClick={() => navigate("/app/campaigns")}>Create a campaign</s-button>
            </s-stack>
          </s-section>
          <s-section heading="Activation status" padding="base">
            <s-stack direction="block" gap="small">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text>Theme</s-text>
                <s-badge tone="info">{data.mainThemeName}</s-badge>
              </s-stack>
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text>POS credit activity</s-text>
                <s-badge tone={data.isPosSynced ? "success" : "warning"}>{data.isPosSynced ? "Connected" : "Not yet used"}</s-badge>
              </s-stack>
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text>Active rules</s-text>
                <s-badge tone="success">{data.activeRules.length}</s-badge>
              </s-stack>
            </s-stack>
          </s-section>
        </s-grid>

        <s-section heading="Recent ledger activity" padding="base">
          <s-stack direction="inline" justifyContent="flex-end">
            <s-button variant="tertiary" onClick={() => navigate("/app/ledger")}>View full ledger</s-button>
          </s-stack>
          {data.formattedLedger.length === 0 ? (
            <s-box padding="large" background="subdued" borderRadius="base">
              <s-text>No credit activity yet. Create a rule or issue credit manually to begin.</s-text>
            </s-box>
          ) : (
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header>Customer</s-table-header>
                <s-table-header>Source</s-table-header>
                <s-table-header>Amount</s-table-header>
                <s-table-header>Date</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {data.formattedLedger.map((entry) => (
                  <s-table-row key={entry.id}>
                    <s-table-cell>{entry.name}</s-table-cell>
                    <s-table-cell>
                      <s-badge
                        tone="info"
                        {...(SOURCE_TO_ROUTE[entry.source]
                          ? { onClick: () => navigate(SOURCE_TO_ROUTE[entry.source]) }
                          : {})}
                      >
                        {entry.source}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell><s-text tone={entry.action === "CREDIT" ? "success" : "critical"}>{entry.amount}</s-text></s-table-cell>
                    <s-table-cell>{entry.date}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}
