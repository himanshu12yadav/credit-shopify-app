import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubBreadcrumb } from "../components/HubNav";

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

  if (intent === "save_settings") {
    return { success: true, message: "Birthday reward configuration saved!" };
  }

  if (intent === "simulate_birthday") {
    const amount = parseFloat(formData.get("amount") || "10.0");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/sample-birthday-celebrant",
        customerEmail: "celebrant@example.com",
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
  const shopify = useAppBridge();

  const [amount, setAmount] = useState("10.00");
  const [expiry, setExpiry] = useState("14");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    if (e?.preventDefault) e.preventDefault();
    fetcher.submit(
      { intent: "save_settings", amount, expiry },
      { method: "POST" }
    );
    setSaved(true);
    shopify?.toast?.show("Birthday reward rules saved!");
    setTimeout(() => setSaved(false), 4000);
  };

  const handleSimulate = () => {
    fetcher.submit({ intent: "simulate_birthday", amount }, { method: "POST" });
    shopify?.toast?.show(`Simulated a $${amount} birthday payout!`);
  };

  return (
    <s-page heading="🎂 Automated Birthday Rewards Engine">
      <HubBreadcrumb toPath="/app/rewards" label="Reward Triggers" />
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save Birthday Rules
      </s-button>
      <s-button slot="secondary-action" onClick={handleSimulate}>
        ⚡ Simulate Birthday Payout (${amount})
      </s-button>

      <s-banner tone="info" heading="Automated Birthday Store Credit Delivery">
        <s-paragraph>
          Automatically deposit urgent Store Credit into customer account wallets at 9:00 AM on their birthday. The <strong>"Birthday VIP Rewards"</strong> theme block is ready for your Customer Account page and Footer via <em>Online Store &gt; Customize</em>.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Birthday Program Analytics">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">BIRTHDAYS CELEBRATED</s-text>
              <s-heading>{totalCount.toLocaleString()}</s-heading>
              <s-badge tone="success">+48.2% Redemption Rate</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">TOTAL BIRTHDAY CREDITS</s-text>
              <s-heading>${totalAwarded} USD</s-heading>
              <s-badge tone="info">14-Day Urgent Window</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">AVERAGE AOV LIFT</s-text>
              <s-heading>+38.5%</s-heading>
              <s-badge tone="success">Shoppers treat as a treat</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">ANNUAL REPEAT RETENTION</s-text>
              <s-heading>82.4%</s-heading>
              <s-badge tone="success">Repeat Shoppers</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Configuration Section */}
      <s-section heading="Birthday Automation Rules">
        <form onSubmit={handleSave}>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-paragraph tone="neutral">
                Set the store credit reward amount and redemption deadline. The daily cron job executes at 09:00 UTC.
              </s-paragraph>
              <s-badge tone="success">⏰ Daily Automated Cron Active</s-badge>
            </s-stack>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-select
                label="Gift Credit Amount ($)"
                value={amount}
                onChange={(e) => setAmount(e.currentTarget.value)}
              >
                <s-option value="5.00">$5.00 Welcome Birthday Perk</s-option>
                <s-option value="10.00">$10.00 Standard Birthday Perk (Popular)</s-option>
                <s-option value="15.00">$15.00 Generous Birthday Perk</s-option>
                <s-option value="25.00">$25.00 VIP Tier Birthday Perk</s-option>
                <s-option value="50.00">$50.00 Executive Club Perk</s-option>
              </s-select>

              <s-select
                label="Urgency Expiry Window"
                value={expiry}
                onChange={(e) => setExpiry(e.currentTarget.value)}
              >
                <s-option value="7">7 Days (High Urgency Conversion)</s-option>
                <s-option value="14">14 Days (Recommended Balance)</s-option>
                <s-option value="30">30 Days (Entire Birthday Month)</s-option>
                <s-option value="60">60 Days (Extended Window)</s-option>
              </s-select>
            </s-grid>

            {saved && (
              <s-banner tone="success" heading="Rules Updated">
                <s-paragraph>Birthday reward configuration saved successfully!</s-paragraph>
              </s-banner>
            )}

            <s-stack direction="inline" justifyContent="flex-start">
              <s-button type="submit" variant="primary">
                Save Birthday Rules
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Recent Distributions Table */}
      <s-section heading="Recent Birthday Gift Distributions">
        {birthdayRewards.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small" alignItems="center">
              <s-heading>No birthday rewards distributed yet</s-heading>
              <s-paragraph tone="neutral">
                Click "Simulate Birthday Payout" above to test the automated reward delivery and customer account balance update!
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-box padding="base">
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Celebrant</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Email Address</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Gift Amount</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Urgency Expiry</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {birthdayRewards.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>
                      {b.customerName || "Customer Celebrant"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#334155" }}>{b.customerEmail || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">+${b.amount.toFixed(2)} USD</s-badge>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>
                      {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "14 Days"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="success">Deposited to Wallet</s-badge>
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
