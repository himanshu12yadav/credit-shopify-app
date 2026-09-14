import { useState } from "react";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const [settings, referrals, totalClaims, topAdvocates] = await Promise.all([
    prisma.creditSettings.findUnique({ where: { shop } }),
    prisma.referral.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.referral.aggregate({ where: { shop }, _sum: { claimsCount: true } }),
    prisma.referral.findMany({ where: { shop, claimsCount: { gt: 0 } }, orderBy: { claimsCount: "desc" }, take: 10 }),
  ]);
  const totalClaimsCount = totalClaims._sum.claimsCount || 0;
  return {
    shop,
    settings: settings || { referralsEnabled: true },
    referrals,
    topAdvocates,
    stats: {
      totalAdvocates: referrals.length,
      totalClaimsCount,
      totalRewardsPaid: totalClaimsCount * 10,
      totalRevenueGenerated: totalClaimsCount * 65,
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "save_settings") {
    const referralsEnabled = formData.get("referralsEnabled") === "true";
    await prisma.creditSettings.upsert({ where: { shop }, create: { shop, referralsEnabled }, update: { referralsEnabled } });
    return { success: true, message: "Referral settings saved" };
  }
  if (intent === "create_referral") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const advocateReward = parseFloat(formData.get("advocateReward") || "10");
    const friendReward = parseFloat(formData.get("friendReward") || "10");
    if (!email) return { success: false, error: "Advocate email required" };
    const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await prisma.referral.create({ data: { shop, referrerCustomerId: `gid://shopify/Customer/advocate_${Date.now()}`, referrerEmail: email, referralCode, advocateRewardAmount: advocateReward, friendRewardAmount: friendReward } });
    return { success: true, message: `Created referral code ${referralCode} for ${email}` };
  }
  return { success: false };
};

export default function ReferralsPage() {
  const { settings, referrals = [], topAdvocates = [], stats = {}, shop } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [referralsEnabled, setReferralsEnabled] = useState(Boolean(settings?.referralsEnabled));
  const [friendReward, setFriendReward] = useState("10.00");
  const [advocateReward, setAdvocateReward] = useState("10.00");
  const [advocateEmail, setAdvocateEmail] = useState("");
  const isSubmitting = fetcher.state !== "idle";

  const saveSettings = (event) => {
    event.preventDefault();
    fetcher.submit({ intent: "save_settings", referralsEnabled: String(referralsEnabled) }, { method: "POST" });
    shopify.toast.show("Referral program settings updated");
  };
  const createReferral = (event) => {
    event.preventDefault();
    if (!advocateEmail.trim()) return shopify.toast.show("Enter an advocate email");
    fetcher.submit({ intent: "create_referral", email: advocateEmail, advocateReward, friendReward }, { method: "POST" });
    setAdvocateEmail("");
    shopify.toast.show("New referral code created");
  };
  const metrics = [
    ["Active advocates", stats.totalAdvocates || 0, "Registered referrers"],
    ["Successful referrals", stats.totalClaimsCount || 0, "New customers acquired"],
    ["Rewards disbursed", `$${(stats.totalRewardsPaid || 0).toFixed(2)}`, "Native store credit awarded"],
    ["Estimated referral revenue", `$${(stats.totalRevenueGenerated || 0).toFixed(2)}`, "Attributed new orders"],
  ];

  return (
    <s-page heading="Advocate Referral Program">
      <HubBreadcrumb toPath="/app/campaigns" label="Campaigns & Growth" />
      <s-stack direction="block" gap="large">
        <HubSubNav clusterKey="campaigns" currentPath="/app/referrals" />
        <s-banner tone="info" heading="Give $10, Get $10">
          Turn loyal customers into advocates. Friends receive store credit on their first purchase and advocates receive a reward when that purchase is completed.
        </s-banner>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
          {metrics.map(([label, value, detail]) => <s-box key={label} padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">{label}</s-text><s-heading>{value}</s-heading><s-text tone="neutral" color="subdued">{detail}</s-text></s-stack></s-box>)}
        </s-grid>
        <s-section heading="Top advocates">
          {topAdvocates.length === 0 ? <s-box padding="large" background="subdued" borderRadius="base"><s-text>No completed referrals yet. Share storefront referral links to populate this leaderboard.</s-text></s-box> : <s-table variant="auto"><s-table-header-row><s-table-header>Rank</s-table-header><s-table-header>Advocate</s-table-header><s-table-header>Code</s-table-header><s-table-header>Friends</s-table-header><s-table-header>Total credit</s-table-header></s-table-header-row><s-table-body>{topAdvocates.map((advocate, index) => <s-table-row key={advocate.id}><s-table-cell>{index + 1}</s-table-cell><s-table-cell>{advocate.referrerEmail || "Customer"}</s-table-cell><s-table-cell><s-text type="strong">{advocate.referralCode}</s-text></s-table-cell><s-table-cell>{advocate.claimsCount}</s-table-cell><s-table-cell><s-text tone="success">+${(advocate.claimsCount * advocate.advocateRewardAmount).toFixed(2)}</s-text></s-table-cell></s-table-row>)}</s-table-body></s-table>}
        </s-section>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="base">
          <s-section heading="Program settings"><form onSubmit={saveSettings}><s-stack direction="block" gap="base"><s-checkbox label="Enable customer referral program" checked={referralsEnabled} onChange={(event) => setReferralsEnabled(event.currentTarget.checked)} /><s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base"><s-money-field label="Friend reward" value={friendReward} onChange={(event) => setFriendReward(event.currentTarget.value)} /><s-money-field label="Advocate reward" value={advocateReward} onChange={(event) => setAdvocateReward(event.currentTarget.value)} /></s-grid><s-button type="submit" variant="primary" loading={isSubmitting}>Save incentives</s-button></s-stack></form></s-section>
          <s-section heading="Create advocate referral link"><form onSubmit={createReferral}><s-stack direction="block" gap="base"><s-email-field label="Advocate email address" placeholder="partner@example.com" value={advocateEmail} onChange={(event) => setAdvocateEmail(event.currentTarget.value)} required /><s-button type="submit" variant="primary" loading={isSubmitting}>Generate referral code</s-button></s-stack></form></s-section>
        </s-grid>
        <s-section heading={`Issued referral codes (${referrals.length})`}>
          <s-table variant="auto"><s-table-header-row><s-table-header>Advocate</s-table-header><s-table-header>Code</s-table-header><s-table-header>Shareable URL</s-table-header><s-table-header>Claims</s-table-header><s-table-header>Created</s-table-header></s-table-header-row><s-table-body>{referrals.map((referral) => <s-table-row key={referral.id}><s-table-cell>{referral.referrerEmail || "Customer"}</s-table-cell><s-table-cell><s-text type="strong">{referral.referralCode}</s-text></s-table-cell><s-table-cell>{`https://${shop}?ref=${referral.referralCode}`}</s-table-cell><s-table-cell><s-badge tone={referral.claimsCount > 0 ? "success" : "info"}>{referral.claimsCount} claims</s-badge></s-table-cell><s-table-cell>{new Date(referral.createdAt).toLocaleDateString()}</s-table-cell></s-table-row>)}</s-table-body></s-table>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (headersArgs) => boundary.headers(headersArgs);
