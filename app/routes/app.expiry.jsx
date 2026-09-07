import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [settings, allActiveCredits, expiring7Days, expiring30Days] = await Promise.all([
    prisma.creditSettings.findUnique({ where: { shop } }),
    prisma.creditLedger.aggregate({
      where: { shop, action: "CREDIT", status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.creditLedger.findMany({
      where: {
        shop,
        action: "CREDIT",
        status: "COMPLETED",
        expiresAt: {
          gt: now,
          lte: in7Days,
        },
      },
      orderBy: { expiresAt: "asc" },
      take: 20,
    }),
    prisma.creditLedger.findMany({
      where: {
        shop,
        action: "CREDIT",
        status: "COMPLETED",
        expiresAt: {
          gt: now,
          lte: in30Days,
        },
      },
    }),
  ]);

  const totalLiability = allActiveCredits._sum.amount || 0;
  const expiring7Sum = expiring7Days.reduce((acc, c) => acc + c.amount, 0);
  const expiring30Sum = expiring30Days.reduce((acc, c) => acc + c.amount, 0);

  return {
    shop,
    settings: settings || { defaultExpiryDays: 90 },
    stats: {
      totalLiability,
      creditsCount: allActiveCredits._count,
      expiring7Sum,
      expiring7Count: expiring7Days.length,
      expiring30Sum,
      expiring30Count: expiring30Days.length,
    },
    expiring7Days,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_expiry_policy") {
    const days = parseInt(formData.get("defaultExpiryDays") || "90", 10);
    await prisma.creditSettings.upsert({
      where: { shop },
      create: { shop, defaultExpiryDays: days },
      update: { defaultExpiryDays: days },
    });
    return { success: true, message: `Default expiration set to ${days === 0 ? "No Expiry" : `${days} days`}` };
  }

  if (intent === "grant_grace_period") {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const graceExtensionDays = 30;

    const expiring = await prisma.creditLedger.findMany({
      where: {
        shop,
        action: "CREDIT",
        status: "COMPLETED",
        expiresAt: { gt: now, lte: in7Days },
      },
    });

    for (const item of expiring) {
      const newExpiry = new Date(item.expiresAt);
      newExpiry.setDate(newExpiry.getDate() + graceExtensionDays);
      await prisma.creditLedger.update({
        where: { id: item.id },
        data: {
          expiresAt: newExpiry,
          note: `${item.note || ""} [Extended +30 days grace period]`,
        },
      });
    }

    return {
      success: true,
      message: `Granted 30-day grace period extension to ${expiring.length} customer credits!`,
    };
  }

  return { success: false };
};

export default function ExpiryCockpitPage() {
  const { shop, settings, stats, expiring7Days } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedExpiry, setSelectedExpiry] = useState(String(settings.defaultExpiryDays || 90));
  const [simulatorMode, setSimulatorMode] = useState("email");
  const [simCustomer, setSimCustomer] = useState("Himanshu Yadav");
  const [simAmount, setSimAmount] = useState("89.99");
  const [simDays, setSimDays] = useState("7");

  const isSubmitting = fetcher.state !== "idle";

  const handleSavePolicy = (e) => {
    e.preventDefault();
    fetcher.submit(
      { intent: "save_expiry_policy", defaultExpiryDays: selectedExpiry },
      { method: "POST" }
    );
    shopify.toast.show("Expiration policy updated!");
  };

  const handleGrantGrace = () => {
    fetcher.submit(
      { intent: "grant_grace_period" },
      { method: "POST" }
    );
    shopify.toast.show("Processing grace period extension...");
  };

  return (
    <s-page heading="Automated Credit Expiry & Notification Cockpit">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "48px" }}>
        {/* Top Banner */}
        <s-banner tone="info" heading="Active Store Credit Retention & Expiration Lifecycle">
        <s-paragraph>
          Manage store credit expiration policies, monitor impending liability expirations, and preview automated retention alerts sent before credit lapses.
        </s-paragraph>
      </s-banner>

      {/* KPI Stats Section using s-section, s-grid, s-box, s-stack */}
      <s-section heading="Liability & Expiry Analytics">
        <s-grid gridtemplatecolumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" type="subdued">TOTAL ACTIVE LIABILITY</s-text>
              <s-heading>${stats.totalLiability.toFixed(2)}</s-heading>
              <s-badge tone="success">{stats.creditsCount} ledger entries</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="critical" type="subdued">EXPIRING IN 7 DAYS</s-text>
              <s-heading>${stats.expiring7Sum.toFixed(2)}</s-heading>
              <s-badge tone="critical">{stats.expiring7Count} customers need alert</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="warning" type="subdued">EXPIRING IN 30 DAYS</s-text>
              <s-heading>${stats.expiring30Sum.toFixed(2)}</s-heading>
              <s-badge tone="warning">{stats.expiring30Count} upcoming expirations</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderradius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="info" type="subdued">DEFAULT EXPIRY RULE</s-text>
              <s-heading>{settings.defaultExpiryDays === 0 ? "Lifetime" : `${settings.defaultExpiryDays} Days`}</s-heading>
              <s-badge tone="info">Active Policy</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Policies & Grace Period Section */}
      <s-section>
        <s-grid gridtemplatecolumns="1fr 1fr" gap="large">
          <s-stack direction="block" gap="base">
            <s-heading>Expiration Policy Configuration</s-heading>
            <s-paragraph tone="neutral">
              Select the default lifespan of newly issued store credit:
            </s-paragraph>
            <form onSubmit={handleSavePolicy}>
              <s-stack direction="block" gap="base">
                <s-select
                  label="Default Store Credit Lifespan"
                  value={selectedExpiry}
                  onChange={(e) => setSelectedExpiry(e.target.value)}
                >
                  <s-option value="30">30 Days (High Urgency Retention)</s-option>
                  <s-option value="60">60 Days (Standard Retail Cycle)</s-option>
                  <s-option value="90">90 Days (Recommended Lifecycle)</s-option>
                  <s-option value="180">180 Days (6 Months Grace)</s-option>
                  <s-option value="365">365 Days (1 Full Year)</s-option>
                  <s-option value="0">Never Expire (Lifetime Balance)</s-option>
                </s-select>

                <s-stack direction="inline">
                  <s-button type="submit" variant="primary" loading={isSubmitting}>
                    Save Expiry Policy
                  </s-button>
                </s-stack>
              </s-stack>
            </form>
          </s-stack>

          <s-stack direction="block" gap="base">
            <s-heading>Grace Period & Churn Prevention</s-heading>
            <s-paragraph tone="neutral">
              Grant a one-click 30-day grace period extension to all customers whose store credit is expiring within the next 7 days.
            </s-paragraph>
            <s-box padding="base" background="subdued" borderradius="base">
              <s-stack direction="inline" justifycontent="space-between" alignitems="center">
                <s-text>Credits Expiring This Week:</s-text>
                <s-badge tone={stats.expiring7Count > 0 ? "critical" : "neutral"}>
                  {stats.expiring7Count} credits (${stats.expiring7Sum.toFixed(2)})
                </s-badge>
              </s-stack>
            </s-box>
            <s-stack direction="inline">
              <s-button
                variant="secondary"
                disabled={stats.expiring7Count === 0 || isSubmitting}
                onClick={handleGrantGrace}
              >
                {stats.expiring7Count > 0
                  ? `Grant +30 Day Grace Extension (${stats.expiring7Count})`
                  : "No Credits Expiring in 7 Days"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-grid>
      </s-section>

      {/* Retention Alert Simulator Section */}
      <s-section heading="7-Day Expiration Retention Alert Simulator">
        <s-stack direction="block" gap="base">
          <s-paragraph tone="neutral">
            Preview the automated notification sent to customers 7 days before their credit balance lapses:
          </s-paragraph>

          <s-grid gridtemplatecolumns="1fr 1fr 1fr" gap="base">
            <s-text-field
              label="Simulated Customer"
              value={simCustomer}
              onInput={(e) => setSimCustomer(e.target.value)}
            />
            <s-number-field
              label="Expiring Balance ($)"
              value={simAmount}
              step="0.01"
              onInput={(e) => setSimAmount(e.target.value)}
            />
            <s-number-field
              label="Days Remaining"
              value={simDays}
              step="1"
              onInput={(e) => setSimDays(e.target.value)}
            />
          </s-grid>

          <s-stack direction="inline" gap="small">
            <s-button
              variant={simulatorMode === "email" ? "primary" : "secondary"}
              onClick={() => setSimulatorMode("email")}
            >
              ✉️ Email Alert Preview
            </s-button>
            <s-button
              variant={simulatorMode === "sms" ? "primary" : "secondary"}
              onClick={() => setSimulatorMode("sms")}
            >
              📱 SMS Alert Preview
            </s-button>
          </s-stack>

          {/* Simulator Visual Mockup */}
          {simulatorMode === "email" ? (
            <s-box padding="large" background="subdued" borderradius="base">
              <s-stack direction="block" gap="base" alignitems="center">
                <s-badge tone="warning">Subject: ⏳ Don't forget your ${simAmount} store credit, {simCustomer}!</s-badge>
                <s-box padding="large" background="base" borderradius="base" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
                  <s-heading>You have ${simAmount} expiring soon!</s-heading>
                  <s-paragraph>
                    Hi {simCustomer}, this is a friendly reminder that your available store credit balance of <strong>${simAmount}</strong> will expire in <strong>{simDays} days</strong>.
                  </s-paragraph>
                  <s-banner tone="success">
                    Credit applies automatically at checkout!
                  </s-banner>
                  <s-stack direction="inline" justifycontent="center">
                    <s-button variant="primary">Shop Now & Redeem ${simAmount}</s-button>
                  </s-stack>
                </s-box>
              </s-stack>
            </s-box>
          ) : (
            <s-box padding="large" background="subdued" borderradius="base">
              <s-stack direction="block" gap="base" alignitems="center">
                <s-box padding="base" background="base" borderradius="base" style={{ maxWidth: 360, width: "100%" }}>
                  <s-text tone="neutral" type="subdued">SMS Alert • Today</s-text>
                  <s-paragraph>
                    👋 Hey {simCustomer}! Friendly alert: your <strong>${simAmount}</strong> store credit at {shop?.split(".")[0]?.toUpperCase() || "VIP STORE"} expires in <strong>{simDays} days</strong>. Tap here to redeem before it's gone: credit.link/go
                  </s-paragraph>
                </s-box>
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {/* Expiring Credits Table */}
      <s-section padding="none">
        <s-box padding="base">
          <s-heading>At-Risk Credits Expiring in 7 Days ({expiring7Days.length})</s-heading>
        </s-box>
        <s-divider />

        {expiring7Days.length === 0 ? (
          <s-box padding="base">
            <s-paragraph tone="neutral">No store credits are expiring within the next 7 days.</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Expiring Amount</s-table-header>
              <s-table-header>Expires At</s-table-header>
              <s-table-header>Source</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {expiring7Days.map((c) => (
                <s-table-row key={c.id}>
                  <s-table-cell>
                    <s-text><strong>{c.customerName || c.customerEmail || "Customer"}</strong></s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text tone="critical"><strong>${c.amount.toFixed(2)}</strong></s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="critical">{new Date(c.expiresAt).toLocaleDateString()}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text tone="neutral">{c.source}</s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
      </div>
    </s-page>
  );
}
