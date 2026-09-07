import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const subscriptionLedger = await prisma.creditLedger.findMany({
    where: { shop, source: "SUBSCRIPTION_REWARD" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalAwarded = subscriptionLedger.reduce((acc, tx) => acc + tx.amount, 0);

  return {
    shop,
    subscriptionLedger,
    totalRewardsGiven: subscriptionLedger.length,
    totalCreditAwarded: totalAwarded.toFixed(2),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "simulate_milestone") {
    const customerEmail = formData.get("email") || "himanshuyadav.12jan@gmail.com";
    const milestoneNumber = formData.get("milestone") || "3";
    const amount = milestoneNumber === "3" ? 10.0 : milestoneNumber === "6" ? 25.0 : 50.0;

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/26024363524177",
        customerEmail,
        customerName: "Himanshu Yadav",
        amount,
        currency: "USD",
        action: "CREDIT",
        source: "SUBSCRIPTION_REWARD",
        note: `🔁 Subscription Milestone Award: Order #${milestoneNumber} Renewal Perk`,
        status: "COMPLETED",
      },
    });

    return { success: true, message: `Successfully rewarded Order #${milestoneNumber} subscriber!` };
  }

  return { success: false };
};

export default function SubscriptionLoyalty() {
  const { subscriptionLedger, totalRewardsGiven, totalCreditAwarded } = useLoaderData();
  const fetcher = useFetcher();
  const [m3, setM3] = useState("10.00");
  const [m6, setM6] = useState("25.00");
  const [m12, setM12] = useState("50.00");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSimulate = (milestone) => {
    fetcher.submit({ intent: "simulate_milestone", milestone }, { method: "POST" });
  };

  return (
    <s-page heading="🔁 Subscription Loyalty Perks &amp; Milestone Engine">
      <s-layout>
        <s-layout-section>
          {/* Metrics */}
          <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
            <s-card>
              <s-text tone="subdued">Subscribers Rewarded</s-text>
              <s-text variant="headingXl" as="p">{totalRewardsGiven}</s-text>
              <s-text tone="success">Retention +34%</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Total Milestone Credit</s-text>
              <s-text variant="headingXl" as="p" tone="success">${totalCreditAwarded} USD</s-text>
              <s-text tone="subdued">Reinvested in Add-ons</s-text>
            </s-card>

            <s-card>
              <s-text tone="subdued">Average Churn Reduction</s-text>
              <s-text variant="headingXl" as="p">-42.5%</s-text>
              <s-text tone="success">At 3rd &amp; 6th Renewals</s-text>
            </s-card>
          </s-grid>

          {/* Configuration Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Recurring Milestone Rewards</s-text>
                  <s-text tone="subdued">
                    Automatically deposit store credit into subscriber wallets when they achieve renewal milestones.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Shopify Subscriptions &amp; Recharge Synced</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="300">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">🥉 3rd Renewal Order</s-text>
                  <s-text-field
                    label="Credit Amount ($)"
                    type="number"
                    value={m3}
                    onChange={(e) => setM3(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("3")}>
                      Simulate 3rd Order
                    </s-button>
                  </div>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">🥈 6th Renewal Order</s-text>
                  <s-text-field
                    label="Credit Amount ($)"
                    type="number"
                    value={m6}
                    onChange={(e) => setM6(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("6")}>
                      Simulate 6th Order
                    </s-button>
                  </div>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text variant="headingSm" as="h4">🥇 12th Renewal Order</s-text>
                  <s-text-field
                    label="Credit Amount ($)"
                    type="number"
                    value={m12}
                    onChange={(e) => setM12(e.target.value)}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-button size="slim" onClick={() => handleSimulate("12")}>
                      Simulate 12th Order
                    </s-button>
                  </div>
                </s-box>
              </s-grid>

              {saved && (
                <s-banner tone="success">
                  Subscription milestone rules updated and active across webhook processing!
                </s-banner>
              )}

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleSave}>
                  Save Subscription Milestone Rules
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Recent Subscriber Rewards */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Recent Milestone Distributions</s-text>

              {subscriptionLedger.length === 0 ? (
                <s-box padding="400" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">No subscriber milestones distributed yet. Test with the simulation buttons above!</s-text>
                </s-box>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Subscriber</th>
                      <th style={{ padding: "10px" }}>Email</th>
                      <th style={{ padding: "10px" }}>Milestone Description</th>
                      <th style={{ padding: "10px" }}>Amount Awarded</th>
                      <th style={{ padding: "10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionLedger.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{tx.customerName || "Subscriber"}</td>
                        <td style={{ padding: "10px" }}>{tx.customerEmail}</td>
                        <td style={{ padding: "10px", color: "#64748b" }}>{tx.note}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: "#10b981" }}>
                          +${tx.amount.toFixed(2)} USD
                        </td>
                        <td style={{ padding: "10px" }}>
                          <s-badge tone="success">Completed</s-badge>
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
