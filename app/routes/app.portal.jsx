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
      <s-button slot="primary-action" variant="primary" href={portalUrl} target="_blank">
        Open Store Customer Portal ↗
      </s-button>
      <s-button slot="secondary-action" href={`https://${shop}/admin/settings/customer-accounts`} target="_blank">
        Manage Account Settings in Admin ↗
      </s-button>

      <s-banner tone="info" heading="Dedicated Passwordless Customer Account Rewards Portal">
        <s-paragraph>
          Shoppers who log in via <strong>New Customer Accounts</strong> access their dedicated native rewards portal. They can view real-time store credit balances, monitor VIP progression, and export digital Apple/Google wallet passes.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Portal Usage & Extensibility Status">
        <s-grid gridtemplatecolumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">ACTIVE WALLET USERS</s-text>
              <s-heading>{totalAccountHolders.toLocaleString()}</s-heading>
              <s-badge tone="success">✓ Synced with Shopify Core</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">TARGET EXTENSION SURFACES</s-text>
              <s-heading>2 Surfaces</s-heading>
              <s-badge tone="info">Full Page + Order Status</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">DIGITAL PASS SYNC</s-text>
              <s-heading>Enabled</s-heading>
              <s-badge tone="success">📲 Apple &amp; Google Wallet</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Configuration & Preview Section */}
      <s-section heading="Customer View Preview">
        <s-stack direction="block" gap="base">
          <s-paragraph tone="neutral">
            Here is how the native customer account page appears to your logged-in shoppers:
          </s-paragraph>

          <s-grid gridtemplatecolumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
            {/* Balance Preview Box */}
            <s-box padding="base" background="subdued" borderradius="base">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" justifycontent="space-between" alignitems="center">
                  <s-stack direction="block" gap="small">
                    <s-text tone="neutral" type="subdued">AVAILABLE STORE CREDIT</s-text>
                    <s-heading>$45.00 USD</s-heading>
                  </s-stack>
                  <s-badge tone="success">✓ 1-Click Checkout Ready</s-badge>
                </s-stack>

                <s-stack direction="inline" gap="small">
                  <s-button size="slim">📲 Add to Apple Wallet</s-button>
                  <s-button size="slim">🤖 Save to Google Wallet</s-button>
                </s-stack>
              </s-stack>
            </s-box>

            {/* VIP Tier Preview Box */}
            <s-box padding="base" background="subdued" borderradius="base">
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" justifycontent="space-between" alignitems="center">
                  <s-heading>VIP Tier Status</s-heading>
                  <s-badge tone="warning">🥇 Gold VIP (12% Cashback)</s-badge>
                </s-stack>

                <s-paragraph tone="neutral">
                  Spend $155.00 more to unlock Platinum VIP &amp; 15% cashback perks!
                </s-paragraph>

                <div style={{ height: "8px", width: "100%", background: "#cbd5e1", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "69%", background: "#f59e0b", borderRadius: "999px" }}></div>
                </div>
              </s-stack>
            </s-box>
          </s-grid>
        </s-stack>
      </s-section>
    </s-page>
  );
}
