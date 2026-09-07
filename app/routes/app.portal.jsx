import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const activeHolders = await prisma.creditLedger.groupBy({
    by: ["customerId"],
    where: { shop },
    _sum: { amount: true },
  });

  return {
    shop,
    totalAccountHolders: activeHolders.length,
    portalUrl: `https://${shop}/account`,
  };
};

export default function CustomerPortalSettings() {
  const { shop, totalAccountHolders, portalUrl } = useLoaderData();

  return (
    <s-page heading="Customer Account Wallet & Extensibility">
      <s-layout>
        <s-layout-section>
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">🛡️ Shopify "New Customer Accounts" Wallet</s-text>
                  <s-text tone="subdued">
                    Customers who log into your store via passwordless 1-time codes access their dedicated native rewards portal.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Extensibility Active</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Active Wallet Users</s-text>
                  <s-text variant="headingLg" as="p">{totalAccountHolders}</s-text>
                  <s-text tone="success">Synced with Shopify Core</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Target Surfaces</s-text>
                  <s-text variant="headingLg" as="p">2 Targets</s-text>
                  <s-text tone="subdued">Full Page + Order Status</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Pass Sync</s-text>
                  <s-text variant="headingLg" as="p">Enabled</s-text>
                  <s-text tone="subdued">Apple & Google Wallet</s-text>
                </s-box>
              </s-grid>

              <s-banner tone="info">
                To test this in your store, ensure <strong>New Customer Accounts</strong> is selected in <em>Shopify Admin &gt; Settings &gt; Customer Accounts</em>. Your buyers will automatically see the <strong>"My Store Credit &amp; VIP Rewards"</strong> page!
              </s-banner>

              <s-inline-stack gap="300">
                <s-button variant="primary" url={portalUrl} target="_blank">
                  Open Store Customer Portal ↗
                </s-button>
                <s-button url={`https://${shop}/admin/settings/customer-accounts`} target="_blank">
                  Manage Account Settings in Admin ↗
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Live Mobile/Desktop Interactive Wallet Simulator Preview */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Interactive Customer View Preview</s-text>
              <s-text tone="subdued">
                Here is how the native customer account page appears to your logged-in shoppers:
              </s-text>

              <s-box padding="400" border="base" border-radius="300" background="bg-surface-tertiary">
                <s-block-stack gap="400">
                  <s-box padding="400" border-radius="200" background="bg-surface">
                    <s-inline-stack align="space-between" block-align="center">
                      <div>
                        <s-text tone="subdued">AVAILABLE STORE CREDIT</s-text>
                        <s-text variant="headingXl" as="p" tone="success">$45.00 USD</s-text>
                      </div>
                      <s-badge tone="success">1-Click Checkout Ready</s-badge>
                    </s-inline-stack>
                    <s-divider></s-divider>
                    <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                      <s-button size="slim">📲 Add to Apple Wallet</s-button>
                      <s-button size="slim">🤖 Save to Google Wallet</s-button>
                    </div>
                  </s-box>

                  <s-box padding="400" border-radius="200" background="bg-surface">
                    <s-inline-stack align="space-between" block-align="center">
                      <s-text variant="headingSm" as="h4">VIP Tier Status</s-text>
                      <s-badge tone="warning">🥇 Gold VIP (12% Cashback)</s-badge>
                    </s-inline-stack>
                    <p style={{ margin: "8px 0", fontSize: "13px", color: "#64748b" }}>
                      Spend $155.00 more to unlock Platinum VIP &amp; 15% cashback!
                    </p>
                    <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "69%", background: "#f59e0b", borderRadius: "999px" }}></div>
                    </div>
                  </s-box>
                </s-block-stack>
              </s-box>
            </s-block-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
