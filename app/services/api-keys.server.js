import crypto from "node:crypto";
import prisma from "../db.server";

const KEY_PREFIX = "cak_"; // "credit app key"

function generateKey() {
  return `${KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
}

/**
 * Returns the shop's external-integration API key (used to authenticate
 * calls from Zendesk/Gorgias macros and Shopify Flow HTTP request actions),
 * creating one — and the shop's CreditSettings row, if missing — on first use.
 */
export async function getOrCreateExternalApiKey(shop) {
  let settings = await prisma.creditSettings.findUnique({ where: { shop } });

  if (!settings) {
    settings = await prisma.creditSettings.create({
      data: { shop, externalApiKey: generateKey() },
    });
  } else if (!settings.externalApiKey) {
    settings = await prisma.creditSettings.update({
      where: { shop },
      data: { externalApiKey: generateKey() },
    });
  }

  return settings.externalApiKey;
}

/** Issues a brand new key for the shop, invalidating the previous one. */
export async function regenerateExternalApiKey(shop) {
  const key = generateKey();
  await prisma.creditSettings.upsert({
    where: { shop },
    create: { shop, externalApiKey: key },
    update: { externalApiKey: key },
  });
  return key;
}

/**
 * Resolves the Authorization: Bearer <key> header on a request to the shop
 * that owns it. Keys are 192-bit random tokens looked up by unique index, so
 * an indexed exact match is used rather than an in-memory scan. Returns null
 * when the header is missing or the key doesn't match any shop.
 */
export async function resolveShopFromExternalApiKey(request) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const presentedKey = match[1].trim();
  if (!presentedKey) return null;

  const settings = await prisma.creditSettings.findUnique({
    where: { externalApiKey: presentedKey },
    select: { shop: true },
  });

  return settings?.shop || null;
}
