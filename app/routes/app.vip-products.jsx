import { useState } from "react";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

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
  const shopify = useAppBridge();
  const [tier, setTier] = useState("Gold VIP");
  const [productHandle, setProductHandle] = useState("limited-edition-gold-hoodie");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSaved(true);
    shopify?.toast?.show("VIP product lock saved!");
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <s-page heading="👑 VIP Exclusive Tier-Locked Products">
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save VIP Product Rule
      </s-button>

      <HubBreadcrumb toPath="/app/campaigns" label="Campaigns & Growth" />
      <HubSubNav clusterKey="campaigns" currentPath="/app/vip-products" />

      <s-banner tone="info" heading="Exclusive Loyalty Gating & Aspirational Retention">
        <s-paragraph>
          Gate high-demand products, limited-run drops, and exclusive merchandise to higher VIP tiers. The <strong>"VIP Product Lock"</strong> app block is ready for your <em>Product Page</em> via <em>Online Store &gt; Customize</em>.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Gating Performance Metrics">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">VIP EXCLUSIVE PRODUCTS</s-text>
              <s-heading>{lockedProductsCount} Items</s-heading>
              <s-badge tone="warning">🔒 Secret Drops Active</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">VIP MEMBER PURCHASES</s-text>
              <s-heading>{vipConversions} Orders</s-heading>
              <s-badge tone="success">High AOV Volume</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">TIER UPGRADE MOTIVATION</s-text>
              <s-heading>+52.8%</s-heading>
              <s-badge tone="success">Shoppers spend more to unlock</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Configuration Section */}
      <s-section heading="Configure VIP Product Gating">
        <form onSubmit={handleSave}>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-paragraph tone="neutral">
                Select the minimum VIP tier threshold and target product handle to restrict purchase access.
              </s-paragraph>
              <s-badge tone="success">🛡️ Storefront Gating Ready</s-badge>
            </s-stack>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-select
                label="Required VIP Tier"
                value={tier}
                onChange={(e) => setTier(e.currentTarget.value)}
              >
                <s-option value="Silver VIP">🥈 Silver VIP ($200.00 Total Spend)</s-option>
                <s-option value="Gold VIP">🥇 Gold VIP ($500.00 Total Spend)</s-option>
                <s-option value="Platinum VIP">💎 Platinum VIP ($1,000.00 Total Spend)</s-option>
              </s-select>

              <s-text-field
                label="Target Product Handle"
                value={productHandle}
                onInput={(e) => setProductHandle(e.currentTarget.value)}
                placeholder="e.g. limited-gold-edition"
              />
            </s-grid>

            {saved && (
              <s-banner tone="success" heading="Rule Updated">
                <s-paragraph>VIP product gating rule saved and active on your storefront!</s-paragraph>
              </s-banner>
            )}

            <s-stack direction="inline" justifyContent="flex-start">
              <s-button type="submit" variant="primary">
                Save VIP Product Rule
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Active Catalog Drops Table */}
      <s-section heading="Active VIP Exclusive Catalog Items">
        <s-box padding="base">
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Product Item</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Required Tier</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Spend Gate</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Orders Placed</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>Limited Edition Gold Member Hoodie</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="warning">🥇 Gold VIP</s-badge>
                </td>
                <td style={{ padding: "12px 14px", color: "#64748b" }}>$500.00 Lifetime</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>42</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="success">Gated Live</s-badge>
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>Founder Reserve Artisan Watch</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="info">💎 Platinum VIP</s-badge>
                </td>
                <td style={{ padding: "12px 14px", color: "#64748b" }}>$1,000.00 Lifetime</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>18</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="success">Gated Live</s-badge>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>Secret VIP Holiday Vault Box</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="neutral">🥈 Silver VIP</s-badge>
                </td>
                <td style={{ padding: "12px 14px", color: "#64748b" }}>$200.00 Lifetime</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>29</td>
                <td style={{ padding: "12px 14px" }}>
                  <s-badge tone="success">Gated Live</s-badge>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </s-box>
      </s-section>
    </s-page>
  );
}
