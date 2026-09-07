import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Overview</s-link>
        <s-link href="/app/customers">Customers & Balances</s-link>
        <s-link href="/app/rules">Rules & Automation</s-link>
        <s-link href="/app/tiers">VIP Tiers</s-link>
        <s-link href="/app/wallet">Digital Wallet</s-link>
        <s-link href="/app/campaigns">Campaigns & Drops</s-link>
        <s-link href="/app/upsell">Post-Purchase Booster</s-link>
        <s-link href="/app/returns">Save-the-Sale Returns</s-link>
        <s-link href="/app/appeasements">Support Appeasements</s-link>
        <s-link href="/app/flow">Shopify Flow</s-link>
        <s-link href="/app/notifications">Notification Studio</s-link>
        <s-link href="/app/analytics">Analytics & ROI</s-link>
        <s-link href="/app/referrals">Referrals</s-link>
        <s-link href="/app/expiry">Expiry & Retention</s-link>
        <s-link href="/app/migrate">CSV Migration</s-link>
        <s-link href="/app/simulator">Order Simulator</s-link>
        <s-link href="/app/ledger">Ledger & Audit</s-link>
        <s-link href="/app/portal">Account Extensibility</s-link>
        <s-link href="/app/scratch-card">Scratch Card Leads</s-link>
        <s-link href="/app/multipliers">Flash Multipliers</s-link>
        <s-link href="/app/subscriptions">Subscription Perks</s-link>
        <s-link href="/app/reviews">Review Rewards</s-link>
        <s-link href="/app/copilot">AI Retention Copilot</s-link>
        <s-link href="/app/birthdays">Birthday Rewards</s-link>
        <s-link href="/app/klaviyo">Klaviyo & Omnisend</s-link>
        <s-link href="/app/vip-products">VIP Secret Drops</s-link>
        <s-link href="/app/pos">POS Extension</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
