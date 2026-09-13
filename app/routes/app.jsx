import { useEffect } from "react";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { posthog } from "../services/posthog.client";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export default function App() {
  const { apiKey, shop } = useLoaderData();

  useEffect(() => {
    if (shop && typeof window !== "undefined") {
      posthog.identify(shop, {
        shop,
        type: "merchant",
      });
    }
  }, [shop]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Overview</a>
        <a href="/app/customers">Customers & Balances</a>
        <a href="/app/rules">Rules & Automation</a>
        <a href="/app/tiers">VIP Tiers</a>
        <a href="/app/wallet">Digital Wallet</a>
        <a href="/app/campaigns">Campaigns & Drops</a>
        <a href="/app/upsell">Post-Purchase Booster</a>
        <a href="/app/returns">Save-the-Sale Returns</a>
        <a href="/app/appeasements">Support Appeasements</a>
        <a href="/app/flow">Shopify Flow</a>
        <a href="/app/notifications">Notification Studio</a>
        <a href="/app/analytics">Analytics & ROI</a>
        <a href="/app/referrals">Referrals</a>
        <a href="/app/expiry">Expiry & Retention</a>
        <a href="/app/migrate">CSV Migration</a>
        <a href="/app/simulator">Order Simulator</a>
        <a href="/app/ledger">Ledger & Audit</a>
        <a href="/app/portal">Account Extensibility</a>
        <a href="/app/scratch-card">Scratch Card Leads</a>
        <a href="/app/multipliers">Flash Multipliers</a>
        <a href="/app/subscriptions">Subscription Perks</a>
        <a href="/app/reviews">Review Rewards</a>
        <a href="/app/copilot">AI Retention Copilot</a>
        <a href="/app/birthdays">Birthday Rewards</a>
        <a href="/app/klaviyo">Klaviyo & Omnisend</a>
        <a href="/app/vip-products">VIP Secret Drops</a>
        <a href="/app/pos">POS Extension</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
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
