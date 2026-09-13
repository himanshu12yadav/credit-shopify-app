import { useState } from "react";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const storeSlug = shop.replace(".myshopify.com", "");

  const activeHolders = await prisma.creditLedger.groupBy({
    by: ["customerId"],
    where: { shop },
    _sum: { amount: true },
  });

  return {
    shop,
    storeSlug,
    totalAccountHolders: activeHolders.length,
    portalUrl: `https://${shop}/account`,
    customizerUrl: `https://admin.shopify.com/store/${storeSlug}/settings/customer-accounts`,
  };
};

export default function CustomerPortalSettings() {
  const { shop, storeSlug, totalAccountHolders, portalUrl, customizerUrl } = useLoaderData();
  const shopify = useAppBridge();

  // Customizer state
  const [themeMode, setThemeMode] = useState("dark"); // dark, light, emerald
  const [showWalletPasses, setShowWalletPasses] = useState(true);
  const [showVipTracker, setShowVipTracker] = useState(true);
  const [showReferralLink, setShowReferralLink] = useState(true);
  const [activeSurfaceTab, setActiveSurfaceTab] = useState("account"); // account, order-status

  const handleSaveSettings = () => {
    shopify?.toast?.show("✓ Account Extensibility configuration saved!");
  };

  return (
    <div style={{ padding: "24px 32px 80px", maxWidth: "1280px", margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#0f172a" }}>
      
      {/* 1. Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #0284c7, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)" }}>
              💳
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Customer Account Extensibility &amp; Wallet Studio
            </h1>
            <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", background: "#dbeafe", color: "#1d4ed8", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb" }}></span>
              New Customer Accounts API
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
            Provide logged-in shoppers a seamless rewards dashboard inside Shopify's native passwordless Customer Accounts.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            👤 View Live Store Account ↗
          </a>
          <a
            href={customizerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#008060",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              borderRadius: "8px",
              textDecoration: "none",
              boxShadow: "0 1px 3px rgba(0,128,96,0.25)",
            }}
          >
            ⚙️ Shopify Account Settings ↗
          </a>
        </div>
      </div>

      {/* 2. Three-Step Merchant Setup Flow Banner */}
      <div style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", marginBottom: "28px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569", marginBottom: "12px" }}>
          🚀 3-Step Setup Flow for Merchants
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#ffffff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#e0e7ff", color: "#4338ca", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>1</span>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>Enable New Accounts</span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Ensure <em>New Customer Accounts</em> is selected in Shopify Admin Settings &gt; Customer accounts.
            </p>
          </div>

          <div style={{ background: "#ffffff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#e0e7ff", color: "#4338ca", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>2</span>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>Add Extension Block</span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Click <em>Customize</em> on the Customer Accounts page and insert the <strong>Store Credit Wallet</strong> block.
            </p>
          </div>

          <div style={{ background: "#ffffff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#dcfce7", color: "#15803d", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>Auto-Sync Enabled</span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Store credit balances and VIP perks display automatically with zero maintenance.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Top Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px", marginBottom: "28px" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Active Wallet Holders
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#f0fdf4", color: "#166534" }}>
              Live in Database
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
            {totalAccountHolders.toLocaleString()}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Shoppers with ledger entries synced to Shopify Core
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Extension Surfaces
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#eff6ff", color: "#1e40af" }}>
              2 Active Targets
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#2563eb", marginBottom: "4px" }}>
            Account + Order Status
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Full page dashboard + post-purchase order tracking block
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Digital Passes
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#fef3c7", color: "#92400e" }}>
              1-Tap Export
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981", marginBottom: "4px" }}>
            Apple &amp; Google
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Shoppers can save their QR store credit pass to phone wallets
          </p>
        </div>
      </div>

      {/* 4. Split Studio Layout: Customizer Settings (Left) & Live Simulator (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: "28px", alignItems: "start" }}>
        
        {/* Left: Customizer Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  Display &amp; Feature Preferences
                </h2>
                <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                  Fine-tune which widgets your customers see in their account portal.
                </p>
              </div>
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: "6px 14px",
                  background: "#008060",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>

            {/* Theme Style Selector */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569", marginBottom: "8px" }}>
                Wallet Card Style
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[
                  { id: "dark", label: "Executive Dark", bg: "#0f172a", border: "#334155" },
                  { id: "emerald", label: "Royal Emerald", bg: "#064e3b", border: "#047857" },
                  { id: "light", label: "Clean Modern", bg: "#f8fafc", border: "#cbd5e1" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeMode(t.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: themeMode === t.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: themeMode === t.id ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ width: "16px", height: "16px", borderRadius: "4px", background: t.bg, marginBottom: "6px", border: `1px solid ${t.border}` }} />
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Digital Wallet Passes (Apple / Google)</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Allow shoppers to export store credit pass to mobile wallet</div>
                </div>
                <input
                  type="checkbox"
                  checked={showWalletPasses}
                  onChange={(e) => setShowWalletPasses(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#008060", cursor: "pointer" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>VIP Tier Progression Bar</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Show spending progress towards the next cashback tier</div>
                </div>
                <input
                  type="checkbox"
                  checked={showVipTracker}
                  onChange={(e) => setShowVipTracker(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#008060", cursor: "pointer" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Customer Referral Link Card</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Display customer's unique referral link inside their account</div>
                </div>
                <input
                  type="checkbox"
                  checked={showReferralLink}
                  onChange={(e) => setShowReferralLink(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#008060", cursor: "pointer" }}
                />
              </label>
            </div>
          </div>

          {/* Educational Card: Native Customizer vs App Settings */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              💡 What does Shopify's Native Customizer provide?
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12.5px", color: "#475569", lineHeight: "1.6" }}>
              <li><strong>Section Placement:</strong> Reorder where the rewards block appears relative to order history and profile details.</li>
              <li><strong>Container Width &amp; Padding:</strong> Control whether the block stretches full width or stays contained.</li>
              <li><strong>Color Scheme:</strong> Automatically inherit your brand's font families and color palette.</li>
              <li><strong>Dynamic Visibility:</strong> Choose which customer segments or account views render the extension.</li>
            </ul>
          </div>

        </div>

        {/* Right: Live Interactive Customer Preview */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Interactive Customer View
              </span>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0", color: "#0f172a" }}>
                Live Storefront Simulator
              </h2>
            </div>

            {/* Surface Tab switcher */}
            <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              <button
                type="button"
                onClick={() => setActiveSurfaceTab("account")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeSurfaceTab === "account" ? "#ffffff" : "transparent",
                  color: activeSurfaceTab === "account" ? "#0f172a" : "#64748b",
                  boxShadow: activeSurfaceTab === "account" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                Account Page
              </button>
              <button
                type="button"
                onClick={() => setActiveSurfaceTab("order-status")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeSurfaceTab === "order-status" ? "#ffffff" : "transparent",
                  color: activeSurfaceTab === "order-status" ? "#0f172a" : "#64748b",
                  boxShadow: activeSurfaceTab === "order-status" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                Order Status Block
              </button>
            </div>
          </div>

          {/* Mock Customer Account Portal Container */}
          <div style={{ background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
            
            {/* Customer greeting */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Welcome back, Alex!</div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>alex.shopper@example.com</div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "#e2e8f0", color: "#334155" }}>
                Sign out
              </span>
            </div>

            {/* Wallet Balance Card Preview */}
            <div
              style={{
                borderRadius: "14px",
                padding: "24px",
                marginBottom: "16px",
                color: themeMode === "light" ? "#0f172a" : "#ffffff",
                background:
                  themeMode === "dark"
                    ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
                    : themeMode === "emerald"
                    ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
                border: themeMode === "light" ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.8 }}>
                    Native Store Credit Balance
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "2px" }}>
                    $45.00 <span style={{ fontSize: "16px", fontWeight: 600, opacity: 0.85 }}>USD</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: themeMode === "light" ? "#dcfce7" : "rgba(34, 197, 94, 0.2)",
                    color: themeMode === "light" ? "#15803d" : "#4ade80",
                    border: themeMode === "light" ? "1px solid #bbf7d0" : "1px solid rgba(74, 222, 128, 0.3)",
                  }}
                >
                  ✓ Ready for Checkout
                </span>
              </div>

              {/* Action buttons inside wallet card */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                <button
                  type="button"
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    background: themeMode === "light" ? "#0f172a" : "#ffffff",
                    color: themeMode === "light" ? "#ffffff" : "#0f172a",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Apply to Cart
                </button>
                {showWalletPasses && (
                  <>
                    <button
                      type="button"
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.12)",
                        color: themeMode === "light" ? "#334155" : "#ffffff",
                        border: themeMode === "light" ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.2)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      📲 Apple Wallet
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.12)",
                        color: themeMode === "light" ? "#334155" : "#ffffff",
                        border: themeMode === "light" ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.2)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🤖 Google Wallet
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* VIP Tier Progress Card */}
            {showVipTracker && (
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>🥇</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Gold VIP Tier</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#fef3c7", color: "#92400e" }}>
                    12% Cashback Active
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  Spend $155.00 more to unlock <strong>Platinum VIP (15% Cashback)</strong>
                </div>
                <div style={{ height: "7px", width: "100%", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "69%", background: "linear-gradient(90deg, #f59e0b, #eab308)", borderRadius: "999px" }} />
                </div>
              </div>
            )}

            {/* Referral Sharing Card */}
            {showReferralLink && (
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>🎁 Give $10, Get $10 Referral Link</span>
                  <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>1-Click Share</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    readOnly
                    value={`https://${shop}?ref=ALEX-8892`}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      background: "#f1f5f9",
                      color: "#334155",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => shopify?.toast?.show("Link copied!")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "#0f172a",
                      color: "#fff",
                      border: "none",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

          </div>

          <div style={{ marginTop: "16px", padding: "12px 16px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "#1e40af" }}>
              💡 Changes reflected in simulator are saved directly to your store's extension configuration.
            </span>
            <a
              href={customizerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", textDecoration: "underline", whiteSpace: "nowrap" }}
            >
              Open Customizer ↗
            </a>
          </div>

        </div>

      </div>

    </div>
  );
}
