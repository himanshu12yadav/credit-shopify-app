import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav, HubBreadcrumb, SOURCE_TO_ROUTE } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);

  const actionFilter = url.searchParams.get("action") || "ALL";
  const sourceFilter = url.searchParams.get("source") || "ALL";
  const searchQuery = url.searchParams.get("q") || "";

  const where = { shop };

  if (actionFilter !== "ALL") {
    where.action = actionFilter;
  }
  if (sourceFilter !== "ALL") {
    where.source = sourceFilter;
  }
  if (searchQuery) {
    where.OR = [
      { customerEmail: { contains: searchQuery } },
      { customerName: { contains: searchQuery } },
      { note: { contains: searchQuery } },
    ];
  }

  const [ledgerEntries, totalCount, creditAgg, debitAgg] = await Promise.all([
    prisma.creditLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditLedger.count({ where }),
    prisma.creditLedger.aggregate({
      where: { shop, action: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.creditLedger.aggregate({
      where: { shop, action: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);

  const totalCredit = creditAgg._sum?.amount || 0;
  const totalDebit = debitAgg._sum?.amount || 0;

  return {
    shop,
    ledgerEntries,
    totalCount,
    actionFilter,
    sourceFilter,
    searchQuery,
    stats: {
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      activePool: Math.max(0, totalCredit - totalDebit).toFixed(2),
    },
  };
};

export default function LedgerPage() {
  const { ledgerEntries, totalCount, actionFilter, sourceFilter, searchQuery, stats } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const handleFilterChange = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === "ALL" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  return (
    <s-page heading="Store Credit Ledger & Audit Trail">
      <HubBreadcrumb toPath="/app/analytics" label="Reporting" />
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "48px" }}>
        <HubSubNav clusterKey="reporting" currentPath="/app/ledger" />
        {/* Banner */}
        <s-banner tone="info" heading="Immutable Shopify Store Credit Audit Trail">
          <s-paragraph>
            Every transaction is permanently recorded and synced with Shopify Native Store Credit GraphQL mutations. Filter by channel, search customers, and verify balance adjustments.
          </s-paragraph>
        </s-banner>

        {/* Executive Metrics Overview */}
        <s-section heading="Ledger Financial Summary">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">RECORDED TRANSACTIONS</s-text>
                <s-heading>{totalCount}</s-heading>
                <s-badge tone="info">All Ledger Events</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">TOTAL CREDITS ISSUED</s-text>
                <s-heading>${stats.totalCredit}</s-heading>
                <s-badge tone="success">Cumulative Awarded</s-badge>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">TOTAL DEBITS / REDEEMED</s-text>
                <s-heading>${stats.totalDebit}</s-heading>
                <s-text tone="neutral" color="subdued">Used on store orders</s-text>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text tone="neutral" color="subdued">NET OUTSTANDING POOL</s-text>
                <s-heading>${stats.activePool}</s-heading>
                <s-badge tone="success">100% Synced</s-badge>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Unified Search & Filters Section */}
        <s-section padding="none">
          <s-box padding="base">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-heading>Audited Transactions ({totalCount})</s-heading>
                {(actionFilter !== "ALL" || sourceFilter !== "ALL" || searchQuery) && (
                  <s-badge tone="info">Active Filters Applied</s-badge>
                )}
              </s-stack>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector("s-search-field, input");
                  handleFilterChange("q", input?.value);
                }}
                style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}
              >
                {/* Search Bar Row */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%" }}>
                  <s-search-field
                    placeholder="Search by customer email, name, or note..."
                    defaultValue={searchQuery}
                    name="q"
                    style={{ flex: 1 }}
                  />
                  <s-button type="submit">Search</s-button>
                </div>

                {/* Filter Controls Row */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: "240px" }}>
                    <s-select
                      value={actionFilter}
                      onChange={(e) => handleFilterChange("action", e.currentTarget.value)}
                    >
                      <s-option value="ALL">All Actions (Credit & Debit)</s-option>
                      <s-option value="CREDIT">Credits Only (+)</s-option>
                      <s-option value="DEBIT">Debits Only (-)</s-option>
                    </s-select>
                  </div>

                  <div style={{ minWidth: "240px" }}>
                    <s-select
                      value={sourceFilter}
                      onChange={(e) => handleFilterChange("source", e.currentTarget.value)}
                    >
                      <s-option value="ALL">All Sources</s-option>
                      <s-option value="CASHBACK">Order Cashback</s-option>
                      <s-option value="CAMPAIGN">Milestone Drop</s-option>
                      <s-option value="REFERRAL">Referral Bonus</s-option>
                      <s-option value="APPEASEMENT">Support Appeasement</s-option>
                      <s-option value="GIFT_CARD">Digital Gift Card</s-option>
                      <s-option value="REFUND_CREDIT">Return / Refund</s-option>
                      <s-option value="RULE_AWARD">Automation Rule</s-option>
                      <s-option value="MANUAL">Manual Adjustment</s-option>
                      <s-option value="SUBSCRIPTION_REWARD">Subscription Perk</s-option>
                      <s-option value="REVIEW_REWARD">Review Reward</s-option>
                      <s-option value="BIRTHDAY_REWARD">Birthday Reward</s-option>
                      <s-option value="SCRATCH_CARD">Scratch Card</s-option>
                      <s-option value="FLOW_ACTION">Shopify Flow Action</s-option>
                      <s-option value="MIGRATION">CSV Migration</s-option>
                      <s-option value="POS">POS Redemption</s-option>
                    </s-select>
                  </div>

                  {(actionFilter !== "ALL" || sourceFilter !== "ALL" || searchQuery) && (
                    <s-button variant="tertiary" onClick={() => setSearchParams({})}>
                      ✕ Reset Filters
                    </s-button>
                  )}
                </div>
              </form>
            </s-stack>
          </s-box>

          <s-divider />

          {ledgerEntries.length === 0 ? (
            <s-box padding="base">
              <s-paragraph tone="neutral">No ledger entries found matching criteria.</s-paragraph>
            </s-box>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Date & Time</s-table-header>
                <s-table-header>Customer</s-table-header>
                <s-table-header>Amount</s-table-header>
                <s-table-header>Source</s-table-header>
                <s-table-header>Expiry Date</s-table-header>
                <s-table-header>Audit Note / Reason</s-table-header>
                <s-table-header>Shopify Sync</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {ledgerEntries.map((entry) => {
                  const isCredit = entry.action === "CREDIT";
                  const isExpired = entry.expiresAt && new Date() > new Date(entry.expiresAt);

                  return (
                    <s-table-row key={entry.id}>
                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-text>{new Date(entry.createdAt).toLocaleDateString()}</s-text>
                          <s-text tone="neutral" color="subdued">
                            {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </s-text>
                        </s-stack>
                      </s-table-cell>

                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-text><strong>{entry.customerName || "Customer"}</strong></s-text>
                          <s-text tone="neutral" color="subdued">
                            {entry.customerEmail || entry.customerId.replace("gid://shopify/Customer/", "ID: ")}
                          </s-text>
                        </s-stack>
                      </s-table-cell>

                      <s-table-cell>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: isCredit ? "#15803d" : "#0f172a" }}>
                          {isCredit ? "+" : "-"}${Math.abs(entry.amount).toFixed(2)} {entry.currency}
                        </span>
                      </s-table-cell>

                      <s-table-cell>
                        <s-badge
                          tone={
                            entry.source === "CASHBACK"
                              ? "success"
                              : entry.source === "CAMPAIGN"
                              ? "info"
                              : entry.source === "APPEASEMENT"
                              ? "warning"
                              : entry.source === "GIFT_CARD"
                              ? "info"
                              : entry.source === "REFERRAL"
                              ? "success"
                              : entry.source === "REFUND_CREDIT"
                              ? "attention"
                              : "neutral"
                          }
                          {...(SOURCE_TO_ROUTE[entry.source]
                            ? { onClick: () => navigate(SOURCE_TO_ROUTE[entry.source]) }
                            : {})}
                        >
                          {entry.source}
                        </s-badge>
                      </s-table-cell>

                      <s-table-cell>
                        {entry.expiresAt ? (
                          <s-stack direction="block" gap="none">
                            <s-text>{new Date(entry.expiresAt).toLocaleDateString()}</s-text>
                            {isExpired && <s-badge tone="critical">EXPIRED</s-badge>}
                          </s-stack>
                        ) : (
                          <s-text tone="neutral" color="subdued">Never</s-text>
                        )}
                      </s-table-cell>

                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-text>{entry.note || "—"}</s-text>
                          {entry.orderId && (
                            <s-text tone="neutral" color="subdued">
                              Order: {entry.orderId.replace("gid://shopify/Order/", "#")}
                            </s-text>
                          )}
                        </s-stack>
                      </s-table-cell>

                      <s-table-cell>
                        <s-badge tone={entry.status === "COMPLETED" ? "success" : "critical"}>
                          {entry.status}
                        </s-badge>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      </div>
    </s-page>
  );
}
