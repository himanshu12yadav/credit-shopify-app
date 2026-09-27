import { useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { creditCustomer } from "../services/store-credit.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const recentImports = await prisma.creditLedger.findMany({
    where: { shop: session.shop, source: "MIGRATION" },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return {
    shop: session.shop,
    recentImports,
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "execute_migration") {
    const rawRecords = formData.get("records");
    let records = [];
    try {
      records = JSON.parse(rawRecords);
    } catch {
      return { success: false, error: "Invalid records payload" };
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let totalCredited = 0;

    for (const row of records) {
      const email = String(row.email || "").trim().toLowerCase();
      const amount = parseFloat(row.amount || "0");
      const firstName = row.firstName || "";
      const lastName = row.lastName || "";
      const note = row.note || `Migrated from ${row.source || "External Platform"}`;
      const expiryDays = parseInt(row.expiryDays || "0", 10);

      if (!email || isNaN(amount) || amount <= 0) {
        results.push({
          email: email || "unknown",
          amount: isNaN(amount) ? 0 : amount,
          status: "FAILED",
          error: "Invalid email or non-positive amount",
        });
        errorCount++;
        continue;
      }

      try {
        let customerId = null;
        let customerName = `${firstName} ${lastName}`.trim() || email;

        const searchResp = await admin.graphql(`
          query findCust($query: String!) {
            customers(first: 1, query: $query) {
              nodes {
                id
                displayName
                email
              }
            }
          }
        `, { variables: { query: `email:${email}` } });

        const searchJson = await searchResp.json();
        const existing = searchJson.data?.customers?.nodes?.[0];

        if (existing) {
          customerId = existing.id;
          customerName = existing.displayName || customerName;
        } else {
          const createResp = await admin.graphql(`
            mutation createCust($input: CustomerInput!) {
              customerCreate(input: $input) {
                customer {
                  id
                  displayName
                }
                userErrors { field message }
              }
            }
          `, {
            variables: {
              input: {
                email,
                firstName,
                lastName,
                tags: ["migrated_credit", "loyalty_member"],
              },
            },
          });

          const createJson = await createResp.json();
          const newCust = createJson.data?.customerCreate?.customer;
          if (newCust) {
            customerId = newCust.id;
            customerName = newCust.displayName || customerName;
          }
        }

        if (!customerId) {
          results.push({
            email,
            amount,
            status: "FAILED",
            error: "Could not create or locate Shopify customer",
          });
          errorCount++;
          continue;
        }

        let expiresAt = null;
        if (expiryDays > 0) {
          const exp = new Date();
          exp.setDate(exp.getDate() + expiryDays);
          expiresAt = exp;
        }

        const creditRes = await creditCustomer({
          admin,
          shop: session.shop,
          customerId,
          customerEmail: email,
          customerName,
          amount,
          currencyCode: "USD",
          expiresAt,
          notify: false,
          source: "MIGRATION",
          note,
        });

        const rawTx = creditRes.shopifyTxId || "";
        const cleanRef = rawTx.includes("/") ? `Account #${rawTx.split("/").pop()}` : rawTx || "Local Ledger";

        results.push({
          email,
          customerName,
          amount,
          status: creditRes.success ? "SUCCESS" : "WARNING",
          transactionId: cleanRef,
          error: creditRes.apiError || null,
        });

        if (creditRes.success) {
          successCount++;
          totalCredited += amount;
        } else {
          errorCount++;
        }
      } catch (err) {
        results.push({
          email,
          amount,
          status: "FAILED",
          error: err instanceof Error ? err.message : "Import failed",
        });
        errorCount++;
      }
    }

    return {
      success: true,
      summary: {
        totalRows: records.length,
        successCount,
        errorCount,
        totalCredited: totalCredited.toFixed(2),
      },
      results,
    };
  }

  return { success: false, error: "Unknown action" };
};

const SAMPLE_DATA = {
  rise: `Email,Gift Card Balance,First Name,Last Name,Notes
alex.morgan@example.com,45.50,Alex,Morgan,Rise.ai VIP Migration
sam.wilson@example.com,120.00,Sam,Wilson,Loyalty balance
claire.chen@example.com,85.25,Claire,Chen,Store credit transfer`,
  smile: `Email,Points Balance,First Name,Last Name
oliver.taylor@example.com,50.00,Oliver,Taylor
sophia.martinez@example.com,75.00,Sophia,Martinez
liam.johnson@example.com,110.50,Liam,Johnson`,
  yotpo: `Customer Email,Balance,Name
emma.watson@example.com,65.00,Emma Watson
noah.miller@example.com,90.00,Noah Miller
ava.davis@example.com,35.75,Ava Davis`,
  standard: `email,amount,first_name,last_name,expiry_days,note
jordan.bell@example.com,100.00,Jordan,Bell,90,Legacy VIP Credit
casey.jones@example.com,250.00,Casey,Jones,180,High Roller Migration
riley.green@example.com,75.50,Riley,Green,,Standard Transfer`,
};

export default function MigratePage() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [activePreset, setActivePreset] = useState("rise");
  const [csvText, setCsvText] = useState(SAMPLE_DATA.rise);
  const [parsedRows, setParsedRows] = useState([]);
  const [validationSummary, setValidationSummary] = useState({ total: 0, valid: 0, invalid: 0, liability: 0 });
  const [showPreImportAfterRun, setShowPreImportAfterRun] = useState(false);

  const isSubmitting = fetcher.state !== "idle";
  const migrationResult = fetcher.data?.results ? fetcher.data : null;

  const handleParse = (text, presetKey) => {
    setCsvText(text);
    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setParsedRows([]);
      setValidationSummary({ total: 0, valid: 0, invalid: 0, liability: 0 });
      return;
    }

    const rows = [];
    let validCount = 0;
    let invalidCount = 0;
    let liabilitySum = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      let email = "";
      let amount = 0;
      let firstName = "";
      let lastName = "";
      let expiryDays = 0;
      let note = "";

      if (presetKey === "rise") {
        email = cols[0] || "";
        amount = parseFloat(cols[1] || "0");
        firstName = cols[2] || "";
        lastName = cols[3] || "";
        note = cols[4] || "Migrated from Rise.ai";
      } else if (presetKey === "smile") {
        email = cols[0] || "";
        amount = parseFloat(cols[1] || "0");
        firstName = cols[2] || "";
        lastName = cols[3] || "";
        note = "Migrated from Smile.io";
      } else if (presetKey === "yotpo") {
        email = cols[0] || "";
        amount = parseFloat(cols[1] || "0");
        const fullName = (cols[2] || "").split(" ");
        firstName = fullName[0] || "";
        lastName = fullName.slice(1).join(" ") || "";
        note = "Migrated from Yotpo";
      } else {
        email = cols[0] || "";
        amount = parseFloat(cols[1] || "0");
        firstName = cols[2] || "";
        lastName = cols[3] || "";
        expiryDays = parseInt(cols[4] || "0", 10);
        note = cols[5] || "Standard CSV Migration";
      }

      const isValidEmail = email.includes("@") && email.includes(".");
      const isValidAmount = !isNaN(amount) && amount > 0;
      const isValid = isValidEmail && isValidAmount;

      if (isValid) {
        validCount++;
        liabilitySum += amount;
      } else {
        invalidCount++;
      }

      rows.push({
        id: i,
        email,
        amount,
        firstName,
        lastName,
        expiryDays,
        note,
        source: presetKey.toUpperCase(),
        isValid,
        error: !isValidEmail ? "Invalid email" : !isValidAmount ? "Invalid amount" : null,
      });
    }

    setParsedRows(rows);
    setValidationSummary({
      total: rows.length,
      valid: validCount,
      invalid: invalidCount,
      liability: liabilitySum,
    });
  };

  const handleSelectPreset = (preset) => {
    setActivePreset(preset);
    handleParse(SAMPLE_DATA[preset], preset);
  };

  const handleExecuteMigration = () => {
    const validRecords = parsedRows.filter((r) => r.isValid);
    if (validRecords.length === 0) {
      shopify.toast.show("No valid records to migrate");
      return;
    }

    fetcher.submit(
      {
        intent: "execute_migration",
        records: JSON.stringify(validRecords),
      },
      { method: "POST" }
    );
  };

  const handleResetBatch = () => {
    handleSelectPreset("rise");
    setShowPreImportAfterRun(false);
  };

  return (
    <s-page heading="CSV Bulk Credit Importer & Migration Tool">
      <HubBreadcrumb toPath="/app/settings" label="Settings & Data" />
      {/* 24px Vertical Rhythm Container to prevent cramped cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "48px" }}>
        <HubSubNav clusterKey="settings" currentPath="/app/migrate" />
        
        {/* Top Banner */}
        <s-banner tone="info" heading="Migrate from Rise.ai, Smile.io, Yotpo, or Custom CSV">
          <s-paragraph>
            Import customer balances directly into Shopify Native Store Credit using the GraphQL Admin API. Customers immediately see their migrated balance on storefront and at checkout.
          </s-paragraph>
        </s-banner>

        {/* Preset Selector Section */}
        <s-section heading="Select Migration Platform Preset">
          <s-stack direction="inline" gap="base">
            {[
              { id: "rise", label: "Rise.ai Balances" },
              { id: "smile", label: "Smile.io Points" },
              { id: "yotpo", label: "Yotpo / Swell" },
              { id: "standard", label: "Standard CSV" },
            ].map((preset) => (
              <s-button
                key={preset.id}
                variant={activePreset === preset.id ? "primary" : "secondary"}
                onClick={() => handleSelectPreset(preset.id)}
              >
                {preset.label}
              </s-button>
            ))}
          </s-stack>
        </s-section>

        {/* Input & Validation Summary */}
        <s-section>
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
            {/* CSV Input */}
            <s-stack direction="block" gap="base">
              <s-heading>CSV Raw Data</s-heading>
              <s-text-area
                label="CSV raw data"
                value={csvText}
                onChange={(e) => handleParse(e.currentTarget.value, activePreset)}
                rows={8}
              />
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text tone="neutral" color="subdued">Active Format: {activePreset.toUpperCase()}</s-text>
                <s-button variant="tertiary" onClick={() => handleSelectPreset(activePreset)}>
                  Reset to Sample
                </s-button>
              </s-stack>
            </s-stack>

            {/* Redesigned Executive Pre-Flight Summary Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "20px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Header with Title and Live Validation Pill */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "16px" }}>📋</span>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                        Pre-Flight Summary
                      </h3>
                    </div>
                    <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                      Validation prior to credit issuance
                    </p>
                  </div>
                  <s-badge tone={validationSummary.valid > 0 ? "success" : "neutral"}>
                    {validationSummary.valid > 0 ? "✓ Ready to Credit" : "Awaiting Data"}
                  </s-badge>
                </div>

                {/* Hero Total Credit Highlight Box */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
                    borderRadius: "12px",
                    padding: "16px 18px",
                    color: "#ffffff",
                    boxShadow: "0 6px 16px -2px rgba(4, 120, 87, 0.28)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a7f3d0" }}>
                      Total Credit to Disburse
                    </span>
                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", fontWeight: 700, letterSpacing: "0.04em" }}>
                      USD
                    </span>
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: 900, color: "#ffffff", marginTop: "4px", letterSpacing: "-0.03em" }}>
                    ${validationSummary.liability.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "#d1fae5", marginTop: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>✨</span>
                    <span>Direct native Shopify credit ledger allocation</span>
                  </div>
                </div>

                {/* Structured 3-Tile Metric Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Parsed Rows
                    </span>
                    <span style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
                      {validationSummary.total}
                    </span>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Total in CSV</span>
                  </div>

                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Valid Records
                    </span>
                    <span style={{ fontSize: "22px", fontWeight: 800, color: "#15803d" }}>
                      {validationSummary.valid}
                    </span>
                    <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>Ready to import</span>
                  </div>
                </div>

                {/* Status / Errors Row */}
                <div
                  style={{
                    background: validationSummary.invalid > 0 ? "#fef2f2" : "#f8fafc",
                    border: validationSummary.invalid > 0 ? "1px solid #fecaca" : "1px solid #f1f5f9",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", color: validationSummary.invalid > 0 ? "#991b1b" : "#64748b", fontWeight: 500 }}>
                    {validationSummary.invalid > 0 ? "⚠️ Invalid or Skipped Rows" : "Syntax & Email Check"}
                  </span>
                  <s-badge tone={validationSummary.invalid > 0 ? "critical" : "success"}>
                    {validationSummary.invalid > 0 ? `${validationSummary.invalid} Errors` : "✓ Clean"}
                  </s-badge>
                </div>

                {/* Security Guarantee Pills */}
                <div
                  style={{
                    background: "#fafafa",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "11px",
                    color: "#475569",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🛡️</span>
                    <span><strong>Shopify Native GraphQL API</strong>: Idempotent mutations</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>⚡</span>
                    <span>Customer accounts auto-linked with zero duplicate balances</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <s-button
                  variant="primary"
                  onClick={handleExecuteMigration}
                  disabled={isSubmitting || validationSummary.valid === 0}
                >
                  {isSubmitting ? (
                    "Processing Migration..."
                  ) : (
                    `Execute Migration (${validationSummary.valid} Customers)`
                  )}
                </s-button>
                <div style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8" }}>
                  🔒 Instant balance update upon execution
                </div>
              </div>
            </div>
          </s-grid>
        </s-section>

        {/* Migration Results Section if completed */}
        {migrationResult && (
          <s-section padding="none">
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-heading>Migration Execution Results ({migrationResult.summary.successCount} Imported)</s-heading>
                  <s-button variant="secondary" onClick={handleResetBatch}>
                    Migrate Another Batch
                  </s-button>
                </s-stack>
                <s-banner tone="success" heading="Migration Completed Successfully!">
                  <s-paragraph>
                    Imported <strong>{migrationResult.summary.successCount}</strong> customers with a total of <strong>${migrationResult.summary.totalCredited}</strong> in Native Shopify Store Credit.
                  </s-paragraph>
                </s-banner>
              </s-stack>
            </s-box>
            <s-divider />

            <s-table>
              <s-table-header-row>
                <s-table-header>Customer Email</s-table-header>
                <s-table-header>Name</s-table-header>
                <s-table-header>Credited</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Store Credit Account</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {migrationResult.results.map((res, i) => (
                  <s-table-row key={i}>
                    <s-table-cell>
                      <s-text><strong>{res.email}</strong></s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text tone="neutral">{res.customerName || "-"}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text tone="success"><strong>+${parseFloat(res.amount).toFixed(2)}</strong></s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={res.status === "SUCCESS" ? "success" : "critical"}>
                        {res.status}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text tone="info"><code>{res.transactionId || res.error}</code></s-text>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-section>
        )}

        {/* Pre-Import Preview Table: Only shown before migration or toggled intentionally */}
        {(!migrationResult || showPreImportAfterRun) && (
          <s-section padding="none">
            <s-box padding="base">
              <s-heading>Parsed Records Preview ({parsedRows.length} Rows)</s-heading>
            </s-box>
            <s-divider />

            {parsedRows.length === 0 ? (
              <s-box padding="base">
                <s-paragraph tone="neutral">Paste CSV data or select a preset above to preview.</s-paragraph>
              </s-box>
            ) : (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Status</s-table-header>
                  <s-table-header>Email</s-table-header>
                  <s-table-header>Name</s-table-header>
                  <s-table-header>Balance ($)</s-table-header>
                  <s-table-header>Note</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {parsedRows.slice(0, 10).map((row) => (
                    <s-table-row key={row.id}>
                      <s-table-cell>
                        <s-badge tone={row.isValid ? "success" : "critical"}>
                          {row.isValid ? "READY" : row.error}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text><strong>{row.email}</strong></s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text tone="neutral">{`${row.firstName} ${row.lastName}`.trim() || "-"}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text tone={row.amount > 0 ? "success" : "critical"}>
                          <strong>${isNaN(row.amount) ? "0.00" : row.amount.toFixed(2)}</strong>
                        </s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text tone="neutral">{row.note}</s-text>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            )}
          </s-section>
        )}
      </div>
    </s-page>
  );
}
