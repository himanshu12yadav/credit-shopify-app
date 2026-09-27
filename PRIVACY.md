# Privacy Policy — Native Store Credit & Rewards

This app helps merchants issue and manage native Shopify store credit (cashback, referrals, VIP tiers, campaigns, POS goodwill credit) for their customers. This policy explains what data the app processes and why.

## Data we access from Shopify

Per the OAuth scopes granted at install, the app reads and writes:

- **Customers** (`read_customers`, `write_customers`) — to look up shoppers by email, and to update loyalty-related metafields (spend, order count, VIP tier) used to personalize the storefront experience.
- **Store credit accounts** (`read_store_credit_accounts`, `read_store_credit_account_transactions`, `write_store_credit_account_transactions`) — to issue and read native Shopify store credit balances. This is the app's core function; store credit itself always lives in Shopify's own ledger, never ours.
- **Orders** (`read_orders`) — received via the `orders/paid` and `refunds/create` webhooks, to award cashback/reward credit and process return-to-credit flows.
- **Pixels and customer events** (`write_pixels`, `read_pixels`, `read_customer_events`) — to run a first-party Web Pixel that measures how store credit affects checkout conversion.
- **Themes** (`read_themes`) — to detect whether the app's theme app extension is active.

## Data we store ourselves

The app keeps its own database (hosted on Neon Postgres) with the following shop-scoped data:

| Data | Purpose | Retention |
|---|---|---|
| Session tokens (`Session`) | Required to call the Shopify Admin API on the merchant's behalf | Deleted on app uninstall |
| Credit ledger (`CreditLedger`) | Audit trail of every store-credit issuance/debit — customer id, email, name, amount, source, note | Amount/date retained for merchant accounting; customer email/name are erased on a `customers/redact` request |
| Credit rules, campaigns, VIP tiers, settings | Merchant-configured automation rules — no customer PII | Deleted on app uninstall |
| Referrals (`Referral`) | Referral codes and referring customer id/email | Deleted on `customers/redact` for the referring customer, or on app uninstall |
| Pixel events (`PixelEvent`) | Storefront/checkout behavioral telemetry (event type, URL, order id, cart value) for the merchant's analytics dashboard | Purged automatically after 90 days |

## Data subject requests

This app implements Shopify's mandatory compliance webhooks:

- **`customers/data_request`** — compiles the requesting customer's credit ledger and referral records for the merchant to provide within Shopify's required window.
- **`customers/redact`** — removes the customer's name and email from their credit ledger entries (the transaction amounts/dates are retained for the merchant's own financial records) and deletes their referral records.
- **`shop/redact`** — deletes all of the shop's data from our database, fired by Shopify roughly 48 hours after the app is uninstalled.

## Third parties

We do not sell shop or customer data. Data may pass through:

- **Shopify** — the platform of record for all store credit balances and customer records.
- **PostHog** (optional, if configured by the merchant) — anonymized product-usage analytics for the app's own admin interface, not customer PII.

## Contact

Questions about this policy or a specific data request can be directed to the app's support contact listed on its Shopify App Store listing.

_Last updated: 2026-09-27_
