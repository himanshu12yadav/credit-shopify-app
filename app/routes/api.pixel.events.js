import prisma from "../db.server";

/**
 * Ingestion endpoint for telemetry beacons emitted by the native Shopify Web
 * Pixel (extensions/credit-pixel/src/index.js).
 *
 * The pixel runs in a cross-origin sandbox and posts with `sendBeacon` (which
 * sends `text/plain`) or a `keepalive` fetch, so we read the raw body as text
 * and parse it ourselves. Every accepted beacon is persisted as one PixelEvent
 * row; the merchant Analytics screen aggregates from that table.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MYSHOPIFY_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const RAW_BODY_CAP = 16000; // characters kept in PixelEvent.raw
const KNOWN_STANDARD_EVENTS = new Set([
  "checkout_completed",
  "checkout_started",
  "cart_updated",
  "product_viewed",
]);

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// Resolve and authorize the shop the beacon claims to come from. Accepts a
// well-formed *.myshopify.com domain, or any domain that matches an installed
// Session row (covers custom primary domains).
async function resolveShop(rawShop) {
  const shop = String(rawShop || "").trim().toLowerCase();
  if (!shop) return null;
  if (MYSHOPIFY_DOMAIN.test(shop)) return shop;
  const session = await prisma.session.findFirst({ where: { shop } });
  return session ? session.shop : null;
}

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return jsonResponse({ status: "ok", service: "pixel-ingest" });
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    const rawText = await request.text();
    if (!rawText) return jsonResponse({ ok: false, error: "Empty body" }, 400);
    payload = JSON.parse(rawText);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const shop = await resolveShop(payload.shop);
  if (!shop) {
    return jsonResponse({ ok: false, error: "Unrecognized shop origin" }, 403);
  }

  const eventName = String(payload.event || "").trim();
  if (!eventName) {
    return jsonResponse({ ok: false, error: "Missing event name" }, 400);
  }

  const eventType =
    payload.eventType === "custom" || !KNOWN_STANDARD_EVENTS.has(eventName)
      ? "custom"
      : "standard";

  const data =
    payload.data && typeof payload.data === "object" ? payload.data : {};

  const discountCodes = Array.isArray(data.discountCodes)
    ? data.discountCodes.filter((c) => typeof c === "string")
    : [];

  let raw = "";
  try {
    raw = JSON.stringify(payload).slice(0, RAW_BODY_CAP);
  } catch {
    raw = "{}";
  }

  try {
    const record = await prisma.pixelEvent.create({
      data: {
        shop,
        eventName,
        eventType,
        shopifyEventId: payload.eventId ? String(payload.eventId) : null,
        clientId: payload.clientId ? String(payload.clientId) : null,
        occurredAt: toDate(payload.occurredAt),
        url: payload.url ? String(payload.url).slice(0, 2048) : null,
        orderId: data.orderId ? String(data.orderId) : null,
        checkoutToken: data.checkoutToken ? String(data.checkoutToken) : null,
        currency: data.currency ? String(data.currency).slice(0, 10) : null,
        value: toNumber(data.value),
        subtotal: toNumber(data.subtotal),
        lineItemsCount: Number.isFinite(data.lineItemsCount)
          ? data.lineItemsCount
          : 0,
        discountCodes: discountCodes.length
          ? JSON.stringify(discountCodes)
          : null,
        hasStoreCredit: Boolean(data.hasStoreCredit),
        storeCreditAmount: toNumber(data.storeCreditAmount),
        raw,
      },
      select: { id: true },
    });

    return jsonResponse({ ok: true, id: record.id, event: eventName });
  } catch (error) {
    console.error("[pixel-ingest] failed to persist event:", error);
    return jsonResponse({ ok: false, error: "Failed to persist event" }, 500);
  }
};
