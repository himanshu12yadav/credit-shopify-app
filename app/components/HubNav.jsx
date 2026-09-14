/* eslint-disable react/prop-types */
import { useNavigate } from "react-router";

export const NAV_CLUSTERS = {
  customers: {
    label: "Customers & Wallet",
    pages: [
      { path: "/app/customers", label: "Balances" },
      { path: "/app/wallet", label: "Digital Wallet" },
      { path: "/app/tiers", label: "VIP Tiers" },
    ],
  },
  rules: {
    label: "Rules & Automation",
    pages: [
      { path: "/app/rules", label: "Rules" },
      { path: "/app/simulator", label: "Order Simulator" },
      { path: "/app/flow", label: "Shopify Flow" },
      { path: "/app/copilot", label: "AI Copilot" },
    ],
  },
  campaigns: {
    label: "Campaigns & Growth",
    pages: [
      { path: "/app/campaigns", label: "Campaigns" },
      { path: "/app/multipliers", label: "Flash Multipliers" },
      { path: "/app/referrals", label: "Referrals" },
      { path: "/app/vip-products", label: "VIP Secret Drops" },
      { path: "/app/upsell", label: "Post-Purchase Booster" },
    ],
  },
  reporting: {
    label: "Reporting",
    pages: [
      { path: "/app/analytics", label: "Analytics & ROI" },
      { path: "/app/ledger", label: "Ledger & Audit" },
    ],
  },
  integrations: {
    label: "Integrations",
    pages: [
      { path: "/app/notifications", label: "Notification Studio" },
      { path: "/app/klaviyo", label: "Klaviyo & Omnisend" },
    ],
  },
  settings: {
    label: "Settings & Data",
    pages: [
      { path: "/app/settings", label: "Settings" },
      { path: "/app/migrate", label: "CSV Migration" },
      { path: "/app/portal", label: "Account Extensibility" },
    ],
  },
};

export function HubSubNav({ clusterKey, currentPath }) {
  const navigate = useNavigate();
  const cluster = NAV_CLUSTERS[clusterKey];
  if (!cluster) return null;
  return (
    <s-stack direction="inline" gap="small" alignItems="center">
      {cluster.pages.map((page) => {
        const isCurrent = page.path === currentPath;
        return (
          <s-clickable-chip
            key={page.path}
            color={isCurrent ? "strong" : "base"}
            accessibilityLabel={page.label}
            onClick={isCurrent ? undefined : () => navigate(page.path)}
          >
            {page.label}
          </s-clickable-chip>
        );
      })}
    </s-stack>
  );
}

export const SOURCE_TO_ROUTE = {
  RULE_AWARD: "/app/rules",
  CAMPAIGN: "/app/campaigns",
  REFERRAL: "/app/referrals",
  APPEASEMENT: "/app/appeasements",
  REFUND_CREDIT: "/app/returns",
  SUBSCRIPTION_REWARD: "/app/subscriptions",
  REVIEW_REWARD: "/app/reviews",
  BIRTHDAY_REWARD: "/app/birthdays",
  SCRATCH_CARD: "/app/scratch-card",
  FLOW_ACTION: "/app/flow",
  MIGRATION: "/app/migrate",
  MANUAL: "/app/customers",
  POS: "/app/pos",
  POS_CREDIT: "/app/pos",
};

export function HubBreadcrumb({ toPath, label }) {
  return (
    <s-link slot="breadcrumb-actions" href={toPath}>
      {label}
    </s-link>
  );
}
