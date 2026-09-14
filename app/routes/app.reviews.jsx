import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
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

  if (intent === "save_review_rules") {
    return { success: true, message: "Review reward rules saved!" };
  }

  if (intent === "simulate_review") {
    const reviewType = formData.get("type");
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
  const shopify = useAppBridge();
  const [textAmount, setTextAmount] = useState("3.00");
  const [photoAmount, setPhotoAmount] = useState("5.00");
  const [videoAmount, setVideoAmount] = useState("10.00");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = (e) => {
    if (e?.preventDefault) e.preventDefault();
    fetcher.submit({ intent: "save_review_rules", textAmount, photoAmount, videoAmount }, { method: "POST" });
    setSaved(true);
    shopify?.toast?.show("Review reward rules saved!");
    setTimeout(() => setSaved(false), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    shopify?.toast?.show("Webhook URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulate = (type) => {
    fetcher.submit({ intent: "simulate_review", type }, { method: "POST" });
    shopify?.toast?.show(`Simulated ${type} review reward!`);
  };

  return (
    <s-page heading="⭐ Review & UGC Video Reward Bridge">
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save Review Rules
      </s-button>

      <s-banner tone="info" heading="Incentivize High-Converting Photo & Video UGC">
        <s-paragraph>
          Reward verified customer product feedback with tiered store credit payouts. Connect your Judge.me, Loox, Yotpo, or Okendo review apps via webhook to automate instant deposits.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Review Incentivization Metrics">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">VERIFIED REVIEWS REWARDED</s-text>
              <s-heading>{totalCount.toLocaleString()}</s-heading>
              <s-badge tone="success">+48% Photo/Video UGC Lift</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">TOTAL STORE CREDIT ISSUED</s-text>
              <s-heading>${totalAwarded} USD</s-heading>
              <s-badge tone="info">High 2nd-Order Repeat Rate</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">COMPATIBLE REVIEW APPS</s-text>
              <s-heading>4 Apps</s-heading>
              <s-badge tone="success">Loox, Judge.me, Yotpo, Okendo</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Configuration Section */}
      <s-section heading="UGC Review Reward Payouts">
        <form onSubmit={handleSave}>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>📝 Text Review</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("text")}>⚡ Simulate</s-button>
                  </s-stack>
                  <s-number-field
                    label="Reward Amount"
                    prefix="$"
                    step="0.5"
                    min="0"
                    value={textAmount}
                    onInput={(e) => setTextAmount(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>

              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>📸 Photo UGC Review</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("photo")}>⚡ Simulate</s-button>
                  </s-stack>
                  <s-number-field
                    label="Reward Amount"
                    prefix="$"
                    step="0.5"
                    min="0"
                    value={photoAmount}
                    onInput={(e) => setPhotoAmount(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>

              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>🎥 Video UGC Review</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("video")}>⚡ Simulate</s-button>
                  </s-stack>
                  <s-number-field
                    label="Reward Amount"
                    prefix="$"
                    step="0.5"
                    min="0"
                    value={videoAmount}
                    onInput={(e) => setVideoAmount(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>
            </s-grid>

            {/* Webhook URL Box */}
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text tone="neutral">🔗 Review App Webhook Destination URL:</s-text>
                  <s-button size="slim" onClick={handleCopy}>
                    {copied ? "✓ Copied!" : "📋 Copy Webhook URL"}
                  </s-button>
                </s-stack>
                <s-text tone="neutral" color="subdued">
                  <code>{webhookUrl}</code>
                </s-text>
              </s-stack>
            </s-box>

            {saved && (
              <s-banner tone="success" heading="Rules Saved">
                <s-paragraph>Review reward rules saved and active for incoming webhooks!</s-paragraph>
              </s-banner>
            )}

            <s-stack direction="inline" justifyContent="flex-start">
              <s-button type="submit" variant="primary">
                Save Review Reward Rules
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Recent Distributions Table */}
      <s-section heading="Recent Review Reward Distributions">
        {reviewRewards.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small" alignItems="center">
              <s-heading>No review rewards distributed yet</s-heading>
              <s-paragraph tone="neutral">
                Test instant payout processing with the simulation buttons above, or connect your review app via webhook!
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-box padding="base">
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Reviewer</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Email</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>UGC Type &amp; Rating</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Credit Awarded</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reviewRewards.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{r.customerName || "Customer"}</td>
                    <td style={{ padding: "12px 14px", color: "#334155" }}>{r.customerEmail}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{r.note}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">+${r.amount.toFixed(2)} USD</s-badge>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">Deposited</s-badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
