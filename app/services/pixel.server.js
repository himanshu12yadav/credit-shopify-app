/**
 * Manage the native Shopify Web Pixel (extensions/credit-pixel) for a merchant:
 *  - read its activation status
 *  - create or update the WebPixel record so the sandboxed pixel knows the
 *    absolute URL to send telemetry beacons to.
 *
 * Each app can have exactly one web pixel per shop, so `webPixelCreate` fails
 * with TAKEN once a record exists — we read first and route to `webPixelUpdate`.
 *
 * Requires the `write_pixels`, `read_pixels` and `read_customer_events` access
 * scopes (declared in shopify.app.toml).
 */

import prisma from "../db.server";

// Keys here MUST match [settings.fields] in
// extensions/credit-pixel/shopify.extension.toml.
export function buildPixelSettings(appUrl) {
  const base = String(appUrl || process.env.SHOPIFY_APP_URL || "")
    .trim()
    .replace(/\/+$/, "");
  return { appUrl: base, pixelEnabled: "true" };
}

const WEB_PIXEL_QUERY = `#graphql
  query CreditAppWebPixel {
    webPixel {
      id
      settings
    }
  }`;

const WEB_PIXEL_CREATE = `#graphql
  mutation CreditAppWebPixelCreate($webPixel: WebPixelInput!) {
    webPixelCreate(webPixel: $webPixel) {
      webPixel {
        id
        settings
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const WEB_PIXEL_UPDATE = `#graphql
  mutation CreditAppWebPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
    webPixelUpdate(id: $id, webPixel: $webPixel) {
      webPixel {
        id
        settings
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

// The Admin API returns `settings` as a JSON string; normalize to an object.
function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * @param {object} admin  Authenticated Admin GraphQL client from authenticate.admin()
 * @returns {Promise<{active: boolean, id: string|null, settings: object}>}
 */
export async function getWebPixelStatus(admin) {
  const response = await admin.graphql(WEB_PIXEL_QUERY);
  const body = await response.json();

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new Error(
      body.errors.map((e) => e.message).join("; ") || "webPixel query failed",
    );
  }

  const pixel = body.data?.webPixel || null;
  return {
    active: Boolean(pixel),
    id: pixel?.id || null,
    settings: parseSettings(pixel?.settings),
  };
}

/**
 * Create the WebPixel record, or update it in place if it already exists, so the
 * merchant's storefront pixel points at this app's ingestion endpoint.
 *
 * @param {object} admin
 * @param {{appUrl?: string}} [opts]
 * @returns {Promise<{ok: boolean, webPixel?: object, settings?: object, userErrors: Array, updated?: boolean}>}
 */
export async function activateWebPixel(admin, { appUrl } = {}, _attempt = 0) {
  const settings = buildPixelSettings(appUrl);
  if (!settings.appUrl) {
    return {
      ok: false,
      userErrors: [
        {
          message:
            "SHOPIFY_APP_URL is not configured, so the web pixel cannot be pointed at an ingestion endpoint.",
        },
      ],
    };
  }

  const current = await getWebPixelStatus(admin);

  const [operation, variables, resultKey] = current.active
    ? [
        WEB_PIXEL_UPDATE,
        { id: current.id, webPixel: { settings } },
        "webPixelUpdate",
      ]
    : [WEB_PIXEL_CREATE, { webPixel: { settings } }, "webPixelCreate"];

  const response = await admin.graphql(operation, { variables });
  const body = await response.json();

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    return {
      ok: false,
      userErrors: body.errors.map((e) => ({ message: e.message })),
    };
  }

  const payload = body.data?.[resultKey] || {};
  const userErrors = payload.userErrors || [];

  // Race: another request created the pixel between our read and our create.
  // Retry once as an update.
  if (
    !current.active &&
    _attempt === 0 &&
    userErrors.some((e) => e.code === "TAKEN")
  ) {
    return activateWebPixel(admin, { appUrl }, 1);
  }

  return {
    ok: userErrors.length === 0,
    webPixel: payload.webPixel || null,
    settings: parseSettings(payload.webPixel?.settings),
    userErrors,
    updated: current.active,
  };
}

/**
 * Aggregate the last `days` of Web Pixel telemetry (PixelEvent rows written by
 * app/routes/api.pixel.events.js) for a shop. Consumed by the merchant Analytics
 * screen.
 *
 * @param {string} shop
 * @param {{days?: number}} [opts]
 */
export async function getPixelAnalytics(shop, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.pixelEvent.findMany({
    where: { shop, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const byEvent = {};
  let assistedConversions = 0;
  let assistedRevenue = 0;
  let nonAssistedConversions = 0;
  let nonAssistedRevenue = 0;

  for (const e of events) {
    byEvent[e.eventName] = (byEvent[e.eventName] || 0) + 1;

    if (e.eventName === "checkout_completed") {
      const value = e.value || 0;
      if (e.hasStoreCredit) {
        assistedConversions += 1;
        assistedRevenue += value;
      } else {
        nonAssistedConversions += 1;
        nonAssistedRevenue += value;
      }
    }
  }

  const aovAssisted = assistedConversions
    ? assistedRevenue / assistedConversions
    : 0;
  const aovNonAssisted = nonAssistedConversions
    ? nonAssistedRevenue / nonAssistedConversions
    : 0;
  const liftPercent =
    aovNonAssisted > 0
      ? ((aovAssisted - aovNonAssisted) / aovNonAssisted) * 100
      : null;

  return {
    windowDays: days,
    totalEvents: events.length,
    byEvent,
    checkoutCompleted: byEvent.checkout_completed || 0,
    assistedConversions,
    assistedRevenue: Number(assistedRevenue.toFixed(2)),
    nonAssistedConversions,
    aovAssisted: Number(aovAssisted.toFixed(2)),
    aovNonAssisted: Number(aovNonAssisted.toFixed(2)),
    liftPercent: liftPercent == null ? null : Number(liftPercent.toFixed(1)),
    lastEventAt: events[0]?.createdAt ?? null,
    recentEvents: events.slice(0, 15).map((e) => ({
      id: e.id,
      event: e.eventName,
      type: e.eventType,
      value: e.value,
      currency: e.currency,
      orderId: e.orderId,
      hasStoreCredit: e.hasStoreCredit,
      occurredAt: e.occurredAt,
    })),
  };
}
