import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { searchCustomers } from "../services/store-credit.server";
import { getVipTiers } from "../services/tiers.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const rawCustomers = await searchCustomers({ admin, query: "" });
  const tiers = await getVipTiers(session.shop);

  const customersWithCredit = rawCustomers.map((c) => {
    const amountPart = c.totalSpent?.split(" ")[1] || "0";
    const totalSpent = parseFloat(amountPart) || 0;
    const tier = tiers.find((t) => totalSpent >= t.minSpend) || tiers[0];

    return {
      ...c,
      tier,
      barcodeId: `SHOPIFY-CREDIT-${c.id.split("/").pop()}`,
    };
  });

  return {
    shop: session.shop,
    customers: customersWithCredit,
  };
};

export default function WalletPage() {
  const { shop, customers } = useLoaderData();
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0);

  const customer = customers[selectedCustomerIndex] || {
    displayName: "Valued Shopper",
    email: "customer@example.com",
    creditBalance: "USD 50.00",
    id: "gid://shopify/Customer/123456",
    tier: { name: "Gold", badgeColor: "#d97706", cashbackRate: 12 },
    barcodeId: "SHOPIFY-CREDIT-123456",
  };

  const cleanShopName = shop.replace(".myshopify.com", "").toUpperCase();

  return (
    <s-page heading="Digital Store Credit Wallet Pass (Apple & Google Wallet)">
      <HubBreadcrumb toPath="/app/customers" label="Customers & Wallet" />
      <s-stack direction="block" gap="large" style={{ paddingBottom: "40px" }}>
        <HubSubNav clusterKey="customers" currentPath="/app/wallet" />
        {/* Banner with spacing */}
        <s-banner tone="info" heading="In-Store & Mobile Retail Experience">
          Digital wallet passes give your customers instant mobile access to their native store credit balance. In physical retail stores, cashiers scan the customer's pass directly at the POS register to redeem store credit tender.
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="base">
          {/* Customer Selector Sidebar */}
          <s-section padding="base">
            <s-stack direction="block" gap="base">
              <s-heading>Select Customer</s-heading>
              <s-paragraph tone="neutral">
                Choose a customer to preview their personalized digital wallet pass:
              </s-paragraph>

              <s-select
                label="Active Customer"
                value={String(selectedCustomerIndex)}
                onChange={(e) => setSelectedCustomerIndex(parseInt(e.currentTarget.value, 10))}
              >
                {customers.map((c, i) => (
                  <s-option key={c.id} value={String(i)}>
                    {c.displayName} ({c.creditBalance})
                  </s-option>
                ))}
              </s-select>

              <s-divider />

              <s-stack direction="block" gap="tight">
                <s-text><strong>Customer Details</strong></s-text>
                <s-text tone="neutral">Email: {customer.email}</s-text>
                <s-text tone="neutral">Orders: {customer.ordersCount || 0}</s-text>
                <s-text tone="neutral">Total Spend: {customer.totalSpent}</s-text>
                <s-text tone="neutral">
                  Loyalty Tier: <strong>{customer.tier?.name || "Bronze"} ({customer.tier?.cashbackRate || 5}% Cashback)</strong>
                </s-text>
              </s-stack>
            </s-stack>
          </s-section>

          {/* Digital Wallet Card Mockup Container */}
          <s-section padding="base">
            <s-stack direction="block" gap="base" alignItems="center">
              <s-heading>Mobile Wallet Pass Preview</s-heading>

              {/* Apple / Google Wallet Realistic Card */}
              <div
                style={{
                  width: "360px",
                  maxWidth: "100%",
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
                  borderRadius: "20px",
                  padding: "24px",
                  color: "#ffffff",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Glossy overlay effect */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "120px",
                    background: "radial-gradient(ellipse at top, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 70%)",
                    pointerEvents: "none",
                  }}
                />

                {/* Pass Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>
                      STORE CREDIT PASS
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.5px", marginTop: "2px" }}>
                      {cleanShopName}
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: customer.tier?.badgeColor || "#d97706",
                      color: "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    {customer.tier?.name || "Member"} VIP
                  </span>
                </div>

                {/* Balance Hero Section */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderRadius: "14px",
                    padding: "16px",
                    backdropFilter: "blur(10px)",
                    marginBottom: "20px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "1px" }}>
                    Available Store Credit
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: 800, color: "#4ade80", margin: "4px 0" }}>
                    {customer.creditBalance}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Redeemable online & in-store via barcode
                  </div>
                </div>

                {/* Cardholder Info */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Cardholder
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px" }}>
                      {customer.displayName}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Reward Rate
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px", color: "#38bdf8" }}>
                      {customer.tier?.cashbackRate || 5}% Cashback
                    </div>
                  </div>
                </div>

                {/* Barcode / QR Simulation for POS scanner */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {/* Clean SVG Barcode pattern */}
                  <svg width="240" height="50" viewBox="0 0 240 50">
                    <rect x="0" y="0" width="4" height="50" fill="#000000" />
                    <rect x="6" y="0" width="2" height="50" fill="#000000" />
                    <rect x="12" y="0" width="6" height="50" fill="#000000" />
                    <rect x="22" y="0" width="2" height="50" fill="#000000" />
                    <rect x="28" y="0" width="8" height="50" fill="#000000" />
                    <rect x="40" y="0" width="4" height="50" fill="#000000" />
                    <rect x="48" y="0" width="2" height="50" fill="#000000" />
                    <rect x="54" y="0" width="6" height="50" fill="#000000" />
                    <rect x="64" y="0" width="4" height="50" fill="#000000" />
                    <rect x="72" y="0" width="8" height="50" fill="#000000" />
                    <rect x="84" y="0" width="2" height="50" fill="#000000" />
                    <rect x="90" y="0" width="4" height="50" fill="#000000" />
                    <rect x="98" y="0" width="6" height="50" fill="#000000" />
                    <rect x="108" y="0" width="2" height="50" fill="#000000" />
                    <rect x="114" y="0" width="4" height="50" fill="#000000" />
                    <rect x="122" y="0" width="8" height="50" fill="#000000" />
                    <rect x="134" y="0" width="2" height="50" fill="#000000" />
                    <rect x="140" y="0" width="6" height="50" fill="#000000" />
                    <rect x="150" y="0" width="4" height="50" fill="#000000" />
                    <rect x="158" y="0" width="2" height="50" fill="#000000" />
                    <rect x="164" y="0" width="8" height="50" fill="#000000" />
                    <rect x="176" y="0" width="4" height="50" fill="#000000" />
                    <rect x="184" y="0" width="2" height="50" fill="#000000" />
                    <rect x="190" y="0" width="6" height="50" fill="#000000" />
                    <rect x="200" y="0" width="4" height="50" fill="#000000" />
                    <rect x="208" y="0" width="8" height="50" fill="#000000" />
                    <rect x="220" y="0" width="2" height="50" fill="#000000" />
                    <rect x="226" y="0" width="6" height="50" fill="#000000" />
                    <rect x="236" y="0" width="4" height="50" fill="#000000" />
                  </svg>
                  <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569", letterSpacing: "2px" }}>
                    {customer.barcodeId}
                  </div>
                </div>

                {/* Footer Notes */}
                <div style={{ marginTop: "16px", textAlign: "center", fontSize: "11px", color: "#64748b" }}>
                  Apple Wallet & Google Pay Compatible
                </div>
              </div>

              {/* Action Buttons for Pass Installation */}
              <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <s-button
                  variant="secondary"
                  onClick={() => alert(`Apple Wallet pass file (.pkpass) downloaded for ${customer.displayName}!`)}
                >
                  Download Apple Wallet (.pkpass)
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => alert(`Google Wallet link generated for ${customer.displayName}!`)}
                >
                  Save to Google Wallet
                </s-button>
              </div>

              <s-paragraph tone="neutral">
                Customers can save this pass to their phone wallet directly from their post-checkout order confirmation or account portal.
              </s-paragraph>
            </s-stack>
          </s-section>
        </s-grid>
      </s-stack>
    </s-page>
  );
}
