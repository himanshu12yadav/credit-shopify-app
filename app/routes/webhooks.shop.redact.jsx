import { authenticate } from "../shopify.server";
import db from "../db.server";

// Shopify mandatory GDPR webhook: fires ~48h after uninstall. Wipe all
// shop-scoped data. Belt-and-suspenders alongside app/uninstalled, which
// only clears sessions — this is the point full data removal must be done.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await Promise.all([
    db.creditLedger.deleteMany({ where: { shop } }),
    db.creditRule.deleteMany({ where: { shop } }),
    db.campaign.deleteMany({ where: { shop } }),
    db.referral.deleteMany({ where: { shop } }),
    db.creditSettings.deleteMany({ where: { shop } }),
    db.vipTier.deleteMany({ where: { shop } }),
    db.pixelEvent.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
