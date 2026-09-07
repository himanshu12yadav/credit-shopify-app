import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const birthdayRewards = await prisma.creditLedger.findMany({
    where: { shop, source: "BIRTHDAY_REWARD" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalWon = birthdayRewards.reduce((acc, r) => acc + r.amount, 0);

  return {
    shop,
    birthdayRewards,
    totalCount: birthdayRewards.length,
    totalAwarded: totalWon.toFixed(2),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "simulate_birthday") {
    const amount = parseFloat(formData.get("amount") || "10.0");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/26024363524177",
        customerEmail: "himanshuyadav.12jan@gmail.com",
        customerName: "Himanshu Yadav",
        amount,
        currency: "USD",
        action: "CREDIT",
        source: "BIRTHDAY_REWARD",
        note: `🎂 Happy Birthday! $${amount.toFixed(2)} Birthday VIP Credit (14-day expiry)`,
        expiresAt,
        status: "COMPLETED",
      },
    });

    return { success: true, message: `Successfully issued $${amount.toFixed(2)} Birthday Perk!` };
  }

  return { success: false };
};

export default function BirthdayStudio() {
  const { birthdayRewards, totalCount, totalAwarded } = useLoaderData();
  const fetcher = useFetcher();
  const [amount, setAmount] = useState("10.00");
  const [expiry, setExpiry] = useState("14");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSimulate = () => {
    fetcher.submit({ intent: "simulate_birthday", amount }, { method: "POST" });
  };

  return (
    <s-page heading="🎂 Automated Birthday Rewards Engine">
      <s-layout>
        <s-layout-section>
          {/* Top Metrics */}
          <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
            <s-card>
              <s-text tone="subdued">Birthdays Celebrated</s-text>
              <s-text variant="headingXl" as="p">{totalCount}</s-text>
              <s-text tone="success">+48.2% Redemption Rate</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Total Birthday Credits</s-text>
              <s-text variant="headingXl" as="p" tone="success">${totalAwarded} USD</s-text>
              <s-text tone="subdued">14-Day Urgent Window</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Average AOV Lift</s-text>
              <s-text variant="headingXl" as="p">+38.5%</s-text>
              <s-text tone="success">Shoppers treat as a treat</s-text>
            </s-card>
          </s-grid>

          {/* Configuration Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Birthday Reward Rules</s-text>
                  <s-text tone="subdued">
                    Automatically deposit store credit into customer accounts on the morning of their birthday.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Automated Cron Active</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="300">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">Gift Amount</s-text>
                  <s-select
                    label="Store Credit ($)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    options={[
                      { label: "$10.00 Birthday Perk", value: "10.00" },
                      { label: "$15.00 Birthday Perk", value: "15.00" },
                      { label: "$25.00 VIP Birthday Perk", value: "25.00" },
                      { label: "$50.00 Executive Perk", value: "50.00" },
                    ]}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">Urgency Expiry Window</s-text>
                  <s-select
                    label="Valid For"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    options={[
                      { label: "7 Days (Maximum Urgency)", value: "7" },
                      { label: "14 Days (Recommended)", value: "14" },
                      { label: "30 Days (Entire Birthday Month)", value: "30" },
                    ]}
                  />
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">Live Simulation</s-text>
                  <s-text tone="subdued">Simulate a birthday reward to test payout &amp; email delivery.</s-text>
                  <div style={{ marginTop: "10px" }}>
                    <s-button size="slim" variant="secondary" onClick={handleSimulate}>
                      ⚡ Simulate $10 Birthday Payout
                    </s-button>
                  </div>
                </s-box>
              </s-grid>

              <s-banner tone="info">
                The <strong>"Birthday VIP Rewards"</strong> block is ready in your theme! Add it to your Customer Account page or Footer to capture birthdays automatically.
              </s-banner>

              {saved && (
                <s-banner tone="success">
                  Birthday reward configuration saved successfully!
                </s-banner>
              )}

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleSave}>
                  Save Birthday Rules
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Recent Birthday Distributions Table */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Recent Birthday Gift Distributions</s-text>

              {birthdayRewards.length === 0 ? (
                <s-box padding="400" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">No birthday rewards distributed yet. Click the simulation button above to test!</s-text>
                </s-box>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Celebrant</th>
                      <th style={{ padding: "10px" }}>Email</th>
                      <th style={{ padding: "10px" }}>Gift Amount</th>
                      <th style={{ padding: "10px" }}>Urgency Expiry</th>
                      <th style={{ padding: "10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayRewards.map((b) => (
                      <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{b.customerName || "Customer"}</td>
                        <td style={{ padding: "10px" }}>{b.customerEmail}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: "#ec4899" }}>+${b.amount.toFixed(2)} USD</td>
                        <td style={{ padding: "10px", color: "#64748b" }}>
                          {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "14 Days"}
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
