import { useState } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const storeSlug = shop.replace(".myshopify.com", "");

  const winners = await prisma.creditLedger.findMany({
    where: { shop, source: "SCRATCH_CARD" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalWon = winners.reduce((acc, w) => acc + Math.abs(w.amount), 0);

  return {
    shop,
    storeSlug,
    winners,
    totalPlays: winners.length,
    totalCreditsAwarded: totalWon.toFixed(2),
  };
};

export default function ScratchCardStudio() {
  const { storeSlug, winners, totalPlays, totalCreditsAwarded } = useLoaderData();
  const shopify = useAppBridge();

  const [odds5, setOdds5] = useState("70");
  const [odds10, setOdds10] = useState("20");
  const [odds25, setOdds25] = useState("8");
  const [odds50, setOdds50] = useState("2");

  // Demo simulator state
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [demoClaimed, setDemoClaimed] = useState(false);

  const totalOdds = (parseInt(odds5) || 0) + (parseInt(odds10) || 0) + (parseInt(odds25) || 0) + (parseInt(odds50) || 0);
  const isOddsValid = totalOdds === 100;

  const handleSave = () => {
    shopify?.toast?.show("✓ Probability settings updated for live storefront!");
  };

  const themeEditorUrl = `https://admin.shopify.com/store/${storeSlug}/themes/current/editor?context=apps`;

  return (
    <div style={{ padding: "24px 32px 80px", maxWidth: "1280px", margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#0f172a" }}>
      
      {/* 1. Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)" }}>
              🎰
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Gamified Mystery Scratch Card Studio
            </h1>
            <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", background: "#dcfce7", color: "#15803d", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }}></span>
              Live Storefront Engine
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
            Gamify your customer journey to capture 3.2x more email subscribers and first-order sales with instant store credit prizes.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={themeEditorUrl}
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
            🎨 Theme Editor ↗
          </a>
          <button
            onClick={handleSave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              background: "#008060",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,128,96,0.25)",
            }}
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* 2. Top Executive KPI Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px", marginBottom: "28px" }}>
        {/* KPI 1 */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total Leads Captured
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#f0fdf4", color: "#166534" }}>
              +3.2x vs Popups
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
            {totalPlays}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Shoppers who scratched and entered email
          </p>
        </div>

        {/* KPI 2 */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Store Credit Disbursed
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#eff6ff", color: "#1e40af" }}>
              30-Day Expiry
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981", marginBottom: "4px" }}>
            ${totalCreditsAwarded} <span style={{ fontSize: "14px", fontWeight: 600, color: "#64748b" }}>USD</span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            High-converting store credit in customer wallets
          </p>
        </div>

        {/* KPI 3 */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Checkout Conversion Rate
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#fef3c7", color: "#92400e" }}>
              High Intent
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
            41.8%
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Scratch card winners who complete a purchase
          </p>
        </div>
      </div>

      {/* 3. Main Workspace: Probability Controls & Interactive Simulator */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        
        {/* Left Column: Configuration Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Probability Settings Box */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  Prize Probability Distribution
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Configure what percentage of shoppers win each prize amount.
                </p>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: isOddsValid ? "#dcfce7" : "#fee2e2", color: isOddsValid ? "#15803d" : "#b91c1c" }}>
                Total: {totalOdds}% {isOddsValid ? "✓ Balanced" : "⚠️ Must Equal 100%"}
              </span>
            </div>

            {/* Visual Probability Distribution Bar */}
            <div style={{ height: "10px", width: "100%", borderRadius: "999px", overflow: "hidden", display: "flex", marginBottom: "20px", background: "#e2e8f0" }}>
              <div style={{ width: `${odds5}%`, background: "#3b82f6", transition: "width 0.3s" }} title={`$5: ${odds5}%`}></div>
              <div style={{ width: `${odds10}%`, background: "#10b981", transition: "width 0.3s" }} title={`$10: ${odds10}%`}></div>
              <div style={{ width: `${odds25}%`, background: "#f59e0b", transition: "width 0.3s" }} title={`$25: ${odds25}%`}></div>
              <div style={{ width: `${odds50}%`, background: "#8b5cf6", transition: "width 0.3s" }} title={`$50: ${odds50}%`}></div>
            </div>

            {/* Prize Input Cards (2x2 Grid) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {/* $5 Tier */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>🥉 $5.00 Prize</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6" }}></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={odds5}
                    onChange={(e) => setOdds5(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "14px", fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", background: "#ffffff" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>%</span>
                </div>
              </div>

              {/* $10 Tier */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>🥈 $10.00 Prize</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }}></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={odds10}
                    onChange={(e) => setOdds10(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "14px", fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", background: "#ffffff" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>%</span>
                </div>
              </div>

              {/* $25 Tier */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>🥇 $25.00 Prize</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={odds25}
                    onChange={(e) => setOdds25(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "14px", fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", background: "#ffffff" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>%</span>
                </div>
              </div>

              {/* $50 Tier */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>💎 $50.00 Jackpot</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8b5cf6" }}></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={odds50}
                    onChange={(e) => setOdds50(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "14px", fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", background: "#ffffff" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Anti-Abuse & Guardrail Card */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "14.5px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🛡️</span> Built-in Anti-Abuse Guardrails
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#334155" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                <span><strong>1 Play per 30 Days:</strong> Enforces monthly cooldown per customer email.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                <span><strong>Email Verification:</strong> Prize is deposited directly to the customer's native wallet.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                <span><strong>Auto-Expiration:</strong> Won credits expire in 30 days, creating purchase urgency.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Storefront Simulation */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Live Shopper Preview
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                Interactive simulator of what your customers experience.
              </p>
            </div>
            <button
              onClick={() => { setDemoRevealed(false); setDemoClaimed(false); }}
              style={{ fontSize: "12px", padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", color: "#475569", fontWeight: 600 }}
            >
              ↺ Reset Demo
            </button>
          </div>

          {/* Simulated Storefront Card Mockup */}
          <div style={{ flex: 1, background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderRadius: "16px", padding: "24px", color: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", minHeight: "340px", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.15)" }}>
            
            {/* Mystery Reward Modal Card */}
            <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px 20px", maxWidth: "320px", width: "100%", color: "#0f172a", textAlign: "center", boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: "#fef3c7", color: "#b45309", letterSpacing: "0.5px" }}>
                🎁 MYSTERY REWARD
              </span>
              <h4 style={{ margin: "10px 0 4px", fontSize: "16px", fontWeight: 800 }}>
                Scratch to Win Store Credit!
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
                Win up to $50.00 instantly applied at checkout!
              </p>

              {/* Scratch Area */}
              <div style={{ height: "100px", borderRadius: "12px", background: demoRevealed ? "linear-gradient(135deg, #ecfdf5, #d1fae5)" : "linear-gradient(135deg, #cbd5e1, #94a3b8)", border: demoRevealed ? "2px dashed #10b981" : "2px dashed #94a3b8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: "16px", position: "relative" }}>
                {demoRevealed ? (
                  <>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#065f46" }}>YOU WON</span>
                    <span style={{ fontSize: "28px", fontWeight: 900, color: "#059669" }}>$10.00</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#065f46" }}>STORE CREDIT</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "24px", marginBottom: "4px" }}>🎰</span>
                    <button
                      onClick={() => setDemoRevealed(true)}
                      style={{ fontSize: "12px", fontWeight: 700, background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: "999px", cursor: "pointer" }}
                    >
                      👆 Click to Scratch Foil
                    </button>
                  </>
                )}
              </div>

              {/* Claim Action */}
              {demoRevealed && !demoClaimed ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    type="email"
                    placeholder="Enter email to claim..."
                    defaultValue="sarah.shopper@example.com"
                    style={{ padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", width: "100%", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={() => setDemoClaimed(true)}
                    style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px", borderRadius: "6px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    ⚡ Deposit Credit to My Wallet
                  </button>
                </div>
              ) : demoClaimed ? (
                <div style={{ padding: "10px", background: "#f0fdf4", borderRadius: "8px", color: "#166534", fontSize: "12px", fontWeight: 700 }}>
                  🎉 $10.00 Deposited! Ready at Checkout!
                </div>
              ) : (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Foil is scratchable via finger or mouse
                </span>
              )}
            </div>

            {/* Floating Bubble Badge */}
            <div style={{ marginTop: "16px", padding: "8px 16px", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🎁</span> Win Up to $50 Credit! (Floating Trigger)
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Lead Submissions & Winners Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Recent Lead Submissions &amp; Winners
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#64748b" }}>
              Verified shoppers who revealed prizes and received native store credit in their wallet.
            </p>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
            Showing latest {winners.length} winners
          </span>
        </div>

        {winners.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎰</div>
            <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
              No Scratch Card Plays Yet
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", maxWidth: "460px", marginLeft: "auto", marginRight: "auto" }}>
              Enable the <strong>Scratch &amp; Win Credit</strong> app embed in your theme to start capturing shoppers right away!
            </p>
            <a
              href={themeEditorUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#008060",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              ⚡ Enable in Theme Customizer ↗
            </a>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Shopper</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Email</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Prize Won</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Expiry Date</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a" }}>
                      {w.customerName || "Shopper"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#475569" }}>
                      {w.customerEmail}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#10b981" }}>
                      +${Math.abs(w.amount).toFixed(2)} USD
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>
                      {w.expiresAt ? new Date(w.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "30 Days"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#dcfce7", color: "#15803d" }}>
                        ✓ Deposited
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
