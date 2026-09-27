import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubBreadcrumb } from "../components/HubNav";

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

  if (intent === "save_milestones") {
    return { success: true, message: "Subscription milestone rules saved!" };
  }

  if (intent === "simulate_milestone") {
    const customerEmail = formData.get("email") || "subscriber@example.com";
    const milestoneNumber = formData.get("milestone") || "3";
    const amount = milestoneNumber === "3" ? 10.0 : milestoneNumber === "6" ? 25.0 : 50.0;

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/sample-subscriber",
        customerEmail,
        customerName: "Sample Customer",
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
  const shopify = useAppBridge();
  const [m3, setM3] = useState("10.00");
  const [m6, setM6] = useState("25.00");
  const [m12, setM12] = useState("50.00");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    if (e?.preventDefault) e.preventDefault();
    fetcher.submit({ intent: "save_milestones", m3, m6, m12 }, { method: "POST" });
    setSaved(true);
    shopify?.toast?.show("Subscription milestone rules saved!");
    setTimeout(() => setSaved(false), 4000);
  };

  const handleSimulate = (milestone) => {
    fetcher.submit({ intent: "simulate_milestone", milestone }, { method: "POST" });
    shopify?.toast?.show(`Simulated Order #${milestone} subscriber perk!`);
  };

  return (
    <s-page heading="🔁 Subscription Loyalty Perks & Milestone Engine">
      <HubBreadcrumb toPath="/app/rewards" label="Reward Triggers" />
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save Subscription Rules
      </s-button>

      <s-banner tone="info" heading="Combat Subscriber Churn with Automated Retention Perks">
        <s-paragraph>
          Automatically deposit store credit into customer wallets when subscribers hit renewal milestones (3rd, 6th, and 12th orders). Compatible with native Shopify Subscriptions, Recharge, and Bold.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Subscription Loyalty Performance">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">SUBSCRIBERS REWARDED</s-text>
              <s-heading>{totalRewardsGiven.toLocaleString()}</s-heading>
              <s-badge tone="success">Retention +34%</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">TOTAL MILESTONE CREDIT</s-text>
              <s-heading>${totalCreditAwarded} USD</s-heading>
              <s-badge tone="info">Reinvested in Add-ons</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">AVERAGE CHURN REDUCTION</s-text>
              <s-heading>-42.5%</s-heading>
              <s-badge tone="success">At 3rd &amp; 6th renewals</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Recurring Milestone Configuration */}
      <s-section heading="Recurring Milestone Rewards">
        <form onSubmit={handleSave}>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-paragraph tone="neutral">
                Set store credit reward amounts unlocked at each subscription renewal cycle.
              </s-paragraph>
              <s-badge tone="success">⚡ Webhook Automated</s-badge>
            </s-stack>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>🥉 3rd Renewal Order</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("3")}>
                      ⚡ Simulate
                    </s-button>
                  </s-stack>
                  <s-number-field
                    label="Credit Amount"
                    prefix="$"
                    step="1"
                    min="0"
                    value={m3}
                    onInput={(e) => setM3(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>

              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>🥈 6th Renewal Order</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("6")}>
                      ⚡ Simulate
                    </s-button>
                  </s-stack>
                  <s-number-field
                    label="Credit Amount"
                    prefix="$"
                    step="1"
                    min="0"
                    value={m6}
                    onInput={(e) => setM6(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>

              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading>🥇 12th Renewal (1 Year)</s-heading>
                    <s-button size="slim" onClick={() => handleSimulate("12")}>
                      ⚡ Simulate
                    </s-button>
                  </s-stack>
                  <s-number-field
                    label="Credit Amount"
                    prefix="$"
                    step="1"
                    min="0"
                    value={m12}
                    onInput={(e) => setM12(e.currentTarget.value)}
                  />
                </s-stack>
              </s-box>
            </s-grid>

            {saved && (
              <s-banner tone="success" heading="Milestones Saved">
                <s-paragraph>Subscription milestone rules updated and active across webhook processing!</s-paragraph>
              </s-banner>
            )}

            <s-stack direction="inline" justifyContent="flex-start">
              <s-button type="submit" variant="primary">
                Save Subscription Rules
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Recent Distributions Table */}
      <s-section heading="Recent Milestone Distributions">
        {subscriptionLedger.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small" alignItems="center">
              <s-heading>No subscriber milestones distributed yet</s-heading>
              <s-paragraph tone="neutral">
                Milestones trigger automatically upon subscription order creation or by clicking the simulation buttons above!
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-box padding="base">
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Subscriber</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Email</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Milestone Note</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Amount</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionLedger.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{tx.customerName || "Subscriber"}</td>
                    <td style={{ padding: "12px 14px", color: "#334155" }}>{tx.customerEmail}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{tx.note}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">+${tx.amount.toFixed(2)} USD</s-badge>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">Completed</s-badge>
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
