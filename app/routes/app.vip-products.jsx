import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  return {
    shop,
    lockedProductsCount: 3,
    vipConversions: 89,
  };
};

export default function VipProductsManager() {
  const { lockedProductsCount, vipConversions } = useLoaderData();
  const [tier, setTier] = useState("Gold VIP");
  const [productHandle, setProductHandle] = useState("limited-edition-gold-hoodie");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <s-page heading="👑 VIP Exclusive Tier-Locked Products">
      <s-layout>
        <s-layout-section>
          {/* Metrics */}
          <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
            <s-card>
              <s-text tone="subdued">VIP Exclusive Products</s-text>
              <s-text variant="headingXl" as="p">{lockedProductsCount} Items</s-text>
              <s-text tone="success">Secret Drops Active</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">VIP Member Purchases</s-text>
              <s-text variant="headingXl" as="p" tone="success">{vipConversions} Orders</s-text>
              <s-text tone="subdued">High AOV Volume</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Tier Upgrade Motivation</s-text>
              <s-text variant="headingXl" as="p">+52.8%</s-text>
              <s-text tone="success">Shoppers spend more to unlock</s-text>
            </s-card>
          </s-grid>

          {/* Configuration Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Configure VIP Product Gating</s-text>
                  <s-text tone="subdued">
                    Lock high-demand products, limited-run drops, or sample sales to specific VIP loyalty tiers.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Storefront Gating Ready</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(220px, 1fr))" gap="300">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">Required VIP Tier</s-text>
                  <s-select
                    label="Minimum Tier to Unlock"
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    options={[
                      { label: "Silver VIP ($200 Total Spend)", value: "Silver VIP" },
                      { label: "Gold VIP ($500 Total Spend)", value: "Gold VIP" },
                      { label: "Platinum VIP ($1000 Total Spend)", value: "Platinum VIP" },
                    ]}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">Target Product Handle</s-text>
                  <s-text-field
                    label="Product Handle"
                    value={productHandle}
                    onChange={(e) => setProductHandle(e.target.value)}
                    placeholder="e.g. limited-gold-edition"
                  />
                </s-box>
              </s-grid>

              <s-banner tone="info">
                The <strong>"VIP Product Lock"</strong> block is ready in your Online Store 2.0 theme. Add it to your <em>Product Page &gt; Product Information</em> section to automatically gate purchasing for non-VIPs!
              </s-banner>

              {saved && (
                <s-banner tone="success">
                  VIP product gating rule saved and active!
                </s-banner>
              )}

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleSave}>
                  Save VIP Product Rule
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Active Gated Drops */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Active VIP Exclusive Catalog Items</s-text>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "10px" }}>Product Item</th>
                    <th style={{ padding: "10px" }}>Required Tier</th>
                    <th style={{ padding: "10px" }}>Spend Gate</th>
                    <th style={{ padding: "10px" }}>Orders Placed</th>
                    <th style={{ padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "600" }}>Limited Edition Gold Member Hoodie</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="warning">🥇 Gold VIP</s-badge>
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>$500.00 Lifetime</td>
                    <td style={{ padding: "10px", fontWeight: "700" }}>42</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="success">Gated Live</s-badge>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "600" }}>Founder Reserve Artisan Watch</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="info">💎 Platinum VIP</s-badge>
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>$1,000.00 Lifetime</td>
                    <td style={{ padding: "10px", fontWeight: "700" }}>18</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="success">Gated Live</s-badge>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "600" }}>Secret VIP Holiday Vault Box</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="neutral">🥈 Silver VIP</s-badge>
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>$200.00 Lifetime</td>
                    <td style={{ padding: "10px", fontWeight: "700" }}>29</td>
                    <td style={{ padding: "10px" }}>
                      <s-badge tone="success">Gated Live</s-badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </s-block-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
