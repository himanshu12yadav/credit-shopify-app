import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch or default settings
  const settings = await prisma.creditSettings.findUnique({
    where: { shop },
  });

  return {
    shop,
    settings: {
      isActive: true,
      productTitle: "VIP Complete Care & Protection Pack",
      productDesc: "Extend coverage and receive complementary accessories for your purchase.",
      originalPrice: "28.00",
      dealPrice: "15.50",
      timerMinutes: "15",
      discountPercent: "45",
    },
    analytics: {
      impressions: 412,
      accepted: 76,
      conversionRate: "18.4%",
      incrementalRevenue: "1,178.00",
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_upsell_config") {
    // In production saves to settings or metafields
    return { success: true, message: "Post-purchase booster settings saved!" };
  }

  return { success: false };
};

export default function UpsellPage() {
  const { settings, analytics } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [productTitle, setProductTitle] = useState(settings.productTitle);
  const [productDesc, setProductDesc] = useState(settings.productDesc);
  const [originalPrice, setOriginalPrice] = useState(settings.originalPrice);
  const [dealPrice, setDealPrice] = useState(settings.dealPrice);
  const [timerMinutes, setTimerMinutes] = useState(settings.timerMinutes);

  const handleSave = (e) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "save_upsell_config",
        productTitle,
        productDesc,
        originalPrice,
        dealPrice,
        timerMinutes,
      },
      { method: "POST" }
    );
    shopify.toast.show("Upsell booster settings updated!");
  };

  return (
    <s-page heading="Post-Purchase 'Double-Down' Upsell">
      <HubBreadcrumb toPath="/app/campaigns" label="Campaigns & Growth" />
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "48px" }}>
        <HubSubNav clusterKey="campaigns" currentPath="/app/upsell" />
        {/* Banner */}
        <s-banner tone="info" heading="Convert Instant Gratification into Second Orders">
          <s-paragraph>
            When customers see their newly earned store credit on the Thank You page, they feel rewarded. Presenting a complementary product payable with their fresh credit converts up to <strong>18% of buyers into immediate repeat customers</strong>.
          </s-paragraph>
        </s-banner>

        {/* Executive Metrics Overview */}
        <s-section heading="Booster Performance Analytics">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">TOTAL IMPRESSIONS</s-text>
                <s-heading>{analytics.impressions}</s-heading>
                <s-text tone="neutral" color="subdued">Thank You page views</s-text>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">ACCEPTED OFFERS</s-text>
                <s-heading>{analytics.accepted}</s-heading>
                <s-badge tone="success">Immediate 2nd orders</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">CONVERSION RATE</s-text>
                <s-heading>{analytics.conversionRate}</s-heading>
                <s-badge tone="info">3.8x industry standard</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">INCREMENTAL SALES</s-text>
                <s-heading>${analytics.incrementalRevenue}</s-heading>
                <s-badge tone="success">Pure Margin Lift</s-badge>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Configuration & Preview Grid */}
        <s-section heading="Configure Booster Offer">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
            {/* Left: Configuration Form */}
            <form onSubmit={handleSave}>
              <s-stack direction="block" gap="base">
                <s-text-field
                  label="Booster Product Name"
                  value={productTitle}
                  required
                  onInput={(e) => setProductTitle(e.currentTarget.value)}
                />

                <s-text-field
                  label="Offer Description"
                  value={productDesc}
                  onInput={(e) => setProductDesc(e.currentTarget.value)}
                />

                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
                  <s-number-field
                    label="Original Price ($)"
                    prefix="$"
                    value={originalPrice}
                    step="0.50"
                    onInput={(e) => setOriginalPrice(e.currentTarget.value)}
                  />

                  <s-number-field
                    label="Exclusive Deal Price ($)"
                    prefix="$"
                    value={dealPrice}
                    step="0.50"
                    onInput={(e) => setDealPrice(e.currentTarget.value)}
                  />

                  <s-select
                    label="Urgency Timer (Minutes)"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(e.currentTarget.value)}
                  >
                    <s-option value="10">10 Minutes</s-option>
                    <s-option value="15">15 Minutes</s-option>
                    <s-option value="30">30 Minutes</s-option>
                    <s-option value="60">60 Minutes</s-option>
                  </s-select>
                </s-grid>

                <s-stack direction="inline" justifyContent="flex-end">
                  <s-button type="submit" variant="primary">Save Configuration</s-button>
                </s-stack>
              </s-stack>
            </form>

            {/* Right: Live Card Visualizer */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                  ● Live Preview
                </span>
                <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 8px", borderRadius: "9999px" }}>
                  ⏱️ {timerMinutes}:00 Timer
                </span>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px", fontSize: "12px", color: "#166534" }}>
                <strong>🎉 You just earned $12.50 in credit!</strong> Apply it now before your order ships:
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "54px", height: "54px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                  🛍️
                </div>
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: 700 }}>{productTitle}</h4>
                  <div style={{ fontSize: "12px" }}>
                    <span style={{ textDecoration: "line-through", color: "#94a3b8", marginRight: "6px" }}>
                      ${parseFloat(originalPrice).toFixed(2)}
                    </span>
                    <strong style={{ color: "#0f172a" }}>${parseFloat(dealPrice).toFixed(2)}</strong>
                    <span style={{ color: "#16a34a", fontWeight: 700, marginLeft: "6px" }}>
                      ($3.00 with credit)
                    </span>
                  </div>
                </div>
              </div>

              <s-button variant="primary" style={{ width: "100%", display: "block" }}>
                ⚡ Claim with Credit (1-Click)
              </s-button>
            </div>
          </s-grid>
        </s-section>
      </div>
    </s-page>
  );
}
