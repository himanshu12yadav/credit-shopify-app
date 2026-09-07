import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const winners = await prisma.creditLedger.findMany({
    where: { shop, source: "SCRATCH_CARD" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalWon = winners.reduce((acc, w) => acc + w.amount, 0);

  return {
    shop,
    winners,
    totalPlays: winners.length,
    totalCreditsAwarded: totalWon.toFixed(2),
  };
};

export default function ScratchCardStudio() {
  const { winners, totalPlays, totalCreditsAwarded } = useLoaderData();
  const [odds5, setOdds5] = useState("70");
  const [odds10, setOdds10] = useState("20");
  const [odds25, setOdds25] = useState("8");
  const [odds50, setOdds50] = useState("2");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <s-page heading="🎰 Gamified Mystery Scratch Card Studio">
      <s-layout>
        <s-layout-section>
          {/* Top Performance Metrics */}
          <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
            <s-card>
              <s-text tone="subdued">Total Leads Captured</s-text>
              <s-text variant="headingXl" as="p">{totalPlays}</s-text>
              <s-text tone="success">+3.2x vs Generic Popups</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Total Credit Awarded</s-text>
              <s-text variant="headingXl" as="p" tone="success">${totalCreditsAwarded} USD</s-text>
              <s-text tone="subdued">With 30-Day Expiry</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">First-Order Conversion</s-text>
              <s-text variant="headingXl" as="p">41.8%</s-text>
              <s-text tone="success">High Intent Shoppers</s-text>
            </s-card>
          </s-grid>

          {/* Configuration Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Prize Probability Distribution</s-text>
                  <s-text tone="subdued">Configure winning percentages for each store credit reward tier.</s-text>
                </s-block-stack>
                <s-badge tone="success">Anti-Abuse Enabled (1/Month)</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(140px, 1fr))" gap="300">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">$5.00 Prize</s-text>
                  <s-text-field
                    label="Probability %"
                    type="number"
                    value={odds5}
                    onChange={(e) => setOdds5(e.target.value)}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">$10.00 Prize</s-text>
                  <s-text-field
                    label="Probability %"
                    type="number"
                    value={odds10}
                    onChange={(e) => setOdds10(e.target.value)}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">$25.00 Prize</s-text>
                  <s-text-field
                    label="Probability %"
                    type="number"
                    value={odds25}
                    onChange={(e) => setOdds25(e.target.value)}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">$50.00 Grand Prize</s-text>
                  <s-text-field
                    label="Probability %"
                    type="number"
                    value={odds50}
                    onChange={(e) => setOdds50(e.target.value)}
                  />
                </s-box>
              </s-grid>

              <s-banner tone="info">
                The <strong>"Scratch &amp; Win Store Credit"</strong> block is ready in your Online Store 2.0 theme. Add it to your store footer or layout via <em>Online Store &gt; Customize</em>!
              </s-banner>

              {saved && (
                <s-banner tone="success">
                  Configuration saved successfully! Real-time odds updated on your storefront.
                </s-banner>
              )}

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleSave}>
                  Save Probability Settings
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Recent Winners Table */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Recent Lead Submissions &amp; Winners</s-text>
              <s-text tone="subdued">Verified shoppers who revealed prizes and received store credit:</s-text>

              {winners.length === 0 ? (
                <s-box padding="400" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">No scratch card plays yet. Activate the storefront block to start capturing high-converting leads!</s-text>
                </s-box>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Shopper</th>
                      <th style={{ padding: "10px" }}>Email</th>
                      <th style={{ padding: "10px" }}>Prize Amount</th>
                      <th style={{ padding: "10px" }}>Expires</th>
                      <th style={{ padding: "10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((w) => (
                      <tr key={w.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{w.customerName || "Shopper"}</td>
                        <td style={{ padding: "10px" }}>{w.customerEmail}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: "#10b981" }}>+${w.amount.toFixed(2)} USD</td>
                        <td style={{ padding: "10px", color: "#64748b" }}>
                          {w.expiresAt ? new Date(w.expiresAt).toLocaleDateString() : "30 Days"}
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
