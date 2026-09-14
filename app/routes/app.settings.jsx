import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCustomerAccountVersion } from "../services/store-credit.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const [settings, customerAccountVersion] = await Promise.all([
    prisma.creditSettings.findUnique({
      where: { shop },
    }),
    getCustomerAccountVersion(admin),
  ]);

  return {
    shop,
    settings: settings || {
      defaultCurrency: "USD",
      defaultExpiryDays: 90,
      returnCreditBonusPercent: 10.0,
      autoNotifyCustomer: true,
      cashbackEnabled: true,
      cashbackRate: 5.0,
    },
    customerAccountVersion,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const defaultCurrency = formData.get("defaultCurrency") || "USD";
  const defaultExpiryDays = parseInt(formData.get("defaultExpiryDays") || "90", 10);
  const returnCreditBonusPercent = parseFloat(formData.get("returnCreditBonusPercent") || "10.0");
  const autoNotifyCustomer = formData.get("autoNotifyCustomer") === "true";

  await prisma.creditSettings.upsert({
    where: { shop },
    create: {
      shop,
      defaultCurrency,
      defaultExpiryDays,
      returnCreditBonusPercent,
      autoNotifyCustomer,
    },
    update: {
      defaultCurrency,
      defaultExpiryDays,
      returnCreditBonusPercent,
      autoNotifyCustomer,
    },
  });

  return { success: true };
};

export default function SettingsPage() {
  const { shop, settings, customerAccountVersion } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSaving = fetcher.state === "submitting";

  const [defaultCurrency, setDefaultCurrency] = useState(settings.defaultCurrency);
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(String(settings.defaultExpiryDays));
  const [returnCreditBonusPercent, setReturnCreditBonusPercent] = useState(String(settings.returnCreditBonusPercent));
  const [autoNotifyCustomer, setAutoNotifyCustomer] = useState(settings.autoNotifyCustomer);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetcher.submit(
      {
        defaultCurrency,
        defaultExpiryDays,
        returnCreditBonusPercent,
        autoNotifyCustomer: String(autoNotifyCustomer),
      },
      { method: "POST" }
    );
    shopify.toast.show("Preferences saved successfully!");
  };

  const isNewAccountsActive = customerAccountVersion === "NEW_CUSTOMER_ACCOUNTS";
  const storeSlug = shop.replace(".myshopify.com", "");

  return (
    <s-page heading="Store Credit Settings & POS Guide">
      {/* Dynamic Status Banner */}
      {isNewAccountsActive ? (
        <s-banner tone="success" heading="New Customer Accounts Active">
          <s-paragraph>
            Your store is configured with <strong>New Customer Accounts</strong>. Store credit redemption at checkout is fully enabled.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-banner tone="warning" heading="Action Required: Enable New Customer Accounts">
          <s-paragraph>
            Shopify Native Store Credit requires <strong>New Customer Accounts</strong> for 1-click passwordless redemption during online checkout.
          </s-paragraph>
          <div style={{ marginTop: "10px" }}>
            <s-button
              variant="primary"
              href={`https://admin.shopify.com/store/${storeSlug}/settings/customer_accounts`}
              target="_blank"
            >
              Open Customer Accounts Settings Ã¢â€ â€”
            </s-button>
          </div>
        </s-banner>
      )}

      {/* Settings Form in native s-section with s-select, s-number-field, s-checkbox */}
      <s-section heading="General Credit Preferences">
        <form onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-stack direction="block" gap="small">
                <s-select
                  label="Primary Ledger Currency"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.currentTarget.value)}
                >
                  <s-option value="USD">USD ($) - United States Dollar</s-option>
                  <s-option value="EUR">EUR (Ã¢â€šÂ¬) - Euro</s-option>
                  <s-option value="GBP">GBP (Ã‚Â£) - British Pound</s-option>
                  <s-option value="CAD">CAD ($) - Canadian Dollar</s-option>
                  <s-option value="AUD">AUD ($) - Australian Dollar</s-option>
                  <s-option value="INR">INR (Ã¢â€šÂ¹) - Indian Rupee</s-option>
                </s-select>
                <s-text tone="neutral" color="subdued">
                  Store credit accounts in Shopify are currency-specific.
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-select
                  label="Default Credit Expiration Window"
                  value={defaultExpiryDays}
                  onChange={(e) => setDefaultExpiryDays(e.currentTarget.value)}
                >
                  <s-option value="30">30 Days</s-option>
                  <s-option value="60">60 Days</s-option>
                  <s-option value="90">90 Days (Recommended)</s-option>
                  <s-option value="180">180 Days (6 Months)</s-option>
                  <s-option value="365">365 Days (1 Year)</s-option>
                </s-select>
                <s-text tone="neutral" color="subdued">
                  Applied automatically to cashback and rule awards unless specified otherwise.
                </s-text>
              </s-stack>
            </s-grid>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-stack direction="block" gap="small">
                <s-number-field
                  label="Return / Refund Retention Bonus"
                  suffix="%"
                  value={returnCreditBonusPercent}
                  step="1"
                  min="0"
                  max="100"
                  onInput={(e) => setReturnCreditBonusPercent(e.currentTarget.value)}
                />
                <s-text tone="neutral" color="subdued">
                  Incentivize customers to keep funds in your store (e.g. 10% bonus turns $100 refund into $110 credit).
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-checkbox
                  label="Send Automatic Shopify Email Notifications"
                  checked={autoNotifyCustomer}
                  onChange={(e) => setAutoNotifyCustomer(e.currentTarget.checked)}
                />
                <s-text tone="neutral" color="subdued">
                  Notifies customers via Shopify's native email notifications when store credit is issued or adjusted.
                </s-text>
              </s-stack>
            </s-grid>

            <s-stack direction="inline" justifyContent="flex-end">
              <s-button type="submit" variant="primary" {...(isSaving ? { loading: true } : {})}>
                Save Preferences
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* POS Support Guide */}
      <s-section heading="Shopify POS (Point of Sale) Retail Integration">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Because this app integrates directly with Shopify's <strong>Native Store Credit API</strong>, no third-party POS hardware or extension apps are required. Store credit is treated as a first-class tender on your retail POS terminals.
          </s-paragraph>
          <s-stack direction="block" gap="small">
            <s-heading>Retail Staff Checkout Workflow:</s-heading>
            <ol style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", fontSize: "13px", color: "#334155" }}>
              <li>In the Shopify POS app, ring up items and tap <strong>Add customer</strong> to attach the shopper.</li>
              <li>The customer's available <strong>Store Credit balance</strong> displays directly on their cart card.</li>
              <li>Tap <strong>Checkout</strong> Ã¢â€ â€™ Under Payment Options, select <strong>Store Credit</strong>.</li>
              <li>If the balance does not cover the full order, POS allows split payments with card/cash.</li>
            </ol>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Online Checkout & Customer Portal Guide */}
      <s-section heading="Online Checkout & Customer Portal Verification">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Once New Customer Accounts are enabled, customers automatically get full native self-service access:
          </s-paragraph>
          <s-unordered-list>
            <s-list-item>Shoppers see their native <strong>Store credit balance</strong> right inside their customer account dashboard.</s-list-item>
            <s-list-item>During Checkout, the credit balance displays automatically as a payment option that can be applied with 1 click.</s-list-item>
            <s-list-item>Credits combine with discounts, gift cards, and credit cards seamlessly without coupon codes.</s-list-item>
          </s-unordered-list>
        </s-stack>
      </s-section>
    </s-page>
  );
}
