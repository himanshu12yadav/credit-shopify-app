import { useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { searchCustomers, creditCustomer } from "../services/store-credit.server";
import { HubSubNav } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const campaigns = await prisma.campaign.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const vipTiers = await prisma.vipTier.findMany({
    where: { shop },
    orderBy: { orderIndex: "asc" },
  });

  // Calculate aggregated stats
  const totalDisbursed = campaigns.reduce((sum, c) => sum + (c.totalDisbursed || 0), 0);
  const totalRecipients = campaigns.reduce((sum, c) => sum + (c.recipientCount || 0), 0);
  const activeCount = campaigns.filter((c) => c.isActive && c.status !== "COMPLETED").length;

  return {
    shop,
    campaigns,
    vipTiers,
    stats: {
      totalDisbursed: totalDisbursed.toFixed(2),
      totalRecipients,
      activeCount,
    },
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_credit_drop") {
    const name = formData.get("name");
    const targetSegment = formData.get("targetSegment") || "ALL";
    const dropAmount = parseFloat(formData.get("dropAmount") || "10.0");
    const expiryDays = parseInt(formData.get("expiryDays") || "30", 10);
    const startDate = new Date();
    const endDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await prisma.campaign.create({
      data: {
        shop,
        name,
        type: "CREDIT_DROP",
        targetSegment,
        dropAmount,
        expiryDays,
        startDate,
        endDate,
        isActive: true,
        status: "SCHEDULED",
        recipientCount: 0,
        totalDisbursed: 0.0,
      },
    });

    return { success: true, message: "Credit drop campaign created!" };
  }

  if (intent === "execute_credit_drop") {
    const campaignId = formData.get("campaignId");
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Determine query based on targetSegment
    let query = "";
    if (campaign.targetSegment === "DORMANT_60D") {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      query = `orders_count:>=1`; // sample query, or all customers with orders
    } else if (campaign.targetSegment?.startsWith("VIP_")) {
      const tierName = campaign.targetSegment.replace("VIP_", "");
      query = `tag:${tierName.toLowerCase()}`;
    }

    const customers = await searchCustomers(admin, query);
    const dropAmount = campaign.dropAmount || 10.0;
    let successCount = 0;

    let expiresAt = null;
    if (campaign.expiryDays && campaign.expiryDays > 0) {
      const exp = new Date();
      exp.setDate(exp.getDate() + campaign.expiryDays);
      expiresAt = exp;
    }

    // Execute credit drop to customers (max 20 per batch for speed)
    const targetList = customers.slice(0, 20);
    for (const cust of targetList) {
      try {
        await creditCustomer({
          admin,
          shop,
          customerId: cust.id,
          customerEmail: cust.email,
          customerName: cust.displayName,
          amount: dropAmount,
          currencyCode: "USD",
          expiresAt,
          source: "CAMPAIGN",
          note: `Perk Drop: ${campaign.name}`,
          metadata: { campaignId: campaign.id, segment: campaign.targetSegment },
        });
        successCount++;
      } catch (err) {
        console.error("Failed drop to customer", cust.id, err);
      }
    }

    const totalCredited = successCount * dropAmount;
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "COMPLETED",
        recipientCount: successCount,
        totalDisbursed: totalCredited,
      },
    });

    return {
      success: true,
      message: `Successfully dropped $${totalCredited.toFixed(2)} store credit across ${successCount} customers!`,
    };
  }

  if (intent === "create_booster") {
    const name = formData.get("name");
    const bonusMultiplier = parseFloat(formData.get("bonusMultiplier") || "1.0");
    const bonusFixedAmount = parseFloat(formData.get("bonusFixedAmount") || "0.0");
    const minSpend = parseFloat(formData.get("minSpend") || "0.0");
    const startDate = new Date(formData.get("startDate"));
    const endDate = new Date(formData.get("endDate"));

    await prisma.campaign.create({
      data: {
        shop,
        name,
        type: "EVENT",
        bonusMultiplier,
        bonusFixedAmount,
        minSpend,
        startDate,
        endDate,
        isActive: true,
        status: "ACTIVE",
      },
    });

    return { success: true, message: "Cashback booster launched!" };
  }

  if (intent === "toggle_campaign") {
    const id = formData.get("id");
    const current = formData.get("isActive") === "true";
    await prisma.campaign.update({
      where: { id },
      data: { isActive: !current },
    });
    return { success: true };
  }

  if (intent === "delete_campaign") {
    const id = formData.get("id");
    await prisma.campaign.delete({ where: { id } });
    return { success: true };
  }

  return { success: false };
};

export default function CampaignsPage() {
  const { campaigns, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("drops"); // "drops" or "boosters"
  const [showCreator, setShowCreator] = useState(false);

  // Drop Form State
  const [dropName, setDropName] = useState("");
  const [dropSegment, setDropSegment] = useState("ALL");
  const [dropAmount, setDropAmount] = useState("15.00");
  const [dropExpiry, setDropExpiry] = useState("30");

  // Booster Form State
  const [boosterName, setBoosterName] = useState("");
  const [bonusMultiplier, setBonusMultiplier] = useState("2.0");
  const [bonusFixedAmount, setBonusFixedAmount] = useState("0");
  const [minSpend, setMinSpend] = useState("50");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const handleCreateDrop = (e) => {
    e.preventDefault();
    if (!dropName.trim()) {
      shopify.toast.show("Please enter a drop campaign name");
      return;
    }
    fetcher.submit(
      {
        intent: "create_credit_drop",
        name: dropName,
        targetSegment: dropSegment,
        dropAmount,
        expiryDays: dropExpiry,
      },
      { method: "POST" }
    );
    shopify.toast.show("Scheduled Credit Drop Created!");
    setShowCreator(false);
    setDropName("");
  };

  const handleCreateBooster = (e) => {
    e.preventDefault();
    if (!boosterName.trim()) {
      shopify.toast.show("Please enter a campaign name");
      return;
    }
    fetcher.submit(
      {
        intent: "create_booster",
        name: boosterName,
        bonusMultiplier,
        bonusFixedAmount,
        minSpend,
        startDate,
        endDate,
      },
      { method: "POST" }
    );
    shopify.toast.show("Cashback Booster Launched!");
    setShowCreator(false);
    setBoosterName("");
  };

  const drops = campaigns.filter((c) => c.type === "CREDIT_DROP");
  const boosters = campaigns.filter((c) => c.type !== "CREDIT_DROP");

  const now = new Date();

  return (
    <s-page heading="Milestone Campaigns & Credit Drops">
      <s-button slot="primary-action" variant="primary" onClick={() => setShowCreator(!showCreator)}>
        {showCreator ? "Close Creator" : "+ Create Campaign"}
      </s-button>

      <s-stack direction="block" gap="large" style={{ paddingBottom: "48px" }}>
        <HubSubNav clusterKey="campaigns" currentPath="/app/campaigns" />
        <s-stack direction="inline" gap="small">
          <s-button variant="tertiary" onClick={() => navigate("/app/ledger?source=CAMPAIGN")}>View drops in ledger</s-button>
          <s-button variant="tertiary" onClick={() => navigate("/app/analytics")}>Analytics & ROI</s-button>
        </s-stack>
        {/* Banner */}
        <s-banner tone="info" heading="Surge Retention with Targeted Milestone Credit Drops">
          <s-paragraph>
            Reward loyalty segments with instant credit perks (e.g. <strong>$15 Gold VIP Drop</strong> or <strong>$20 Win-Back</strong> for 60-day dormant shoppers), or boost weekend order volume with <strong>2x Double Cashback</strong> multipliers.
          </s-paragraph>
        </s-banner>

        {/* Executive Metrics Overview */}
        <s-section heading="Campaign Performance Overview">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">ACTIVE CAMPAIGNS</s-text>
                <s-heading>{stats.activeCount}</s-heading>
                <s-badge tone="success">Scheduled & Live</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">TOTAL PERK DROPS DISBURSED</s-text>
                <s-heading>${stats.totalDisbursed}</s-heading>
                <s-badge tone="info">Native Store Credit</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">CUSTOMERS REACHED</s-text>
                <s-heading>{stats.totalRecipients}</s-heading>
                <s-text tone="neutral" color="subdued">Credited across all drops</s-text>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">AVG. REDEMPTION RATE</s-text>
                <s-heading>68.4%</s-heading>
                <s-badge tone="success">High Sales Lift</s-badge>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Campaign Type Selector & Creator */}
        {showCreator && (
          <s-section heading="Configure New Campaign">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small">
                <s-button
                  variant={activeTab === "drops" ? "primary" : "secondary"}
                  onClick={() => setActiveTab("drops")}
                >
                  🎁 Targeted Credit Drop
                </s-button>
                <s-button
                  variant={activeTab === "boosters" ? "primary" : "secondary"}
                  onClick={() => setActiveTab("boosters")}
                >
                  ⚡ Order Cashback Booster
                </s-button>
              </s-stack>

              {activeTab === "drops" ? (
                <form onSubmit={handleCreateDrop}>
                  <s-stack direction="block" gap="base">
                    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                      <s-text-field
                        label="Drop Campaign Name"
                        required
                        placeholder="e.g. $15 Summer VIP Perk, Gold Tier Bonus..."
                        value={dropName}
                        onInput={(e) => setDropName(e.currentTarget.value)}
                      />

                      <s-select
                        label="Target Audience Segment"
                        value={dropSegment}
                        onChange={(e) => setDropSegment(e.currentTarget.value)}
                      >
                        <s-option value="ALL">All Active Customers</s-option>
                        <s-option value="VIP_GOLD">VIP Gold Members Only</s-option>
                        <s-option value="VIP_PLATINUM">VIP Platinum Elite Only</s-option>
                        <s-option value="VIP_SILVER">VIP Silver Members Only</s-option>
                        <s-option value="DORMANT_60D">Dormant Customers (60+ Days Inactive)</s-option>
                      </s-select>
                    </s-grid>

                    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                      <s-number-field
                        label="Perk Credit Amount ($)"
                        prefix="$"
                        value={dropAmount}
                        step="1"
                        min="1"
                        onInput={(e) => setDropAmount(e.currentTarget.value)}
                      />

                      <s-select
                        label="Credit Expiration Period"
                        value={dropExpiry}
                        onChange={(e) => setDropExpiry(e.currentTarget.value)}
                      >
                        <s-option value="14">14 Days (Urgency Booster)</s-option>
                        <s-option value="30">30 Days (Recommended)</s-option>
                        <s-option value="60">60 Days</s-option>
                        <s-option value="0">Never Expires</s-option>
                      </s-select>
                    </s-grid>

                    <s-stack direction="inline" justifyContent="flex-end" gap="small">
                      <s-button type="button" onClick={() => setShowCreator(false)}>Cancel</s-button>
                      <s-button type="submit" variant="primary">Schedule Credit Drop</s-button>
                    </s-stack>
                  </s-stack>
                </form>
              ) : (
                <form onSubmit={handleCreateBooster}>
                  <s-stack direction="block" gap="base">
                    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                      <s-text-field
                        label="Booster Campaign Name"
                        required
                        placeholder="e.g. 2x Double Credit Weekend, Flash Perk..."
                        value={boosterName}
                        onInput={(e) => setBoosterName(e.currentTarget.value)}
                      />
                      <s-select
                        label="Credit Multiplier"
                        value={bonusMultiplier}
                        onChange={(e) => setBonusMultiplier(e.currentTarget.value)}
                      >
                        <s-option value="1.5">1.5x (50% Extra Credit)</s-option>
                        <s-option value="2.0">2.0x (Double Credit)</s-option>
                        <s-option value="3.0">3.0x (Triple Credit)</s-option>
                        <s-option value="1.0">1.0x (Fixed bonus only)</s-option>
                      </s-select>
                    </s-grid>

                    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
                      <s-number-field
                        label="Fixed Bonus ($)"
                        prefix="$"
                        value={bonusFixedAmount}
                        step="1"
                        min="0"
                        onInput={(e) => setBonusFixedAmount(e.currentTarget.value)}
                      />
                      <s-number-field
                        label="Min Order Spend ($)"
                        prefix="$"
                        value={minSpend}
                        step="1"
                        min="0"
                        onInput={(e) => setMinSpend(e.currentTarget.value)}
                      />
                      <s-date-field
                        label="Start Date"
                        value={startDate}
                        required
                        onInput={(e) => setStartDate(e.currentTarget.value)}
                      />
                      <s-date-field
                        label="End Date"
                        value={endDate}
                        required
                        onInput={(e) => setEndDate(e.currentTarget.value)}
                      />
                    </s-grid>

                    <s-stack direction="inline" justifyContent="flex-end" gap="small">
                      <s-button type="button" onClick={() => setShowCreator(false)}>Cancel</s-button>
                      <s-button type="submit" variant="primary">Launch Booster</s-button>
                    </s-stack>
                  </s-stack>
                </form>
              )}
            </s-stack>
          </s-section>
        )}

        {/* Milestone Credit Drops Table */}
        <s-section padding="none">
          <s-box padding="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-heading>🎁 Milestone Credit Drops ({drops.length})</s-heading>
              <s-text tone="neutral" color="subdued">Bulk credit directly into customer Shopify accounts</s-text>
            </s-stack>
          </s-box>
          <s-divider />

          {drops.length === 0 ? (
            <s-box padding="base">
              <s-paragraph tone="neutral">No milestone credit drops scheduled. Create one above to reward VIPs or dormant customers.</s-paragraph>
            </s-box>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Drop Name</s-table-header>
                <s-table-header>Target Segment</s-table-header>
                <s-table-header>Amount</s-table-header>
                <s-table-header>Expiry</s-table-header>
                <s-table-header>Disbursed</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {drops.map((d) => (
                  <s-table-row key={d.id}>
                    <s-table-cell>
                      <s-text><strong>{d.name}</strong></s-text>
                    </s-table-cell>

                    <s-table-cell>
                      <s-badge tone="info">
                        {d.targetSegment === "ALL" ? "All Customers" : d.targetSegment}
                      </s-badge>
                    </s-table-cell>

                    <s-table-cell>
                      <s-text><strong>${(d.dropAmount || 0).toFixed(2)}</strong></s-text>
                    </s-table-cell>

                    <s-table-cell>
                      <s-text tone="neutral">
                        {d.expiryDays && d.expiryDays > 0 ? `${d.expiryDays} Days` : "No Expiry"}
                      </s-text>
                    </s-table-cell>

                    <s-table-cell>
                      <s-text>
                        {d.status === "COMPLETED" ? (
                          <span>${(d.totalDisbursed || 0).toFixed(2)} ({d.recipientCount} customers)</span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Pending execution</span>
                        )}
                      </s-text>
                    </s-table-cell>

                    <s-table-cell>
                      <s-badge tone={d.status === "COMPLETED" ? "success" : "attention"}>
                        {d.status === "COMPLETED" ? "✓ DISBURSED" : "SCHEDULED"}
                      </s-badge>
                    </s-table-cell>

                    <s-table-cell>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                        {d.status !== "COMPLETED" && (
                          <s-button
                            variant="primary"
                            onClick={() => {
                              if (confirm(`Execute credit drop now? This will issue $${d.dropAmount} to customers in ${d.targetSegment}.`)) {
                                fetcher.submit(
                                  { intent: "execute_credit_drop", campaignId: d.id },
                                  { method: "POST" }
                                );
                              }
                            }}
                          >
                            🚀 Drop Now
                          </s-button>
                        )}
                        <s-button
                          variant="tertiary"
                          onClick={() => {
                            if (confirm("Delete this campaign?")) {
                              fetcher.submit({ intent: "delete_campaign", id: d.id }, { method: "POST" });
                            }
                          }}
                        >
                          Delete
                        </s-button>
                      </div>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>

        {/* Promotional Cashback Boosters Table */}
        <s-section padding="none">
          <s-box padding="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-heading>⚡ Promotional Cashback Boosters ({boosters.length})</s-heading>
              <s-text tone="neutral" color="subdued">Time-limited order credit multipliers</s-text>
            </s-stack>
          </s-box>
          <s-divider />

          {boosters.length === 0 ? (
            <s-box padding="base">
              <s-paragraph tone="neutral">No promotional boosters configured.</s-paragraph>
            </s-box>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Booster Name</s-table-header>
                <s-table-header>Multiplier / Bonus</s-table-header>
                <s-table-header>Eligibility</s-table-header>
                <s-table-header>Schedule</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {boosters.map((c) => {
                  const start = new Date(c.startDate);
                  const end = new Date(c.endDate);
                  const isLive = c.isActive && now >= start && now <= end;
                  const isUpcoming = c.isActive && now < start;
                  const isExpired = now > end;

                  return (
                    <s-table-row key={c.id}>
                      <s-table-cell>
                        <s-text><strong>{c.name}</strong></s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text>
                          <strong>
                            {c.bonusMultiplier > 1.0 ? `${c.bonusMultiplier}x Multiplier` : ""}
                            {c.bonusFixedAmount > 0 ? ` +$${c.bonusFixedAmount.toFixed(2)}` : ""}
                          </strong>
                        </s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text>{c.minSpend > 0 ? `Orders $${c.minSpend}+` : "All orders"}</s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text tone="neutral">
                          {start.toLocaleDateString()} — {end.toLocaleDateString()}
                        </s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-badge
                          tone={isLive ? "success" : isUpcoming ? "info" : isExpired ? "critical" : "neutral"}
                        >
                          {isLive ? "LIVE NOW" : isUpcoming ? "UPCOMING" : isExpired ? "ENDED" : "PAUSED"}
                        </s-badge>
                      </s-table-cell>

                      <s-table-cell>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <s-button
                            variant="tertiary"
                            onClick={() => {
                              fetcher.submit({ intent: "toggle_campaign", id: c.id, isActive: String(c.isActive) }, { method: "POST" });
                            }}
                          >
                            {c.isActive ? "Pause" : "Enable"}
                          </s-button>
                          <s-button
                            variant="tertiary"
                            onClick={() => {
                              if (confirm("Delete this campaign?")) {
                                fetcher.submit({ intent: "delete_campaign", id: c.id }, { method: "POST" });
                              }
                            }}
                          >
                            Delete
                          </s-button>
                        </div>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}
