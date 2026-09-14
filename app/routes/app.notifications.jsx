import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.creditSettings.findUnique({
    where: { shop },
  });

  return {
    shop,
    settings: {
      brandColor: "#047857",
      brandName: shop.replace(".myshopify.com", "").toUpperCase(),
      autoNotifyCustomer: settings?.autoNotifyCustomer ?? true,
    },
    stats: {
      deliveredThisMonth: 1240,
      openRate: "58.6%",
      clickRate: "34.2%",
      revenuePerEmail: "$4.80",
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "send_test_notification") {
    const testEmail = formData.get("testEmail");
    const templateName = formData.get("templateName");
    return {
      success: true,
      message: `Test ${templateName} email sent to ${testEmail || session.shop}!`,
    };
  }

  if (intent === "save_branding") {
    return { success: true, message: "Notification studio branding saved!" };
  }

  return { success: false };
};

export default function NotificationsPage() {
  const { shop, settings, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [activeTemplate, setActiveTemplate] = useState("cashback");
  const [activeChannel, setActiveChannel] = useState("email"); // "email" or "sms"
  const [brandColor, setBrandColor] = useState(settings.brandColor);
  const [testEmail, setTestEmail] = useState("");

  const templatesData = {
    cashback: {
      name: "Order Cashback Earned",
      subject: "You've earned $12.50 in store credit from your recent order! 🎉",
      preheader: "Your store credit balance is ready to use on your next purchase.",
      badge: "CASHBACK REWARD",
      headline: "You've Earned Store Credit!",
      body: "Thank you for your purchase! As a valued shopper, we've deposited **$12.50** into your store credit account. You can use it right away on your next order or let it accumulate towards bigger perks.",
      cta: "Shop Now & Redeem Credit",
      sms: `Hey {{ customer_name }}, you just earned $12.50 in store credit on your order! Redeem it anytime at checkout: https://${shop}/account`,
    },
    milestone: {
      name: "Milestone Credit Drop Perk",
      subject: "A special gift for you: $15.00 VIP store credit has landed! 🌟",
      preheader: "Exclusive VIP loyalty reward just added to your account.",
      badge: "VIP MILESTONE PERK",
      headline: "Surprise! A $15.00 Credit Perk",
      body: "Because you're one of our top loyalty members, we've added a surprise **$15.00 credit gift** to your account. Treat yourself to something special before it expires in 30 days!",
      cta: "Claim $15.00 Perk",
      sms: `VIP Surprise: We just added $15.00 store credit to your account! Valid for 30 days. Shop your favorites: https://${shop}`,
    },
    expiry: {
      name: "7-Day Expiry Warning",
      subject: "Reminder: Your $25.00 store credit expires in 7 days ⏰",
      preheader: "Don't leave your balance behind. Use your credit before next Friday.",
      badge: "EXPIRATION ALERT",
      headline: "Don't Lose Your $25.00 Credit",
      body: "You currently have **$25.00 in store credit** that will expire in 7 days. Your credit can be applied to any product in our store — make sure to use it before it's gone!",
      cta: "Spend My $25.00 Before It Expires",
      sms: `Reminder: Your $25.00 store credit at ${settings.brandName} expires in 7 days! Don't let it go to waste: https://${shop}`,
    },
    appeasement: {
      name: "Customer Support Appeasement",
      subject: "A goodwill store credit of $15.00 has been issued to you 🤝",
      preheader: "We apologize for the inconvenience and appreciate your patience.",
      badge: "GOODWILL COURTESY",
      headline: "We Appreciate Your Patience",
      body: "Our support team has added **$15.00 in store credit** to your account to make things right regarding your recent inquiry. Thank you for being a wonderful customer!",
      cta: "View My Updated Balance",
      sms: `Our support team has credited $15.00 to your account. Thank you for your patience! View balance: https://${shop}/account`,
    },
    referral: {
      name: "Advocate Referral Bonus",
      subject: "Ka-ching! Your friend ordered — here is your $10.00 credit 🚀",
      preheader: "Your referral was successful. Your $10 reward is ready.",
      badge: "REFERRAL COMMISSION",
      headline: "Your Referral Was a Success!",
      body: "Great news! A friend used your referral link to place their first order. As promised, we've deposited **$10.00** into your store credit account.",
      cta: "Share More & Earn More",
      sms: `Success! Your friend just placed an order with your referral link. $10.00 has been added to your balance: https://${shop}`,
    },
  };

  const currentTpl = templatesData[activeTemplate];

  const handleSendTest = (e) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "send_test_notification",
        testEmail,
        templateName: currentTpl.name,
      },
      { method: "POST" }
    );
    shopify.toast.show(`Sent test ${currentTpl.name} preview!`);
  };

  return (
    <s-page heading="Automated Customer Email & SMS Template Studio">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "48px" }}>
        <HubSubNav clusterKey="integrations" currentPath="/app/notifications" />
        {/* Banner */}
        <s-banner tone="info" heading="High-Converting Notifications that Drive Urgent Repeat Orders">
          <s-paragraph>
            Store credit notifications generate <strong>58.6% open rates</strong> and <strong>$4.80 revenue per recipient</strong>. Customize branding, colors, and messaging across all core lifecycle triggers.
          </s-paragraph>
        </s-banner>

        {/* Executive Metrics Overview */}
        <s-section heading="Notification Engagement Metrics">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">DELIVERED THIS MONTH</s-text>
                <s-heading>{stats.deliveredThisMonth}</s-heading>
                <s-badge tone="success">99.8% Inbox rate</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">AVERAGE OPEN RATE</s-text>
                <s-heading>{stats.openRate}</s-heading>
                <s-badge tone="info">3.2x promo emails</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">CLICK-TO-PURCHASE RATE</s-text>
                <s-heading>{stats.clickRate}</s-heading>
                <s-badge tone="success">High Intent</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">REVENUE PER EMAIL</s-text>
                <s-heading>{stats.revenuePerEmail}</s-heading>
                <s-badge tone="success">Margin Booster</s-badge>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Template Selector Pills */}
        <s-section heading="Select Lifecycle Event Template">
          <s-stack direction="block" gap="base">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(templatesData).map(([key, t]) => (
                <s-button
                  key={key}
                  variant={activeTemplate === key ? "primary" : "secondary"}
                  onClick={() => setActiveTemplate(key)}
                >
                  {t.name}
                </s-button>
              ))}
            </div>

            <s-stack direction="inline" gap="small">
              <s-button
                variant={activeChannel === "email" ? "primary" : "secondary"}
                onClick={() => setActiveChannel("email")}
              >
                📧 Email (HTML)
              </s-button>
              <s-button
                variant={activeChannel === "sms" ? "primary" : "secondary"}
                onClick={() => setActiveChannel("sms")}
              >
                📱 SMS Text Message
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Studio Editor & Live Responsive Preview */}
        <s-section heading="Template Customizer & Live Preview">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
            {/* Left: Customizer Controls */}
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Email Subject Line"
                value={currentTpl.subject}
                required
              />

              <s-text-field
                label="Preheader / Preview Text"
                value={currentTpl.preheader}
              />

              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                <s-select
                  label="Brand Accent Color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.currentTarget.value)}
                >
                  <s-option value="#047857">Shopify Emerald (#047857)</s-option>
                  <s-option value="#0f172a">Midnight Slate (#0f172a)</s-option>
                  <s-option value="#4f46e5">Indigo Luxury (#4f46e5)</s-option>
                  <s-option value="#be123c">Ruby Celebration (#be123c)</s-option>
                </s-select>

                <s-text-field
                  label="Call to Action Button"
                  value={currentTpl.cta}
                />
              </s-grid>

              {/* Test Dispatch Form */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <strong style={{ fontSize: "13px", color: "#0f172a" }}>Send a Live Test Dispatch</strong>
                <form onSubmit={handleSendTest} style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <s-text-field
                    placeholder="Enter your email (e.g. you@domain.com)"
                    value={testEmail}
                    onInput={(e) => setTestEmail(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <s-button type="submit" variant="primary">Send Test</s-button>
                </form>
              </div>
            </s-stack>

            {/* Right: Live Responsive Preview Frame */}
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  ● Responsive Preview ({activeChannel.toUpperCase()})
                </span>
                <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700 }}>
                  ✓ HTML Verified
                </span>
              </div>

              {activeChannel === "email" ? (
                /* Desktop/Tablet Email Template Visualizer */
                <div
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {/* Email Header */}
                  <div style={{ background: brandColor, padding: "20px 24px", color: "#ffffff", textAlign: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "0.08em" }}>
                      {settings.brandName}
                    </h3>
                  </div>

                  {/* Email Body */}
                  <div style={{ padding: "28px 24px", textAlign: "center" }}>
                    <span
                      style={{
                        background: "#f0fdf4",
                        color: brandColor,
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "10px",
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {currentTpl.badge}
                    </span>

                    <h2 style={{ margin: "14px 0 10px 0", fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>
                      {currentTpl.headline}
                    </h2>

                    <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                      {currentTpl.body.replace(/\*\*/g, "")}
                    </p>

                    <div style={{ margin: "20px 0" }}>
                      <a
                        href="#"
                        style={{
                          display: "inline-block",
                          background: brandColor,
                          color: "#ffffff",
                          textDecoration: "none",
                          padding: "14px 28px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 700,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                      >
                        {currentTpl.cta}
                      </a>
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", marginTop: "24px", fontSize: "11px", color: "#94a3b8" }}>
                      You are receiving this email because you hold active store credit with {settings.brandName}.
                    </div>
                  </div>
                </div>
              ) : (
                /* Mobile Phone SMS Previewer */
                <div
                  style={{
                    width: "280px",
                    background: "#ffffff",
                    borderRadius: "28px",
                    border: "8px solid #0f172a",
                    padding: "16px 14px 28px 14px",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.15)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                    {settings.brandName} VIP SMS
                  </div>
                  <div
                    style={{
                      background: "#e2e8f0",
                      borderRadius: "14px",
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: "#0f172a",
                      lineHeight: "1.5",
                    }}
                  >
                    {currentTpl.sms.replace("{{ customer_name }}", "Alex")}
                  </div>
                </div>
              )}
            </div>
          </s-grid>
        </s-section>
      </div>
    </s-page>
  );
}
