import { authenticate } from "../shopify.server";
import db from "../db.server";

// Shopify mandatory GDPR webhook: erase this customer's personal data.
// CreditLedger rows are anonymized (PII stripped) rather than deleted
// outright, since the amount/action history is financial/accounting record
// the merchant may need to retain; Referral rows (pure marketing data, no
// accounting requirement) are deleted.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId = payload?.customer?.id;
  if (!customerId) {
    return new Response();
  }

  const customerGid = `gid://shopify/Customer/${customerId}`;

  await Promise.all([
    db.creditLedger.updateMany({
      where: { shop, customerId: customerGid },
      data: { customerEmail: null, customerName: null },
    }),
    db.referral.deleteMany({ where: { shop, referrerCustomerId: customerGid } }),
  ]);

  return new Response();
};
