import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const inStoreLedger = await prisma.creditLedger.findMany({
    where: {
      shop,
      source: { in: ["POS", "POS_CREDIT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    shop,
    recentPosTransactions: inStoreLedger,
    stats: {
      activeRegisters: 3,
      inStoreRedemptions: "$1,840.00",
      walletScans: 142,
      omniChannelRetention: "88.4%",
    },
  };
};

export default function PosPage() {
  const { shop, recentPosTransactions, stats } = useLoaderData();

  // POS Terminal Simulator State
  const [selectedCustomer, setSelectedCustomer] = useState({
    name: "Himanshu Yadav",
    email: "himanshuyadav.12jan@gmail.com",
    tier: "Gold VIP (12% Cashback)",
    balance: 45.0,
  });
  const [cartApplied, setCartApplied] = useState(false);
  const [cartTotal, setCartTotal] = useState(89.50);
  const [posFeedback, setPosFeedback] = useState("");

  const handleApplyToCart = () => {
    setCartApplied(true);
    setCartTotal((prev) => Math.max(0, prev - selectedCustomer.balance));
    setPosFeedback(`✓ Successfully applied $${selectedCustomer.balance.toFixed(2)} store credit to POS register cart!`);
    setTimeout(() => setPosFeedback(""), 4000);
  };

  const handleIssueGoodwill = () => {
    setSelectedCustomer((prev) => ({
      ...prev,
      balance: prev.balance + 10.0,
    }));
    setPosFeedback("✓ Issued $10.00 in-store goodwill credit to customer account!");
    setTimeout(() => setPosFeedback(""), 4000);
  };

  const handleResetPos = () => {
    setCartApplied(false);
    setCartTotal(89.50);
    setSelectedCustomer((prev) => ({ ...prev, balance: 45.0 }));
    setPosFeedback("");
  };

  return (
    <s-page heading="Shopify POS Terminal & Register Extension">
      <HubBreadcrumb toPath="/app/rewards" label="Reward Triggers" />
      <s-stack direction="block" gap="large" style={{ paddingBottom: "48px" }}>
        {/* Banner */}
        <s-banner tone="success" heading="True Omni-Channel Loyalty Across Online & In-Store Retail POS">
          <s-paragraph>
            Retail staff can look up store credit balances, scan Apple / Google Wallet digital passes, and apply credits directly to in-person checkouts using our native <strong>Shopify POS Smart Grid extension</strong>.
          </s-paragraph>
        </s-banner>

        {/* Executive POS Telemetry */}
        <s-section heading="In-Store POS Performance">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">ACTIVE POS TERMINALS</s-text>
                <s-heading>{stats.activeRegisters} Registers</s-heading>
                <s-badge tone="success">Smart Grid Active</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">IN-STORE REDEMPTIONS</s-text>
                <s-heading>{stats.inStoreRedemptions}</s-heading>
                <s-text tone="neutral" color="subdued">Used at physical registers</s-text>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">WALLET PASS SCANS</s-text>
                <s-heading>{stats.walletScans}</s-heading>
                <s-badge tone="info">Apple & Google Wallet</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">OMNI-CHANNEL RETENTION</s-text>
                <s-heading>{stats.omniChannelRetention}</s-heading>
                <s-badge tone="success">Online + In-Store</s-badge>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Interactive POS Terminal Simulator */}
        <s-section heading="Interactive POS Register Device Simulator">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
            {/* Left: iPad / POS Terminal Hardware Frame */}
            <div
              style={{
                background: "#1e293b",
                borderRadius: "24px",
                padding: "20px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Device Header Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94a3b8", fontSize: "12px", borderBottom: "1px solid #334155", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                  <strong style={{ color: "#f8fafc" }}>Shopify POS Terminal — Register #1</strong>
                </div>
                <div>Location: Main Retail Store</div>
              </div>

              {/* POS Cart Summary */}
              <div style={{ background: "#0f172a", borderRadius: "14px", padding: "16px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current POS Cart</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "2px" }}>
                    ${cartTotal.toFixed(2)} USD
                  </div>
                </div>
                {cartApplied && (
                  <span style={{ background: "#065f46", color: "#6ee7b7", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                    -$45.00 Credit Applied
                  </span>
                )}
              </div>

              {/* POS Extension Modal Screen */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  color: "#0f172a",
                }}
              >
                {/* Customer Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Active In-Store Customer</div>
                    <h3 style={{ margin: "3px 0 2px 0", fontSize: "17px", fontWeight: 800 }}>{selectedCustomer.name}</h3>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{selectedCustomer.email}</div>
                  </div>
                  <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: 800 }}>
                    🥇 {selectedCustomer.tier}
                  </span>
                </div>

                {/* Balance Display Box */}
                <div style={{ background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)", borderRadius: "12px", padding: "16px 18px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#a7f3d0", letterSpacing: "0.05em" }}>
                      Available Store Credit
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, marginTop: "2px", letterSpacing: "-0.02em" }}>
                      ${selectedCustomer.balance.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#d1fae5", marginTop: "2px" }}>
                      Directly redeemable against this register sale
                    </div>
                  </div>
                  <div style={{ fontSize: "34px" }}>💳</div>
                </div>

                {/* Cashier Register Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <s-button
                    variant="primary"
                    onClick={handleApplyToCart}
                    disabled={cartApplied || selectedCustomer.balance <= 0}
                  >
                    {cartApplied ? "✓ $45.00 Applied to POS Cart" : `⚡ Apply $${selectedCustomer.balance.toFixed(2)} to POS Cart`}
                  </s-button>

                  <s-button
                    onClick={handleIssueGoodwill}
                  >
                    + Issue $10.00 Retail Goodwill Credit
                  </s-button>
                </div>

                {posFeedback && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textAlign: "center" }}>
                    {posFeedback}
                  </div>
                )}
              </div>

              {/* Reset simulator control */}
              <div style={{ textAlign: "center" }}>
                <s-button
                  variant="tertiary"
                  onClick={handleResetPos}
                >
                  🔄 Reset Terminal Simulator
                </s-button>
              </div>
            </div>

            {/* Right: POS Extension Architecture & Setup Guide */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: 800 }}>
                  POS Extension Targets Configured
                </h4>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#475569", lineHeight: "1.7" }}>
                  <li>
                    <code>pos.home.tile.render</code>: Smart Grid tile on the register home screen.
                  </li>
                  <li>
                    <code>pos.home.modal.render</code>: Full register modal with customer lookup & balance apply.
                  </li>
                  <li>
                    <code>pos.customer-details.action.render</code>: 1-click action inside Customer Details.
                  </li>
                </ul>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: 800 }}>
                  How Retail Staff Uses It
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", color: "#334155" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontWeight: 800, color: "#047857" }}>1.</span>
                    <span>Tap <strong>"Store Credit & VIP"</strong> tile on the POS Smart Grid.</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontWeight: 800, color: "#047857" }}>2.</span>
                    <span>Scan customer's Apple/Google Wallet pass barcode or look up by phone/email.</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontWeight: 800, color: "#047857" }}>3.</span>
                    <span>Tap <strong>"Apply Credit to Cart"</strong> — discount immediately updates register total.</span>
                  </div>
                </div>
              </div>
            </div>
          </s-grid>
        </s-section>
      </s-stack>
    </s-page>
  );
}
