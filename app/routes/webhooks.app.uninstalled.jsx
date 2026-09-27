import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Full data deletion happens on the shop/redact webhook (fired ~48h later,
  // per Shopify's own GDPR timing), not here. This just stops the app acting
  // on the shop's behalf immediately: deactivate settings/automation and
  // drop the now-unusable session.
  await db.creditSettings.updateMany({
    where: { shop },
    data: { cashbackEnabled: false, referralsEnabled: false, welcomeBonusEnabled: false },
  });
  await db.creditRule.updateMany({ where: { shop }, data: { isActive: false } });
  await db.campaign.updateMany({ where: { shop }, data: { isActive: false } });

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
