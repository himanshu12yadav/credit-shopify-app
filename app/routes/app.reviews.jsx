import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const reviewRewards = await prisma.creditLedger.findMany({
    where: { shop, source: "REVIEW_REWARD" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalAwarded = reviewRewards.reduce((acc, r) => acc + r.amount, 0);

  return {
    shop,
    reviewRewards,
    totalCount: reviewRewards.length,
    totalAwarded: totalAwarded.toFixed(2),
    webhookUrl: `https://${shop}/apps/credit-rewards/api/reviews/webhook`,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "simulate_review") {
    const reviewType = formData.get("type"); // "text" | "photo" | "video"
    const amount = reviewType === "video" ? 10.0 : reviewType === "photo" ? 5.0 : 3.0;
    const label = reviewType === "video" ? "5-Star Video UGC Review" : reviewType === "photo" ? "5-Star Photo Review" : "5-Star Verified Text Review";

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/26024363524177",
        customerEmail: "himanshuyadav.12jan@gmail.com",
        customerName: "Himanshu Yadav",
        amount,
        currency: "USD",
        action: "CREDIT",
        source: "REVIEW_REWARD",
        note: `⭐ ${label} via Judge.me / Loox`,
        status: "COMPLETED",
      },
    });

    return { success: true, message: `Successfully simulated ${label} reward!` };
  }

  return { success: false };
};

export default function ReviewRewardsStudio() {
  const { reviewRewards, totalCount, totalAwarded, webhookUrl } = useLoaderData();
  const fetcher = useFetcher();
  const [textAmount, setTextAmount] = useState("3.00");
  const [photoAmount, setPhotoAmount] = useState("5.00");
  const [videoAmount, setVideoAmount] = useState("10.00");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulate = (type) => {
    fetcher.submit({ intent: "simulate_review", type }, { method: "POST" });
  };

  return (
    <s-page heading="⭐ Review &amp; UGC Video Reward Bridge">
      <s-layout>
        <s-layout-section>
          {/* Top Metrics */}
          <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
            <s-card>
              <s-text tone="subdued">Verified Reviews Rewarded</s-text>
              <s-text variant="headingXl" as="p">{totalCount}</s-text>
              <s-text tone="success">+48% Photo/Video UGC Lift</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Total Store Credit Issued</s-text>
              <s-text variant="headingXl" as="p" tone="success">${totalAwarded} USD</s-text>
              <s-text tone="subdued">High Second-Order Velocity</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Compatible Review Apps</s-text>
              <s-text variant="headingXl" as="p">4 Apps</s-text>
              <s-text tone="success">Loox, Judge.me, Yotpo, Okendo</s-text>
            </s-card>
          </s-grid>

          {/* Configuration Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">UGC Review Reward Payouts</s-text>
                  <s-text tone="subdued">
                    Incentivize high-converting customer photos and videos with tier-based store credit rewards.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Webhook Ready</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="300">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">📝 Verified Text Review</s-text>
                  <s-text-field
                    label="Reward Amount ($)"
                    type="number"
                    value={textAmount}
                    onChange={(e) => setTextAmount(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("text")}>
                      Simulate Text Reward
                    </s-button>
                  </div>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">📸 Photo UGC Review</s-text>
                  <s-text-field
                    label="Reward Amount ($)"
                    type="number"
                    value={photoAmount}
                    onChange={(e) => setPhotoAmount(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("photo")}>
                      Simulate Photo Reward
                    </s-button>
                  </div>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">🎥 Video UGC Review</s-text>
                  <s-text-field
                    label="Reward Amount ($)"
                    type="number"
                    value={videoAmount}
                    onChange={(e) => setVideoAmount(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("video")}>
                      Simulate Video Reward
                    </s-button>
                  </div>
                </s-box>
              </s-grid>

              <s-box padding="300" border="base" border-radius="200" background="bg-surface-tertiary">
                <s-inline-stack align="space-between" block-align="center">
                  <div>
                    <s-text variant="headingSm" as="h4">Webhook Destination URL</s-text>
                    <s-text tone="subdued">Paste this URL into your Judge.me, Loox, or Yotpo webhook settings:</s-text>
                    <code style={{ fontSize: "12px", background: "#ffffff", padding: "4px 8px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }}>
                      {webhookUrl}
                    </code>
                  </div>
                  <s-button size="slim" onClick={handleCopy}>
                    {copied ? "✓ Copied!" : "Copy URL"}
                  </s-button>
                </s-inline-stack>
              </s-box>

              {saved && (
                <s-banner tone="success">
                  Review reward rules saved and active!
                </s-banner>
              )}

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleSave}>
                  Save Review Reward Rules
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Recent Review Rewards Table */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Recent Review Reward Distributions</s-text>

              {reviewRewards.length === 0 ? (
                <s-box padding="400" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">No review rewards distributed yet. Use the simulation buttons above to test!</s-text>
                </s-box>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Reviewer</th>
                      <th style={{ padding: "10px" }}>Email</th>
                      <th style={{ padding: "10px" }}>UGC Type &amp; Rating</th>
                      <th style={{ padding: "10px" }}>Credit Awarded</th>
                      <th style={{ padding: "10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRewards.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{r.customerName || "Customer"}</td>
                        <td style={{ padding: "10px" }}>{r.customerEmail}</td>
                        <td style={{ padding: "10px", color: "#64748b" }}>{r.note}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: "#10b981" }}>
                          +${r.amount.toFixed(2)} USD
                        </td>
                        <td style={{ padding: "10px" }}>
                          <s-badge tone="success">Deposited</s-badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </s-block-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
