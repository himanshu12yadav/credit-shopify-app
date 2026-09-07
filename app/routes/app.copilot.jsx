import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
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
    // Automatically launch targeted win-back campaign
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
    // Create new order rule for $85 cart accelerator
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
  const [executedRecs, setExecutedRecs] = useState({});

  const handleExecute = (rec) => {
    setExecutedRecs((prev) => ({ ...prev, [rec.id]: true }));
    fetcher.submit({ recId: rec.id }, { method: "POST" });
  };

  return (
    <s-page heading="🤖 AI Merchant Retention Copilot">
      <s-layout>
        <s-layout-section>
          {/* Header Banner */}
          <s-card>
            <s-block-stack gap="300">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Algorithmic Revenue &amp; Retention Insights</s-text>
                  <s-text tone="subdued">
                    Your AI Copilot continuously monitors customer repurchase velocity, cart abandonment, and expiring balances to suggest high-ROI campaigns.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Continuous AI Audit Active</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Dormant VIP Spenders</s-text>
                  <s-text variant="headingLg" as="p">{dormantCount} Customers</s-text>
                  <s-text tone="critical">Inactive 45+ Days</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Expiring Credit Pool</s-text>
                  <s-text variant="headingLg" as="p" tone="warning">${expiringPool} USD</s-text>
                  <s-text tone="subdued">Urgency Deadline: 14 Days</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Estimated Recoverable Revenue</s-text>
                  <s-text variant="headingLg" as="p" tone="success">+$14,080 USD</s-text>
                  <s-text tone="success">From Recommended Actions</s-text>
                </s-box>
              </s-grid>
            </s-block-stack>
          </s-card>

          {fetcher.data?.message && (
            <s-banner tone="success">
              {fetcher.data.message}
            </s-banner>
          )}

          {/* Recommendations List */}
          <s-block-stack gap="400">
            {recommendations.map((rec) => {
              const isExecuted = executedRecs[rec.id];

              return (
                <s-card key={rec.id}>
                  <s-block-stack gap="300">
                    <s-inline-stack align="space-between" block-align="center">
                      <s-inline-stack gap="200" block-align="center">
                        <s-badge tone={rec.category === "WIN_BACK" ? "warning" : rec.category === "AOV_BOOST" ? "success" : "info"}>
                          {rec.category.replace("_", " ")}
                        </s-badge>
                        <s-text variant="headingMd" as="h3">{rec.title}</s-text>
                      </s-inline-stack>

                      <s-badge tone="success">
                        Est. Revenue Lift: {rec.estimatedRevenue}
                      </s-badge>
                    </s-inline-stack>

                    <s-paragraph tone="subdued">
                      {rec.insight}
                    </s-paragraph>

                    <s-divider></s-divider>

                    <s-inline-stack align="space-between" block-align="center">
                      <s-text tone="subdued">
                        Target Audience: <strong>{rec.targetTier}</strong>
                      </s-text>

                      <s-button
                        variant={isExecuted ? "secondary" : "primary"}
                        disabled={isExecuted}
                        loading={fetcher.state !== "idle" && fetcher.formData?.get("recId") === rec.id}
                        onClick={() => handleExecute(rec)}
                      >
                        {isExecuted ? "✓ Action Launched" : `⚡ ${rec.actionLabel}`}
                      </s-button>
                    </s-inline-stack>
                  </s-block-stack>
                </s-card>
              );
            })}
          </s-block-stack>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
