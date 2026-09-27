# Native Store Credit & Rewards

A Shopify app that wraps Shopify's native [Store Credit Accounts](https://shopify.dev/docs/api/admin-graphql/latest/mutations/storeCreditAccountCredit) API to run a merchant's cashback, referral, VIP-tier, and loyalty program. Every credit or debit issued by the app is a real native Shopify store-credit transaction — this app never maintains its own separate balance — mirrored into a local Postgres ledger (`CreditLedger`) for auditing and analytics.

## Stack

- **Framework**: [React Router v7](https://reactrouter.com/) via `@shopify/shopify-app-react-router` (the current Shopify app template; formerly Remix)
- **Database**: Postgres (Neon), via Prisma ORM
- **Background jobs**: [Trigger.dev](https://trigger.dev/) (`src/trigger/`)
- **Extensions**: Admin UI, Checkout UI, Customer Account UI, POS UI, Web Pixel, and Theme App Extensions (`extensions/`)
- **Analytics**: PostHog (optional — set `POSTHOG_API_KEY` to enable)

## Feature surface

The merchant-facing admin app (`app/routes/app.*.jsx`) covers: credit rules & automation, campaigns, referrals, VIP tiers, scratch cards, birthday rewards, POS integration, return-to-credit, customer-support appeasements, review-app integration, Shopify Flow actions, Klaviyo sync, an analytics dashboard, and shop settings.

### How credit actually gets issued

All credit issuance goes through `app/services/store-credit.server.js` (`creditCustomer`/`debitCustomer`), which:
1. Validates and caps the amount (`app/services/credit-validation.server.js`) — every caller passes through this, no exceptions.
2. Calls Shopify's native `storeCreditAccountCredit`/`storeCreditAccountDebit` mutation.
3. Records the result in the local `CreditLedger` table, using a deterministic `idempotencyKey` per source so retries/webhook redelivery can't double-credit.

### Authenticating external callers

Several routes are called from outside an authenticated Shopify Admin session. Each uses the mechanism appropriate to its caller:

| Caller | Route(s) | Auth mechanism |
|---|---|---|
| Shopify Admin UI Extension | `api/admin/customer-credit`, `api/pos/credit` (via POS session token) | `authenticate.admin` verifying the extension's `idToken()`/session token |
| Shopify App Proxy (storefront) | `api/storefront/*` | `authenticate.public.appProxy` — see `[app_proxy]` in `shopify.app.toml` |
| Customer Account UI Extension | `api/customer-account/wallet` | `authenticate.public.customerAccount` verifying `sessionToken.get()` |
| Shopify Flow / helpdesk webhooks (Zendesk, Gorgias) / review platforms | `api/flow/action/issue-credit`, `api/support/appeasement`, `api/reviews/webhook`, `api/birthdays/process` | Per-shop external API key (`app/services/api-keys.server.js`), sent as `Authorization: Bearer <key>` — generated/rotated from the Flow and Appeasements admin pages |
| Web Pixel beacons | `api/pixel/events` | Shop-domain validation + per-shop/IP rate limiting (no session available for pixel beacons) |

## Local development

```sh
npm install
npm run dev        # shopify app dev — starts the app + tunnels it into a dev store
```

Requires a `.env` (copy `.env.example`) with at minimum `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SCOPES` matching `shopify.app.toml`'s `access_scopes`.

```sh
npm run build       # production build
npm run lint        # ESLint across app/, extensions/, src/
npx prisma studio   # inspect the database
```

## Compliance

- **GDPR mandatory webhooks** (`customers/data_request`, `customers/redact`, `shop/redact`) are implemented in `app/routes/webhooks.customers.*` and `webhooks.shop.redact.jsx`.
- **Privacy policy**: see `PRIVACY.md` (served at `/privacy`, referenced by `privacy_policy_url` in `shopify.app.toml`).
- **Data retention**: `PixelEvent` rows older than 90 days are purged by the `purge-old-pixel-events` scheduled Trigger.dev task.

## Deploying

```sh
npm run deploy      # shopify app deploy — pushes app config + extensions
```

CI (`.github/workflows/ci.yml`) lints, validates the Prisma schema, and builds on every push/PR to `main`. `.github/workflows/codeql.yml` runs static security analysis. `deploy.yml` runs after CI succeeds to deploy Trigger.dev workers and trigger a Render deploy hook.
