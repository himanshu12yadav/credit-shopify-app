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
        <a href="/app/customers">Customers & Wallet</a>
        <a href="/app/rules">Rules & Automation</a>
        <a href="/app/campaigns">Campaigns & Growth</a>
        <a href="/app/rewards">Reward Triggers</a>
        <a href="/app/expiry">Retention & Expiry</a>
        <a href="/app/analytics">Reporting</a>
        <a href="/app/notifications">Integrations</a>
        <a href="/app/settings">Settings & Data</a>
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
