// Public privacy policy page — the target of `privacy_policy_url` in
// shopify.app.toml, required for Shopify App Store review. Mirrors PRIVACY.md
// at the repo root; keep the two in sync when this changes.
//
// This is a resource route (loader returns a Response directly, no default
// component) so it renders as a standalone HTML document instead of being
// nested inside app/root.jsx's <html> shell.
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Privacy Policy — Native Store Credit &amp; Rewards</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; color: #1f2937; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 20px; margin-top: 32px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-size: 14px; }
    th { background: #f9fafb; }
    code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
    .updated { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Native Store Credit &amp; Rewards</p>

  <p>
    This app helps merchants issue and manage native Shopify store credit (cashback, referrals, VIP
    tiers, campaigns, POS goodwill credit) for their customers. This policy explains what data the app
    processes and why.
  </p>

  <h2>Data we access from Shopify</h2>
  <p>Per the OAuth scopes granted at install, the app reads and writes:</p>
  <ul>
    <li><strong>Customers</strong> &mdash; to look up shoppers by email, and to update loyalty-related metafields (spend, order count, VIP tier) used to personalize the storefront experience.</li>
    <li><strong>Store credit accounts</strong> &mdash; to issue and read native Shopify store credit balances. This is the app's core function; store credit itself always lives in Shopify's own ledger, never ours.</li>
    <li><strong>Orders</strong> &mdash; received via order/refund webhooks, to award cashback/reward credit and process return-to-credit flows.</li>
    <li><strong>Pixels and customer events</strong> &mdash; to run a first-party Web Pixel that measures how store credit affects checkout conversion.</li>
    <li><strong>Themes</strong> &mdash; to detect whether the app's theme app extension is active.</li>
  </ul>

  <h2>Data we store ourselves</h2>
  <table>
    <thead>
      <tr><th>Data</th><th>Purpose</th><th>Retention</th></tr>
    </thead>
    <tbody>
      <tr><td>Session tokens</td><td>Call the Shopify Admin API on the merchant's behalf</td><td>Deleted on app uninstall</td></tr>
      <tr><td>Credit ledger</td><td>Audit trail of every store-credit issuance/debit</td><td>Amounts kept for merchant accounting; name/email erased on request</td></tr>
      <tr><td>Rules, campaigns, tiers, settings</td><td>Merchant-configured automation &mdash; no customer PII</td><td>Deleted on app uninstall</td></tr>
      <tr><td>Referrals</td><td>Referral codes and referring customer id/email</td><td>Deleted on redaction request or app uninstall</td></tr>
      <tr><td>Pixel events</td><td>Storefront/checkout telemetry for the merchant's analytics dashboard</td><td>Purged after 90 days</td></tr>
    </tbody>
  </table>

  <h2>Data subject requests</h2>
  <p>This app implements Shopify's mandatory compliance webhooks:</p>
  <ul>
    <li><code>customers/data_request</code> &mdash; compiles the requesting customer's records for the merchant to provide.</li>
    <li><code>customers/redact</code> &mdash; removes the customer's name/email from their ledger entries and deletes their referral records.</li>
    <li><code>shop/redact</code> &mdash; deletes all of the shop's data, fired roughly 48 hours after uninstall.</li>
  </ul>

  <h2>Third parties</h2>
  <p>
    We do not sell shop or customer data. Data may pass through Shopify (the platform of record for
    all store credit and customer records) and, if the merchant configures it, PostHog for anonymized
    product-usage analytics on the app's own admin interface.
  </p>

  <h2>Contact</h2>
  <p>Questions about this policy can be directed to the app's support contact on its Shopify App Store listing.</p>
</body>
</html>`;

export const loader = () => {
  return new Response(HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
