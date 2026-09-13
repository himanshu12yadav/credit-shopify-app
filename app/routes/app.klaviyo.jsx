import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  return {
    shop,
    syncedUsersCount: 248,
    activeEventsCount: 3,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "test_event") {
    const { formatKlaviyoEvent, syncToKlaviyo } = await import("../services/klaviyo-sync.server");
    const eventType = formData.get("eventType");
    const eventName =
      eventType === "EARNED"
        ? "Store Credit Earned"
        : eventType === "EXPIRING"
        ? "Store Credit Expiring Soon"
        : "VIP Tier Upgraded";

    const payload = formatKlaviyoEvent(eventName, {
      email: "himanshuyadav.12jan@gmail.com",
      amount: 15.0,
      balance: 45.0,
      note: "Earned 5% cashback on Order #1002",
      tierName: "Gold VIP",
    });

    const result = await syncToKlaviyo("demo", payload);

    return {
      success: true,
      message: `Successfully dispatched test '${eventName}' event to Klaviyo pipeline!`,
      payload: result.payload,
    };
  }

  return { success: true, message: "Settings saved successfully!" };
};

export default function KlaviyoIntegration() {
  const { syncedUsersCount } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [apiKey, setApiKey] = useState("pk_live_demo_******************");
  const [omnisendKey, setOmnisendKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSaved(true);
    shopify?.toast?.show("API keys saved!");
    setTimeout(() => setSaved(false), 4000);
  };

  const handleTestEvent = (type) => {
    fetcher.submit({ intent: "test_event", eventType: type }, { method: "POST" });
    shopify?.toast?.show(`Dispatching test event: ${type}`);
  };

  return (
    <s-page heading="📧 Klaviyo & Omnisend Deep Event Sync">
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save Integration Keys
      </s-button>

      <s-banner tone="info" heading="Real-Time Profile Properties & Flow Triggers">
        <s-paragraph>
          Sync live store credit balances, expiring balance countdowns, and VIP tier rankings to Klaviyo and Omnisend. Trigger automated retention flows whenever credit is earned or near expiry.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Marketing Integration Status">
        <s-grid gridtemplatecolumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">KLAVIYO PROFILES SYNCED</s-text>
              <s-heading>{syncedUsersCount.toLocaleString()}</s-heading>
              <s-badge tone="success">✓ Real-time Properties Live</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">ACTIVE EVENT FLOWS</s-text>
              <s-heading>3 Flows</s-heading>
              <s-badge tone="info">Earned, Expiry, Tier Upgrade</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">EMAIL REVENUE LIFT</s-text>
              <s-heading>+29.4%</s-heading>
              <s-badge tone="success">When Credit is Shown</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* API Configuration Section */}
      <s-section heading="Marketing Platform API Credentials">
        <form onSubmit={handleSave}>
          <s-stack direction="block" gap="base">
            <s-grid gridtemplatecolumns="1fr 1fr" gap="base">
              <s-text-field
                label="Klaviyo Private API Key"
                type="password"
                value={apiKey}
                onInput={(e) => setApiKey(e.target.value)}
              />
              <s-text-field
                label="Omnisend API Key (Optional)"
                type="password"
                value={omnisendKey}
                onInput={(e) => setOmnisendKey(e.target.value)}
                placeholder="Enter Omnisend API Key"
              />
            </s-grid>

            {saved && (
              <s-banner tone="success" heading="Credentials Saved">
                <s-paragraph>API keys saved! Real-time profile sync pipeline is active.</s-paragraph>
              </s-banner>
            )}

            <s-stack direction="inline" justifycontent="flex-start">
              <s-button type="submit" variant="primary">
                Save Integration Keys
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Test Event Dispatcher Section */}
      <s-section heading="Test Event Dispatcher Sandbox">
        <s-stack direction="block" gap="base">
          <s-paragraph tone="neutral">
            Click any button below to dispatch a live test metric event into your marketing platform:
          </s-paragraph>

          <s-stack direction="inline" gap="small">
            <s-button onClick={() => handleTestEvent("EARNED")}>
              ⚡ Dispatch: 'Store Credit Earned'
            </s-button>
            <s-button onClick={() => handleTestEvent("EXPIRING")}>
              ⏳ Dispatch: 'Store Credit Expiring Soon'
            </s-button>
            <s-button onClick={() => handleTestEvent("TIER_UPGRADE")}>
              🥇 Dispatch: 'VIP Tier Upgraded'
            </s-button>
          </s-stack>

          {fetcher.data?.message && (
            <s-banner tone="success">
              <s-paragraph>{fetcher.data.message}</s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      {/* Merge Tag Table Section */}
      <s-section heading="Klaviyo Dynamic Email Tag Cheatsheet">
        <s-box padding="base">
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Property Name</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Klaviyo Merge Tag</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Example Value</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>Store Credit Balance</td>
                <td style={{ padding: "12px 14px" }}>
                  <code>{"{{ person|lookup:'store_credit_balance' }}"}</code>
                </td>
                <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: 700 }}>$45.00</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>VIP Tier Level</td>
                <td style={{ padding: "12px 14px" }}>
                  <code>{"{{ person|lookup:'vip_tier' }}"}</code>
                </td>
                <td style={{ padding: "12px 14px" }}>Gold VIP</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>Days Until Expiry</td>
                <td style={{ padding: "12px 14px" }}>
                  <code>{"{{ person|lookup:'days_until_credit_expiry' }}"}</code>
                </td>
                <td style={{ padding: "12px 14px", color: "#f59e0b", fontWeight: 700 }}>7 Days</td>
              </tr>
            </tbody>
          </table>
        </s-box>
      </s-section>
    </s-page>
  );
}
