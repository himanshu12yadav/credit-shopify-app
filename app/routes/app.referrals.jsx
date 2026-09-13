import { useState } from "react";
import { useLoaderData, useFetcher, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [settings, allReferrals, totalClaims, topAdvocates] = await Promise.all([
    prisma.creditSettings.findUnique({ where: { shop } }),
    prisma.referral.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.referral.aggregate({
      where: { shop },
      _sum: { claimsCount: true },
    }),
    prisma.referral.findMany({
      where: { shop, claimsCount: { gt: 0 } },
      orderBy: { claimsCount: "desc" },
      take: 10,
    }),
  ]);

  const totalClaimsCount = totalClaims._sum.claimsCount || 0;
  const advocateReward = 10.0;
  const friendReward = 10.0;
  const totalRevenueGenerated = totalClaimsCount * 65.0; // Estimated $65 AOV

  return {
    shop,
    settings: settings || { referralsEnabled: true },
    referrals: allReferrals,
    topAdvocates,
    stats: {
      totalAdvocates: allReferrals.length,
      totalClaimsCount,
      totalRewardsPaid: totalClaimsCount * advocateReward,
      totalRevenueGenerated,
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
    await prisma.creditSettings.upsert({
      where: { shop },
      create: { shop, referralsEnabled },
      update: { referralsEnabled },
    });
    return { success: true, message: "Referral settings saved" };
  }

  if (intent === "create_referral") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const advocateReward = parseFloat(formData.get("advocateReward") || "10.0");
    const friendReward = parseFloat(formData.get("friendReward") || "10.0");

    if (!email) {
      return { success: false, error: "Advocate email required" };
    }

    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await prisma.referral.create({
      data: {
        shop,
        referrerCustomerId: `gid://shopify/Customer/advocate_${Date.now()}`,
        referrerEmail: email,
        referralCode: code,
        advocateRewardAmount: advocateReward,
        friendRewardAmount: friendReward,
        claimsCount: 0,
      },
    });

    return { success: true, message: `Created referral code ${code} for ${email}` };
  }

  return { success: false };
};

export default function ReferralsPage() {
  const { settings, referrals = [], topAdvocates = [], stats = {}, shop = "" } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [referralsEnabled, setReferralsEnabled] = useState(Boolean(settings?.referralsEnabled));
  const [friendReward, setFriendReward] = useState("10.00");
  const [advocateReward, setAdvocateReward] = useState("10.00");
  const [advocateEmail, setAdvocateEmail] = useState("");

  const totalAdvocates = stats.totalAdvocates || referrals.length || 0;
  const totalClaimsCount = stats.totalClaimsCount || 0;
  const totalRewardsPaid = stats.totalRewardsPaid || 0;
  const totalRevenueGenerated = stats.totalRevenueGenerated || 0;

  const handleSaveSettings = (e) => {
    e.preventDefault();
    fetcher.submit(
      { intent: "save_settings", referralsEnabled: String(referralsEnabled) },
      { method: "POST" }
    );
    shopify.toast.show("Referral program settings updated!");
  };

  const handleCreateReferral = (e) => {
    e.preventDefault();
    if (!advocateEmail.trim()) {
      shopify.toast.show("Please enter customer email");
      return;
    }
    fetcher.submit(
      {
        intent: "create_referral",
        email: advocateEmail,
        advocateReward,
        friendReward,
      },
      { method: "POST" }
    );
    shopify.toast.show("New referral code created!");
    setAdvocateEmail("");
  };

  return (
    <s-page heading="Advocate Referral Program">
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 0 28px 0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        {/* Subtitle banner */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
            <strong>Give $10, Get $10:</strong> Turn your loyal customers into brand advocates. Friends get an instant store credit discount on their first purchase, and advocates receive bonus store credit.
          </p>
        </div>

      {/* KPI Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active Advocates
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            {totalAdvocates}
          </div>
          <div style={{ fontSize: 11, color: "#4f46e5", marginTop: 2, fontWeight: 600 }}>
            Registered referrers
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Successful Referrals
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
            {totalClaimsCount}
          </div>
          <div style={{ fontSize: 11, color: "#166534", marginTop: 2, fontWeight: 600 }}>
            New customers acquired
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Rewards Disbursed
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>
            ${totalRewardsPaid.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#1e40af", marginTop: 2, fontWeight: 600 }}>
            Native store credit awarded
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Est. Referral Revenue
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            ${totalRevenueGenerated.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#059669", marginTop: 2, fontWeight: 600 }}>
            Attributed new orders
          </div>
        </div>
      </div>

      {/* Top Advocates Leaderboard */}
      <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              🏆 Top Advocates Leaderboard
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Ranked by successfully completed friend purchases and total store credit earned.
            </div>
          </div>
        </div>

        {topAdvocates.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            No completed referrals yet. Share your storefront referral links to see advocates rank here!
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", width: 60 }}>Rank</th>
                <th style={{ padding: "10px 14px" }}>Advocate Email</th>
                <th style={{ padding: "10px 14px" }}>Referral Code</th>
                <th style={{ padding: "10px 14px" }}>Friends Referred</th>
                <th style={{ padding: "10px 14px" }}>Total Credit Earned</th>
              </tr>
            </thead>
            <tbody>
              {topAdvocates.map((adv, idx) => (
                <tr key={adv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 14 }}>
                    {idx === 0 ? "🥇 1st" : idx === 1 ? "🥈 2nd" : idx === 2 ? "🥉 3rd" : `#${idx + 1}`}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>
                    {adv.referrerEmail || "Customer"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <code style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: 4, color: "#4f46e5", fontWeight: 700 }}>
                      {adv.referralCode}
                    </code>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#16a34a" }}>
                    {adv.claimsCount} friends
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 800, color: "#059669" }}>
                    +${(adv.claimsCount * adv.advocateRewardAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Program Config & Referral Code Generator */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Incentives Form */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            ⚙️ Dual-Sided Incentives Configuration
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px 0" }}>
            Adjust the dual-sided store credit reward amounts granted to the friend and the advocate.
          </p>

          <form onSubmit={handleSaveSettings}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={referralsEnabled}
                onChange={(e) => setReferralsEnabled(e.target.checked)}
              />
              Enable Customer Referral Program
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                  Friend Reward ($):
                </label>
                <input
                  type="number"
                  step="1"
                  value={friendReward}
                  onChange={(e) => setFriendReward(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                  Advocate Bonus ($):
                </label>
                <input
                  type="number"
                  step="1"
                  value={advocateReward}
                  onChange={(e) => setAdvocateReward(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{ padding: "9px 16px", borderRadius: 8, background: "#4f46e5", color: "#ffffff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
            >
              Save Incentives
            </button>
          </form>
        </div>

        {/* Generate Custom Code */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            ➕ Create Advocate Referral Link
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px 0" }}>
            Generate a custom referral link for an influencer or VIP advocate manually.
          </p>

          <form onSubmit={handleCreateReferral}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                Advocate Email Address:
              </label>
              <input
                type="email"
                placeholder="e.g. partner@example.com"
                value={advocateEmail}
                onChange={(e) => setAdvocateEmail(e.target.value)}
                required
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>

            <button
              type="submit"
              style={{ padding: "9px 16px", borderRadius: 8, background: "#0f172a", color: "#ffffff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
            >
              Generate Referral Code
            </button>
          </form>
        </div>
      </div>

      {/* Active Referral Links List */}
      <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
          Issued Referral Codes ({referrals.length})
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Advocate Email</th>
              <th style={{ padding: "8px 12px" }}>Code</th>
              <th style={{ padding: "8px 12px" }}>Shareable URL</th>
              <th style={{ padding: "8px 12px" }}>Claims</th>
              <th style={{ padding: "8px 12px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.referrerEmail || "Customer"}</td>
                <td style={{ padding: "8px 12px" }}>
                  <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#4f46e5", fontWeight: 700 }}>
                    {r.referralCode}
                  </code>
                </td>
                <td style={{ padding: "8px 12px", color: "#64748b", fontFamily: "monospace" }}>
                  https://{shop}?ref={r.referralCode}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700, background: r.claimsCount > 0 ? "#dcfce7" : "#f1f5f9", color: r.claimsCount > 0 ? "#166534" : "#64748b" }}>
                    {r.claimsCount} claims
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "#94a3b8" }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
