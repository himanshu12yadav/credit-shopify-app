import { register } from "@shopify/web-pixels-extension";

/**
 * Native Shopify Web Pixel — Store Credit & Rewards conversion tracking.
 *
 * Executes inside Shopify's sandboxed Web Worker (runtime_context = "strict"),
 * off the storefront main thread, so it adds zero latency to theme or checkout
 * page loads and covers standard + Shopify Plus checkouts with no theme JS.
 *
 * Beacons are POSTed to `${settings.appUrl}/api/pixel/events`. The pixel runs on
 * a different origin than the app, so `appUrl` must be an absolute URL (written
 * automatically by webPixelCreate/webPixelUpdate — see app/services/pixel.server.js).
 */

// Custom events published by this app's own surfaces (theme app blocks,
// checkout UI extension, customer-account UI extension) via
// `analytics.publish("credit_app:...", data)`.
const CUSTOM_EVENTS = [
  "credit_app:scratch_card_played",
  "credit_app:credit_slider_adjusted",
  "credit_app:reward_redeemed",
  "credit_app:tier_unlocked",
];

register(({ analytics, browser, settings, init }) => {
  const appUrl = normalizeBaseUrl(settings && settings.appUrl);
  const enabled =
    String((settings && settings.pixelEnabled) ?? "true").trim().toLowerCase() !==
    "false";
  const endpoint = appUrl ? `${appUrl}/api/pixel/events` : null;

  // No destination configured or merchant paused tracking → stay completely
  // inert. Never log to the storefront console.
  if (!endpoint || !enabled) return;

  const shopDomain =
    getPath(init, ["data", "shop", "myshopifyDomain"]) ||
    getPath(init, ["data", "shop", "domain"]) ||
    getPath(init, ["context", "document", "location", "host"]) ||
    null;

  const transmit = (name, type, data, event) => {
    try {
      const body = JSON.stringify({
        shop: shopDomain,
        event: name,
        eventType: type,
        eventId: (event && event.id) || null,
        clientId: (event && event.clientId) || null,
        occurredAt: (event && event.timestamp) || new Date().toISOString(),
        url:
          getPath(event, ["context", "document", "location", "href"]) || null,
        data,
      });

      // Prefer sendBeacon when the sandbox exposes it: fire-and-forget and
      // survives the checkout → Thank-you navigation. Otherwise fall back to a
      // keepalive fetch (always available in the worker sandbox).
      if (browser && typeof browser.sendBeacon === "function") {
        browser.sendBeacon(endpoint, body);
        return;
      }
      if (typeof fetch === "function") {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          mode: "cors",
        }).catch(() => {});
      }
    } catch (_err) {
      // Telemetry must never throw into the buyer's page.
    }
  };

  // 1. checkout_completed — order value, line items, discounts, and store-credit
  //    attribution (store credit at checkout is a payment method, so we inspect
  //    both `transactions` and `discountApplications`).
  analytics.subscribe("checkout_completed", (event) => {
    const checkout = getPath(event, ["data", "checkout"]) || {};
    const transactions = asArray(checkout.transactions);
    const discounts = asArray(checkout.discountApplications);

    const creditTransactions = transactions.filter((t) =>
      looksLikeStoreCredit(t && t.gateway),
    );
    const creditDiscounts = discounts.filter(
      (d) =>
        containsCredit(d && d.title) ||
        containsCredit(d && d.code) ||
        looksLikeStoreCredit(d && d.type),
    );

    const storeCreditAmount =
      sumMoney(creditTransactions.map((t) => t && t.amount)) ||
      sumMoney(creditDiscounts.map((d) => d && d.value)) ||
      null;

    transmit(
      "checkout_completed",
      "standard",
      {
        orderId: getPath(checkout, ["order", "id"]) || null,
        checkoutToken: checkout.token || null,
        currency:
          getPath(checkout, ["totalPrice", "currencyCode"]) ||
          checkout.currencyCode ||
          null,
        value: money(checkout.totalPrice),
        subtotal: money(checkout.subtotalPrice),
        lineItemsCount: asArray(checkout.lineItems).length,
        lineItems: asArray(checkout.lineItems)
          .slice(0, 50)
          .map((li) => ({
            title: li && li.title,
            quantity: li && li.quantity,
            price: money(getPath(li, ["variant", "price"])),
            productId: getPath(li, ["variant", "product", "id"]) || null,
          })),
        discountCodes: discounts
          .map((d) => (d && (d.code || d.title)) || null)
          .filter(Boolean),
        hasStoreCredit:
          creditTransactions.length > 0 || creditDiscounts.length > 0,
        storeCreditAmount,
        paymentGateways: transactions
          .map((t) => t && t.gateway)
          .filter(Boolean),
      },
      event,
    );
  });

  // 2. checkout_started — funnel entry telemetry.
  analytics.subscribe("checkout_started", (event) => {
    const checkout = getPath(event, ["data", "checkout"]) || {};
    transmit(
      "checkout_started",
      "standard",
      {
        checkoutToken: checkout.token || null,
        currency:
          getPath(checkout, ["totalPrice", "currencyCode"]) ||
          checkout.currencyCode ||
          null,
        value: money(checkout.totalPrice),
        subtotal: money(checkout.subtotalPrice),
        lineItemsCount: asArray(checkout.lineItems).length,
      },
      event,
    );
  });

  // 3. cart_updated — cart value progression toward VIP tier / reward thresholds.
  analytics.subscribe("cart_updated", (event) => {
    const cart = getPath(event, ["data", "cart"]) || {};
    transmit(
      "cart_updated",
      "standard",
      {
        currency: getPath(cart, ["cost", "totalAmount", "currencyCode"]) || null,
        value: money(getPath(cart, ["cost", "totalAmount"])),
        subtotal: money(getPath(cart, ["cost", "subtotalAmount"])),
        lineItemsCount: asArray(cart.lines).length,
        totalQuantity: cart.totalQuantity ?? null,
      },
      event,
    );
  });

  // 4. product_viewed — high-intent browsing signal for the AI Copilot.
  analytics.subscribe("product_viewed", (event) => {
    const variant = getPath(event, ["data", "productVariant"]) || {};
    transmit(
      "product_viewed",
      "standard",
      {
        productId: getPath(variant, ["product", "id"]) || null,
        productTitle: getPath(variant, ["product", "title"]) || null,
        variantId: variant.id || null,
        sku: variant.sku || null,
        currency: getPath(variant, ["price", "currencyCode"]) || null,
        value: money(variant.price),
      },
      event,
    );
  });

  // 5. Custom app events — scratch-card plays, credit-slider adjustments, etc.
  //    Published by our own extensions; anyone can publish custom events, so the
  //    ingestion endpoint treats `data` as untrusted.
  CUSTOM_EVENTS.forEach((name) => {
    analytics.subscribe(name, (event) => {
      transmit(
        name,
        "custom",
        {
          name: (event && event.name) || name,
          customData: (event && event.customData) || {},
        },
        event,
      );
    });
  });
});

/* ------------------------------- helpers -------------------------------- */

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function getPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Parse a Shopify MoneyV2 ({ amount, currencyCode }) to a number, or null.
function money(moneyV2) {
  const amount = moneyV2 && moneyV2.amount;
  if (amount == null) return null;
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  return Number.isFinite(n) ? n : null;
}

function sumMoney(list) {
  let total = 0;
  let seen = false;
  for (const m of asArray(list)) {
    const n = money(m);
    if (n != null) {
      total += n;
      seen = true;
    }
  }
  return seen ? Number(total.toFixed(2)) : null;
}

function containsCredit(value) {
  return typeof value === "string" && value.toLowerCase().includes("credit");
}

// "Store credit", "store-credit", "STORE_CREDIT" → true.
function looksLikeStoreCredit(value) {
  if (typeof value !== "string") return false;
  return value.toLowerCase().replace(/[^a-z]/g, "").includes("storecredit");
}
