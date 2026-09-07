import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getStoreCreditAnalytics, getCustomerAccountVersion } from "../services/store-credit.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const [analytics, activeRules, settings, customerAccountVersion] = await Promise.all([
    getStoreCreditAnalytics({ shop }),
    prisma.creditRule.findMany({
      where: { shop, isActive: true },
      take: 5,
    }),
    prisma.creditSettings.findUnique({
      where: { shop },
    }),
    getCustomerAccountVersion(admin),
  ]);

  return {
    shop,
    analytics,
    activeRules,
    settings: settings || { defaultCurrency: "USD", cashbackEnabled: true, cashbackRate: 5.0 },
    customerAccountVersion,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "seed_sample_rules") {
    const count = await prisma.creditRule.count({ where: { shop: session.shop } });
    if (count === 0) {
      await prisma.creditRule.createMany({
        data: [
          {
            shop: session.shop,
            title: "5% Order Cashback",
            description: "Automatically grant 5% store credit on all paid orders",
            trigger: "ORDER_PAID",
            creditType: "PERCENTAGE",
            creditValue: 5.0,
            minSpend: 20.0,
            expiryDays: 90,
            isActive: true,
          },
          {
            shop: session.shop,
            title: "First Purchase Welcome Bonus",
            description: "$10 store credit for new customers after their first purchase",
            trigger: "FIRST_ORDER",
            creditType: "FIXED",
            creditValue: 10.0,
            minSpend: 0.0,
            expiryDays: 60,
            isActive: true,
          },
          {
            shop: session.shop,
            title: "VIP Spend $150+ Reward",
            description: "Grant $15 store credit on large orders over $150",
            trigger: "SPEND_THRESHOLD",
            creditType: "FIXED",
            creditValue: 15.0,
            minSpend: 150.0,
            expiryDays: 120,
            isActive: true,
          },
        ],
      });
    }
    return { success: true };
  }

  return { success: true };
};

export default function OverviewIndex() {
  const { shop, analytics, activeRules, customerAccountVersion } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSeeding = fetcher.state === "submitting";

  const handleSeedRules = () => {
    fetcher.submit({ intent: "seed_sample_rules" }, { method: "POST" });
    shopify.toast.show("Starter automation rules generated!");
  };

  const isNewAccountsActive = customerAccountVersion === "NEW_CUSTOMER_ACCOUNTS";
  const storeSlug = shop.replace(".myshopify.com", "");

  return (
    <s-page heading="Store Credit & Rewards Overview">
      {/* Primary Action Button */}
      <s-button slot="primary-action" variant="primary" href="/app/customers">
        Issue Store Credit
      </s-button>

      {/* Dynamic Status Banner */}
      {isNewAccountsActive ? (
        <s-banner tone="success" heading="Shopify Native Store Credit Active">
          <s-paragraph>
            New Customer Accounts are active! Credits are seamlessly redeemable at checkout by buyers and across your retail <strong>Shopify POS</strong> registers.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-banner tone="warning" heading="Action Required: Enable New Customer Accounts">
          <s-paragraph>
            Shopify requires <strong>New Customer Accounts</strong> for 1-click Store Credit redemption at checkout. Your store is currently set to Classic Accounts.
          </s-paragraph>
          <div style={{ marginTop: "10px" }}>
            <s-button
              variant="primary"
              href={`https://admin.shopify.com/store/${storeSlug}/settings/customer_accounts`}
              target="_blank"
            >
              Open Customer Accounts Settings ↗
            </s-button>
          </div>
        </s-banner>
      )}

      {/* KPI Metric Section */}
      <s-section heading="Credit Performance & Liability">
        <s-grid gridtemplatecolumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">TOTAL CREDIT ISSUED</s-text>
              <s-heading>${analytics.totalIssued}</s-heading>
              <s-badge tone="success">Cumulative awarded</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">REDEEMED / DEBITED</s-text>
              <s-heading>${analytics.totalDebited}</s-heading>
              <s-text tone="neutral" type="subdued">Used at checkout or adjusted</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">OUTSTANDING LIABILITY</s-text>
              <s-heading>${analytics.outstandingLiability}</s-heading>
              <s-badge tone="info">Active liability pool</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">LEDGER EVENTS</s-text>
              <s-heading>{analytics.ledgerCount}</s-heading>
              <s-text tone="neutral" type="subdued">Audited operations</s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Main Column: Recent Activity with clean padded header and flush table */}
      <s-section padding="none">
        <s-box padding="base">
          <s-heading>Recent Credit Activity</s-heading>
        </s-box>
        <s-divider />

        {analytics.recentLedger.length === 0 ? (
          <s-box padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph tone="neutral">No store credit transactions recorded yet.</s-paragraph>
              <s-button href="/app/customers" variant="secondary">Issue First Credit</s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Amount</s-table-header>
              <s-table-header>Source</s-table-header>
              <s-table-header>Date</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {analytics.recentLedger.map((item) => (
                <s-table-row key={item.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text><strong>{item.customerName || "Customer"}</strong></s-text>
                      <s-text tone="neutral" type="subdued">
                        {item.customerEmail || item.customerId.replace("gid://shopify/Customer/", "ID: ")}
                      </s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      <strong>
                        {item.action === "CREDIT" ? "+" : "-"}${Math.abs(item.amount).toFixed(2)} {item.currency}
                      </strong>
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={
                        item.source === "CASHBACK"
                          ? "success"
                          : item.source === "RULE_AWARD"
                          ? "info"
                          : "neutral"
                      }
                    >
                      {item.source}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text tone="neutral">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      {/* Canonical Aside Slot */}
      <s-section slot="aside" heading={`Active Automations (${activeRules.length})`}>
        <s-stack direction="block" gap="base">
          {activeRules.length === 0 ? (
            <s-stack direction="block" gap="base">
              <s-paragraph tone="neutral">
                No automated rules configured. Set up cashback and welcome bonuses to reward customers automatically.
              </s-paragraph>
              <s-button onClick={handleSeedRules} variant="primary" {...(isSeeding ? { loading: true } : {})}>
                Seed Starter Rules
              </s-button>
            </s-stack>
          ) : (
            <s-stack direction="block" gap="small">
              {activeRules.map((rule) => (
                <s-box key={rule.id} padding="base" background="subdued" borderradius="base">
                  <s-stack direction="inline" justifycontent="space-between" alignitems="center">
                    <s-stack direction="block" gap="none">
                      <s-text><strong>{rule.title}</strong></s-text>
                      <s-text tone="neutral" type="subdued">
                        {rule.creditType === "PERCENTAGE" ? `${rule.creditValue}%` : `$${rule.creditValue.toFixed(2)}`}
                        {rule.minSpend > 0 ? ` on $${rule.minSpend}+` : ""}
                      </s-text>
                    </s-stack>
                    <s-badge tone="success">ACTIVE</s-badge>
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          )}

          <s-divider />

          <s-stack direction="inline" justifycontent="space-between">
            <s-link href="/app/rules">Rules Engine →</s-link>
            <s-link href="/app/campaigns">Campaigns →</s-link>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Canonical Aside Quick Links */}
      <s-section slot="aside" heading="Quick Links">
        <s-unordered-list>
          <s-list-item><s-link href="/app/customers">Issue Manual Credit</s-link></s-list-item>
          <s-list-item><s-link href="/app/referrals">Referral Program</s-link></s-list-item>
          <s-list-item><s-link href="/app/settings">POS Retail Setup</s-link></s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
