import { useState } from "react";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const storeSlug = shop.replace(".myshopify.com", "");
  const activeHolders = await prisma.creditLedger.groupBy({ by: ["customerId"], where: { shop }, _sum: { amount: true } });
  return { shop, storeSlug, totalAccountHolders: activeHolders.length, portalUrl: `https://${shop}/account`, customizerUrl: `https://admin.shopify.com/store/${storeSlug}/settings/customer-accounts` };
};

export default function CustomerPortalSettings() {
  const { shop, totalAccountHolders, portalUrl, customizerUrl } = useLoaderData();
  const shopify = useAppBridge();
  const [themeMode, setThemeMode] = useState("dark");
  const [showWalletPasses, setShowWalletPasses] = useState(true);
  const [showVipTracker, setShowVipTracker] = useState(true);
  const [showReferralLink, setShowReferralLink] = useState(true);
  const [activeSurfaceTab, setActiveSurfaceTab] = useState("account");

  return (
    <s-page heading="Customer Account Extensibility & Wallet Studio">
      <HubBreadcrumb toPath="/app/settings" label="Settings & Data" />
      <s-button slot="primary-action" variant="primary" onClick={() => window.open(customizerUrl, "_blank")}>Open Shopify account settings</s-button>
      <s-stack direction="block" gap="large">
        <HubSubNav clusterKey="settings" currentPath="/app/portal" />
        <s-banner tone="info" heading="Customer account extension">
          Configure the rewards wallet that logged-in shoppers see in Shopify Customer Accounts.
          <s-link href={portalUrl} target="_blank"> View live customer account</s-link>
        </s-banner>
        <s-section heading="Setup checklist">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
            {[
              ["1", "Enable New Customer Accounts", "Select New Customer Accounts in Shopify settings."],
              ["2", "Add the extension block", "Use the customer account customizer to place the Store Credit Wallet."],
              ["3", "Confirm automatic sync", "Balances and VIP benefits appear automatically for eligible shoppers."],
            ].map(([number, title, detail]) => <s-box key={number} padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-badge tone="info">Step {number}</s-badge><s-heading>{title}</s-heading><s-text tone="neutral" color="subdued">{detail}</s-text></s-stack></s-box>)}
          </s-grid>
        </s-section>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Active wallet holders</s-text><s-heading>{totalAccountHolders.toLocaleString()}</s-heading><s-text tone="neutral" color="subdued">Shoppers with a synced credit ledger</s-text></s-stack></s-box>
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Extension surfaces</s-text><s-heading>2 active targets</s-heading><s-text tone="neutral" color="subdued">Customer account and order status</s-text></s-stack></s-box>
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Digital passes</s-text><s-heading>Apple & Google</s-heading><s-text tone="neutral" color="subdued">One-tap wallet pass export</s-text></s-stack></s-box>
        </s-grid>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="large">
          <s-section heading="Display preferences">
            <s-stack direction="block" gap="base">
              <s-choice-list label="Wallet card style" name="wallet-style" values={[themeMode]} onChange={(event) => setThemeMode(event.currentTarget.values[0] || "dark")}>
                <s-choice value="dark" selected={themeMode === "dark"}>Executive dark</s-choice><s-choice value="emerald" selected={themeMode === "emerald"}>Royal emerald</s-choice><s-choice value="light" selected={themeMode === "light"}>Clean modern</s-choice>
              </s-choice-list>
              <s-divider />
              <s-switch label="Show digital wallet passes" checked={showWalletPasses} onChange={(event) => setShowWalletPasses(event.currentTarget.checked)} />
              <s-switch label="Show VIP tier progression" checked={showVipTracker} onChange={(event) => setShowVipTracker(event.currentTarget.checked)} />
              <s-switch label="Show customer referral link" checked={showReferralLink} onChange={(event) => setShowReferralLink(event.currentTarget.checked)} />
              <s-button variant="primary" onClick={() => shopify?.toast?.show("Account configuration saved")}>Save preferences</s-button>
            </s-stack>
          </s-section>
          <s-section heading="Live customer preview">
            <s-stack direction="block" gap="base">
              <s-button-group><s-button variant={activeSurfaceTab === "account" ? "primary" : "secondary"} onClick={() => setActiveSurfaceTab("account")}>Account page</s-button><s-button variant={activeSurfaceTab === "order-status" ? "primary" : "secondary"} onClick={() => setActiveSurfaceTab("order-status")}>Order status</s-button></s-button-group>
              <s-box padding="base" background="subdued" border="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" alignItems="center" justifyContent="space-between"><s-stack direction="block" gap="none"><s-heading>Welcome back, Alex</s-heading><s-text tone="neutral" color="subdued">alex.shopper@example.com</s-text></s-stack><s-badge tone="info">{activeSurfaceTab === "account" ? "Account page" : "Order status"}</s-badge></s-stack>
                  <s-box padding="base" background="base" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text>Native store credit balance ({themeMode} preview)</s-text><s-heading>$45.00 USD</s-heading><s-badge tone="success">Ready for checkout</s-badge><s-button-group><s-button variant="primary">Apply to cart</s-button>{showWalletPasses && <><s-button>Apple Wallet</s-button><s-button>Google Wallet</s-button></>}</s-button-group></s-stack></s-box>
                  {showVipTracker && <s-box padding="base" background="base" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-stack direction="inline" justifyContent="space-between"><s-heading>Gold VIP tier</s-heading><s-badge tone="warning">12% cashback</s-badge></s-stack><s-text tone="neutral" color="subdued">Spend $155 more to unlock Platinum VIP.</s-text></s-stack></s-box>}
                  {showReferralLink && <s-box padding="base" background="base" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-heading>Give $10, get $10</s-heading><s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end"><s-text-field label="Referral link" value={`https://${shop}?ref=ALEX-8892`} readOnly /><s-button onClick={() => shopify?.toast?.show("Link copied")}>Copy</s-button></s-grid></s-stack></s-box>}
                </s-stack>
              </s-box>
            </s-stack>
          </s-section>
        </s-grid>
      </s-stack>
    </s-page>
  );
}
