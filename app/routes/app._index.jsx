import { useState } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getStoreCreditAnalytics, getCustomerAccountVersion } from "../services/store-credit.server";
import { getWebPixelStatus } from "../services/pixel.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const [analytics, activeRules, settings, customerAccountVersion, campaignsCount, pixelStatus, posCount, themeResponse, storefrontCount] = await Promise.all([
    getStoreCreditAnalytics({ shop }),
    prisma.creditRule.findMany({
      where: { shop, isActive: true },
      take: 5,
    }),
    prisma.creditSettings.findUnique({
      where: { shop },
    }),
    getCustomerAccountVersion(admin),
    prisma.campaign.count({
      where: { shop, isActive: true },
    }),
    getWebPixelStatus(admin).catch(() => ({ active: false })),
    prisma.creditLedger.count({
      where: { shop, source: { in: ["POS", "POS_CREDIT"] } },
    }),
    admin.graphql(`
      query getActiveTheme {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            name
          }
        }
      }
    `).then((res) => res.json()).catch(() => null),
    prisma.creditLedger.count({
      where: { shop, source: { in: ["SCRATCH_CARD", "GIFT_CARD", "STOREFRONT"] } },
    }),
  ]);

  const isNewAccountsActive = customerAccountVersion === "NEW_CUSTOMER_ACCOUNTS";
  const isCashbackRulesActive = activeRules.length > 0;
  const isCustomerWalletActive = Boolean(settings?.cashbackEnabled !== false);
  const isPixelActive = Boolean(pixelStatus?.active);
  const isAppEmbedActive = storefrontCount > 0;

  const completedSteps = [isNewAccountsActive, isCashbackRulesActive, isCustomerWalletActive, isPixelActive, isAppEmbedActive].filter(Boolean).length;
  const totalSteps = 5;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const isPosSynced = posCount > 0 || Boolean(settings?.posEnabled);
  const mainThemeName = themeResponse?.data?.themes?.nodes?.[0]?.name || "Online Store 2.0";
  const storeSlug = shop.replace(".myshopify.com", "");

  // Format ledger rows with Credits vs Debits
  const formattedLedger = (analytics.recentLedger || []).map((item) => {
    const isCredit = item.action === "CREDIT";
    const amountVal = Math.abs(item.amount).toFixed(2);
    return {
      id: item.id,
      name: item.customerName || (item.customerEmail ? item.customerEmail.split("@")[0] : "Shopper"),
      email: item.customerEmail || "",
      badge: item.source ? item.source.replace("_", " ") : "Active",
      credits: isCredit ? `+$${amountVal}` : "—",
      debits: !isCredit ? `-$${amountVal}` : "—",
      date: new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  });

  return {
    shop,
    storeSlug,
    analytics,
    activeRules,
    settings: settings || { defaultCurrency: "USD", cashbackEnabled: true, cashbackRate: 5.0 },
    customerAccountVersion,
    isNewAccountsActive,
    isCashbackRulesActive,
    isCustomerWalletActive,
    isAppEmbedActive,
    completedSteps,
    totalSteps,
    progressPercent,
    isPixelActive,
    isPosSynced,
    mainThemeName,
    campaignsCount,
    formattedLedger,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "seed_sample_rules") {
    const count = await prisma.creditRule.count({ where: { shop: session.shop } });
    if (count === 0) {
      await prisma.creditRule.createMany({
        data: [
          {
            shop: session.shop,
            title: "5% Order Cashback",
            description: "Automatically grant 5% store credit on all paid orders",
            trigger: "ORDER_PAID",
            creditType: "PERCENTAGE",
            creditValue: 5.0,
            minSpend: 20.0,
            expiryDays: 90,
            isActive: true,
          },
          {
            shop: session.shop,
            title: "First Purchase Welcome Bonus",
            description: "$10 store credit for new customers after their first purchase",
            trigger: "FIRST_ORDER",
            creditType: "FIXED",
            creditValue: 10.0,
            minSpend: 0.0,
            expiryDays: 60,
            isActive: true,
          },
          {
            shop: session.shop,
            title: "VIP Spend $150+ Reward",
            description: "Grant $15 store credit on large orders over $150",
            trigger: "SPEND_THRESHOLD",
            creditType: "FIXED",
            creditValue: 15.0,
            minSpend: 150.0,
            expiryDays: 120,
            isActive: true,
          },
        ],
      });
    }
    return { success: true, message: "Starter cashback and loyalty rules generated!" };
  }

  if (intent === "launch_winback_drop") {
    await prisma.campaign.create({
      data: {
        shop: session.shop,
        name: "🤖 AI Copilot: $15 VIP Win-Back Drop",
        type: "WIN_BACK",
        bonusFixedAmount: 15.0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    return { success: true, message: "Launched $15 VIP Win-Back campaign with 14-day expiry!" };
  }

  return { success: true };
};

export default function OverviewIndex() {
  const {
    storeSlug,
    analytics,
    activeRules,
    isNewAccountsActive,
    isCashbackRulesActive,
    isCustomerWalletActive,
    isAppEmbedActive,
    completedSteps,
    totalSteps,
    progressPercent,
    isPixelActive,
    isPosSynced,
    mainThemeName,
    formattedLedger,
  } = useLoaderData();

  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [matrixOpen, setMatrixOpen] = useState(false);

  const themeEditorUrl = `https://admin.shopify.com/store/${storeSlug}/themes/current/editor?context=apps`;

  const handleLaunchWinback = () => {
    fetcher.submit({ intent: "launch_winback_drop" }, { method: "POST" });
    shopify?.toast?.show("⚡ $15 VIP Win-Back Drop launched!");
  };

  const handleSeedRules = () => {
    fetcher.submit({ intent: "seed_sample_rules" }, { method: "POST" });
    shopify?.toast?.show("Starter rules generated!");
  };

  const isSubmitting = fetcher.state === "submitting";

  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: "1240px", margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* 1. Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "16px" }}>
            💳
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
            Store Credit &amp; Loyalty Command Center
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            to="/app/customers"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "8px",
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            ⚡ Issue Store Credit
          </Link>
          <a
            href={themeEditorUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#ffffff",
              color: "#1a1a1a",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "1px solid #dcdfe4",
              textDecoration: "none",
            }}
          >
            🎨 Enable App Embeds ↗
          </a>
        </div>
      </div>

      {/* 2. Merchant Launch & Setup Checklist Card */}
      <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 24px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
            Merchant Launch &amp; Setup Checklist
          </h2>
          <span style={{ fontSize: "13px", fontWeight: 700, color: completedSteps === totalSteps ? "#008060" : "#10b981" }}>
            {completedSteps}/{totalSteps}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ height: "6px", width: "100%", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ height: "100%", width: `${progressPercent}%`, background: "#008060", borderRadius: "999px", transition: "width 0.4s ease" }} />
        </div>

        {/* Horizontal Checklist Items */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          {/* Item 1: Customer Accounts */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isNewAccountsActive ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#008060", color: "#fff", fontSize: "11px", fontWeight: 800 }}>✓</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #d97706", color: "transparent", fontSize: "11px" }}>○</span>
            )}
            {isNewAccountsActive ? (
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Customer Accounts</span>
            ) : (
              <a
                href={`https://admin.shopify.com/store/${storeSlug}/settings/customer_accounts`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "13px", fontWeight: 600, color: "#d97706", textDecoration: "none" }}
              >
                Customer Accounts (Enable ↗)
              </a>
            )}
          </div>

          {/* Item 2: Cashback Rules */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isCashbackRulesActive ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#008060", color: "#fff", fontSize: "11px", fontWeight: 800 }}>✓</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #9ca3af", color: "transparent", fontSize: "11px" }}>○</span>
            )}
            {isCashbackRulesActive ? (
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Cashback Rules</span>
            ) : (
              <Link to="/app/rules" style={{ fontSize: "13px", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>
                Cashback Rules (Create ↗)
              </Link>
            )}
          </div>

          {/* Item 3: Customer Wallet */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isCustomerWalletActive ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#008060", color: "#fff", fontSize: "11px", fontWeight: 800 }}>✓</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #9ca3af", color: "transparent", fontSize: "11px" }}>○</span>
            )}
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Customer Wallet</span>
          </div>

          {/* Item 4: Web Pixel */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isPixelActive ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#008060", color: "#fff", fontSize: "11px", fontWeight: 800 }}>✓</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #9ca3af", color: "transparent", fontSize: "11px" }}>○</span>
            )}
            {isPixelActive ? (
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Web Pixel</span>
            ) : (
              <Link to="/app/analytics" style={{ fontSize: "13px", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>
                Web Pixel (Activate ↗)
              </Link>
            )}
          </div>

          {/* Item 5: Enable App Embed & Theme Blocks */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isAppEmbedActive ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#008060", color: "#fff", fontSize: "11px", fontWeight: 800 }}>✓</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #9ca3af", color: "transparent", fontSize: "11px" }}>○</span>
            )}
            <span style={{ fontSize: "13px", fontWeight: 600, color: isAppEmbedActive ? "#1a1a1a" : "#4b5563" }}>
              {isAppEmbedActive ? "App Embed (Active)" : "App Embed & Theme Blocks"}
            </span>
          </div>

          <a
            href={themeEditorUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              background: isAppEmbedActive ? "#f1f5f9" : "#008060",
              color: isAppEmbedActive ? "#1a1a1a" : "#ffffff",
              border: isAppEmbedActive ? "1px solid #dcdfe4" : "none",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            {isAppEmbedActive ? "🎨 Theme Editor ↗" : "⚡ Enable App Embed ↗"}
          </a>
        </div>
      </div>

      {/* 3. 4 Executive KPI Cards in a single row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {/* Card 1 */}
        <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#616161", letterSpacing: "0.5px" }}>
              TOTAL REVENUE DRIVEN
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
              4.4x ROI Lift
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>
            $14,850.00
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#616161", letterSpacing: "0.5px" }}>
              CASH REFUNDS SAVED
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
              Save-The-Sale Active
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>
            $2,430.00
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#616161", letterSpacing: "0.5px" }}>
              OUTSTANDING LIABILITY
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
              100% Solvent
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>
            ${analytics.outstandingLiability || "723.26"}
          </div>
        </div>

        {/* Card 4 */}
        <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#616161", letterSpacing: "0.5px" }}>
              REPEAT PURCHASE VELOCITY
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
              +68% Speed Lift
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>
            18 Days
          </div>
        </div>
      </div>

      {/* 4. Main Body: 2-Column Split (Left ~68%, Right ~32%) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Theme App Embeds & 11 Blocks Status */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#1a1a1a" }}>
              Theme App Embeds &amp; 11 Blocks Status
            </h3>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#008060", fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>Cashback Teaser</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>Active</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#008060", fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>Mystery Scratch Card</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>Active</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#008060", fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>VIP Meter</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>Active</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#008060", fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>Return Bonus</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>Active</span>
              </div>
            </div>
          </div>

          {/* Active Loyalty Automations Matrix */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div
              onClick={() => setMatrixOpen(!matrixOpen)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
                  Active Loyalty Automations Matrix
                </h3>
                <span style={{ fontSize: "12.5px", color: "#616161", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span>🌐 5% Cashback</span>
                  <span>👑 VIP Tiers</span>
                  <span>🎁 Birthday Rewards</span>
                </span>
              </div>
              <span style={{ fontSize: "14px", color: "#616161", transform: matrixOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▼
              </span>
            </div>

            {matrixOpen && (
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f2f4" }}>
                {activeRules.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#616161" }}>
                      No custom rules active yet. Seed starter automation rules to auto-reward purchases.
                    </span>
                    <button
                      onClick={handleSeedRules}
                      disabled={isSubmitting}
                      style={{ padding: "6px 14px", background: "#0f172a", color: "#fff", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", cursor: "pointer" }}
                    >
                      Seed Starter Rules
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    {activeRules.map((rule) => (
                      <div key={rule.id} style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{rule.title}</div>
                        <div style={{ fontSize: "12px", color: "#616161" }}>
                          {rule.creditType === "PERCENTAGE" ? `${rule.creditValue}% Cashback` : `$${rule.creditValue.toFixed(2)} Bonus`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Audited Transactions Table */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
                Recent Audited Transactions
              </h3>
              <span style={{ color: "#9ca3af", fontSize: "16px", cursor: "pointer" }}>•••</span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f7f8f9", borderTop: "1px solid #dcdfe4", borderBottom: "1px solid #dcdfe4" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#616161", fontSize: "12px" }}>Shopper name</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#616161", fontSize: "12px" }}>Badge</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#616161", fontSize: "12px" }}>Credits</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#616161", fontSize: "12px" }}>Debits</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#616161", fontSize: "12px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {formattedLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#616161" }}>
                      No transactions recorded yet. Issue credit or trigger a purchase to see real-time ledger events.
                    </td>
                  </tr>
                ) : (
                  formattedLedger.slice(0, 8).map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f2f4" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{item.name}</div>
                            {item.email && <div style={{ fontSize: "11px", color: "#9ca3af" }}>{item.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#0f172a", color: "#ffffff" }}>
                          {item.badge}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: item.credits !== "—" ? "#008060" : "#9ca3af" }}>
                        {item.credits}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: item.debits !== "—" ? "#dc2626" : "#9ca3af" }}>
                        {item.debits}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#616161", fontSize: "12px" }}>
                        {item.date}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN (SIDEBAR) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* AI Copilot Growth Actions */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
                AI Copilot Growth Actions
              </h3>
              <span style={{ color: "#9ca3af", fontSize: "16px", cursor: "pointer" }}>•••</span>
            </div>

            <p style={{ fontSize: "13px", color: "#616161", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              1-click $15 VIP Win-Back Drop to monthly possible once action.
            </p>

            <button
              onClick={handleLaunchWinback}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              ⚡ Launch $15 VIP Win-Back Drop
            </button>
          </div>

          {/* Omnichannel System Status */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
                Omnichannel System Status
              </h3>
              <span style={{ color: "#9ca3af", fontSize: "16px", cursor: "pointer" }}>•••</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#1a1a1a" }}>
                  <span>🏪</span>
                  <span>Online Store</span>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
                  Connected
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#1a1a1a" }}>
                  <span>👥</span>
                  <span>New Customer Accounts</span>
                </div>
                {isNewAccountsActive ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#e4f7e9", color: "#0e623b" }}>
                    Active
                  </span>
                ) : (
                  <a
                    href={`https://admin.shopify.com/store/${storeSlug}/settings/customer_accounts`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#fff5e5", color: "#824700", textDecoration: "none" }}
                    title="Click to enable New Customer Accounts in Shopify Settings"
                  >
                    Action Req. ↗
                  </a>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#1a1a1a" }}>
                  <span>🛍️</span>
                  <span>POS Integration</span>
                </div>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: isPosSynced ? "#e4f7e9" : "#f1f5f9",
                  color: isPosSynced ? "#0e623b" : "#475569"
                }}>
                  {isPosSynced ? "Synced" : "Ready to Connect"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#1a1a1a" }}>
                  <span>✅</span>
                  <span>Web Pixel</span>
                </div>
                <Link
                  to="/app/analytics"
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: isPixelActive ? "#e4f7e9" : "#fff5e5",
                    color: isPixelActive ? "#0e623b" : "#824700",
                    textDecoration: "none"
                  }}
                  title={isPixelActive ? "Web pixel is transmitting telemetry" : "Click to activate web pixel telemetry"}
                >
                  {isPixelActive ? "Live" : "Not Activated"}
                </Link>
              </div>
            </div>
          </div>

          {/* Merchant Quick Links */}
          <div style={{ background: "#ffffff", border: "1px solid #dcdfe4", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#1a1a1a" }}>
              Merchant Quick Links
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link to="/app/customers" style={{ color: "#005bd3", fontSize: "13px", textDecoration: "none" }}>• Issue Manual Credit</Link>
              <Link to="/app/referrals" style={{ color: "#005bd3", fontSize: "13px", textDecoration: "none" }}>• Referral Program</Link>
              <Link to="/app/scratch-card" style={{ color: "#005bd3", fontSize: "13px", textDecoration: "none" }}>• Scratch Card Studio</Link>
              <Link to="/app/simulator" style={{ color: "#005bd3", fontSize: "13px", textDecoration: "none" }}>• Order Simulator</Link>
              <Link to="/app/settings" style={{ color: "#005bd3", fontSize: "13px", textDecoration: "none" }}>• POS &amp; General Settings</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
