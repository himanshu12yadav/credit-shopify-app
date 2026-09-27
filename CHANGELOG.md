# Changelog

This is the changelog for the Native Store Credit & Rewards app itself. (Prior to this file, the repository carried the changelog of the upstream `shopify-app-template-react-router` this app was scaffolded from — that history is available in git.)

## Unreleased

### Security
- Locked down every previously-unauthenticated public API route (`api/admin/customer-credit`, `api/pos/credit`, `api/storefront/*`, `api/customer-account/wallet`, `api/flow/action/issue-credit`, `api/support/appeasement`, `api/reviews/webhook`, `api/birthdays/process`) with the auth mechanism appropriate to its caller — Shopify session tokens, App Proxy signature verification, Customer Account session tokens, or a per-shop external API key.
- Added shared credit-amount validation (`app/services/credit-validation.server.js`) and deterministic idempotency keys on every credit-issuing path, closing double-credit risk from webhook redelivery or request replay.
- Migrated the POS extension off the legacy `@shopify/retail-ui-extensions-react` SDK to `@shopify/ui-extensions-react/point-of-sale`, wiring real session-token authentication and real backend calls (previously the "Issue Goodwill Credit" button only updated local UI state).
- Added the Shopify App Proxy config (`[app_proxy]` in `shopify.app.toml`) and moved storefront-facing routes behind it; the scratch-card prize amount is now rolled server-side rather than trusted from the client.
- Removed hardcoded developer PII (name/email/customer id) used as fallback/demo data across ~15 call sites, and a hardcoded PostHog API key fallback.
- Added per-shop+IP rate limiting to the web pixel ingestion endpoint.

### Compliance
- Implemented the three mandatory GDPR webhooks: `customers/data_request`, `customers/redact`, `shop/redact`.
- Added a data-retention purge job for `PixelEvent` rows (90-day window) and expanded the `app/uninstalled` handler to deactivate automation, not just delete the session.
- Added a privacy policy (`PRIVACY.md`, served at `/privacy`) and `privacy_policy_url` in `shopify.app.toml`.
- Trimmed unused OAuth scopes (`write_products`, `read_products`, `write_orders`) and removed leftover template scaffolding (demo product metafield/metaobject definitions).
- Standardized on Shopify API version `2026-07` across the app client, webhooks config, and every extension; replaced raw hardcoded `2024-07` Admin API `fetch()` calls with the versioned `admin.graphql`/`unauthenticated.admin` clients.

### Chores
- Added a lint step, Dependabot, and CodeQL to CI.
- Replaced the inherited upstream template README/CHANGELOG with app-specific documentation, and added a LICENSE.
