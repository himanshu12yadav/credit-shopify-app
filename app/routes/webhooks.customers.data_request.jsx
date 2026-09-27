import { authenticate } from "../shopify.server";
import db from "../db.server";

// Shopify mandatory GDPR webhook: a customer (or Shopify, on their behalf)
// requested a copy of the data this app holds about them. Shopify does not
// read this webhook's response as the deliverable — the requirement is that
// the shop owner can get the data within 30 days, so we compile it and log
// it for the merchant to retrieve/forward. Swap the console.log for a real
// delivery mechanism (email, support ticket) if/when one exists in this app.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId = payload?.customer?.id;
  if (!customerId) {
    return new Response();
  }

  const customerGid = `gid://shopify/Customer/${customerId}`;

  const [ledgerEntries, referrals] = await Promise.all([
    db.creditLedger.findMany({ where: { shop, customerId: customerGid } }),
    db.referral.findMany({ where: { shop, referrerCustomerId: customerGid } }),
  ]);

  console.log(
    `[GDPR data_request] shop=${shop} customer=${customerGid} email=${payload?.customer?.email || "unknown"}: ` +
      `${ledgerEntries.length} CreditLedger row(s), ${referrals.length} Referral row(s). ` +
      `Compile and send to the shop owner within Shopify's 30-day window.`,
    { ledgerEntries, referrals }
  );

  return new Response();
};
