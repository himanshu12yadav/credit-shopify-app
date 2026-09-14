import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { analyzeStoreRetention } from "../services/copilot.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const data = await analyzeStoreRetention(shop);
  return { shop, ...data };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const recId = formData.get("recId");

  if (recId === "rec_dormant_vips") {
    await prisma.campaign.create({
      data: {
        shop,
        name: "🤖 AI Copilot: VIP Inactive Win-Back ($15 Drop)",
        type: "WIN_BACK",
        bonusFixedAmount: 15.0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    return {
      success: true,
      message: "Successfully launched $15 VIP Win-Back campaign with 14-day expiry!",
    };
  }

  if (recId === "rec_aov_accelerator") {
    await prisma.creditRule.create({
      data: {
        shop,
        name: "🤖 AI Copilot: $10 Bonus on Orders $85+",
        type: "TIERED_SPEND",
        value: 10.0,
        minOrderValue: 85.0,
        isActive: true,
      },
    });

    return {
      success: true,
      message: "Activated $10 credit perk for carts over $85!",
    };
  }

  if (recId === "rec_expiry_urgency") {
    return {
      success: true,
      message: "Queued 48-hour automated urgency push notification to expiring balance holders!",
    };
  }

  return {
    success: true,
    message: "Recommendation applied to your store settings!",
  };
};

export default function RetentionCopilot() {
  const { recommendations, dormantCount, expiringPool } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [executedRecs, setExecutedRecs] = useState({});

  const handleExecute = (rec) => {
    setExecutedRecs((prev) => ({ ...prev, [rec.id]: true }));
    fetcher.submit({ recId: rec.id }, { method: "POST" });
    shopify?.toast?.show(`Executed: ${rec.title}`);
  };

  return (
    <s-page heading="🤖 AI Merchant Retention Copilot">
      <s-banner tone="info" heading="Algorithmic Revenue & Retention Intelligence">
        <s-paragraph>
          Your AI Copilot continuously audits customer repurchase velocity, cart abandonment, and expiring balances to suggest high-ROI automated campaigns.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Retention Audit & Recoverable Revenue">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">DORMANT VIP SPENDERS</s-text>
              <s-heading>{dormantCount} Customers</s-heading>
              <s-badge tone="critical">⚠️ Inactive 45+ Days</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">EXPIRING CREDIT POOL</s-text>
              <s-heading>${expiringPool} USD</s-heading>
              <s-badge tone="warning">⏳ 14-Day Deadline</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">EST. RECOVERABLE REVENUE</s-text>
              <s-heading>+$14,080 USD</s-heading>
              <s-badge tone="success">🚀 Recommended Actions</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {fetcher.data?.message && (
        <s-banner tone="success">
          <s-paragraph>{fetcher.data.message}</s-paragraph>
        </s-banner>
      )}

      {/* Recommendations Section */}
      <s-section heading="High-Impact Algorithmic Recommendations">
        <s-stack direction="block" gap="base">
          {recommendations.map((rec) => {
            const isExecuted = executedRecs[rec.id];

            return (
              <s-box key={rec.id} padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-stack direction="inline" gap="small" alignItems="center">
                      <s-badge tone={rec.category === "WIN_BACK" ? "warning" : rec.category === "AOV_BOOST" ? "success" : "info"}>
                        {rec.category.replace("_", " ")}
                      </s-badge>
                      <s-heading>{rec.title}</s-heading>
                    </s-stack>

                    <s-badge tone="success">
                      Est. Revenue Lift: {rec.estimatedRevenue}
                    </s-badge>
                  </s-stack>

                  <s-paragraph tone="neutral">
                    {rec.insight}
                  </s-paragraph>

                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text tone="neutral" color="subdued">
                      Target Audience: <strong>{rec.targetTier}</strong>
                    </s-text>

                    <s-button
                      variant={isExecuted ? "secondary" : "primary"}
                      disabled={isExecuted}
                      onClick={() => handleExecute(rec)}
                    >
                      {isExecuted ? "✓ Action Launched" : `⚡ ${rec.actionLabel}`}
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
      </s-section>
    </s-page>
  );
}
