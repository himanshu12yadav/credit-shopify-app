import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useSearchParams, Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
// Services for Native Store Credit handling (v2 synced)
import { searchCustomers, creditCustomer, debitCustomer } from "../services/store-credit.server";
import { issueRefundStoreCredit } from "../services/rules-engine.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  const customers = await searchCustomers({ admin, query });

  return {
    shop: session.shop,
    customers,
    query,
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const customerId = formData.get("customerId");
  const customerEmail = formData.get("customerEmail");
  const customerName = formData.get("customerName");
  const amount = formData.get("amount");
  const currencyCode = formData.get("currencyCode") || "USD";
  const note = formData.get("note") || "Manual store credit adjustment";

  try {
    if (intent === "issue_credit") {
      const expiryDays = formData.get("expiryDays");
      let expiresAt = null;
      if (expiryDays && expiryDays !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiryDays, 10));
        expiresAt = d;
      }

      const res = await creditCustomer({
        admin,
        shop: session.shop,
        customerId,
        customerEmail,
        customerName,
        amount,
        currencyCode,
        expiresAt,
        notify: formData.get("notify") === "true",
        source: "MANUAL",
        note,
      });

      return { success: true, message: `Issued $${amount} store credit to ${customerName || customerEmail}`, res };
    }

    if (intent === "debit_credit") {
      const res = await debitCustomer({
        admin,
        shop: session.shop,
        customerId,
        customerEmail,
        customerName,
        amount,
        currencyCode,
        source: "MANUAL",
        note,
      });

      if (!res.success && res.apiError) {
        return { success: false, error: res.apiError };
      }

      return {
        success: true,
        message: `Deducted $${amount} store credit from ${customerName || customerEmail}`,
        res,
      };
    }

    if (intent === "refund_to_credit") {
      const applyBonus = formData.get("applyBonus") === "true";
      const bonusPct = applyBonus ? 10 : 0;
      const res = await issueRefundStoreCredit({
        admin,
        shop: session.shop,
        customerId,
        customerEmail,
        customerName,
        refundAmount: amount,
        currencyCode,
        applyBonus,
        bonusPercentage: bonusPct,
        reason: note,
      });

      if (!res.success && res.apiError) {
        return { success: false, error: res.apiError };
      }

      return {
        success: true,
        message: `Issued $${res.totalCredited} store credit (including $${res.bonusAmount} bonus)`,
        res,
      };
    }
  } catch (err) {
    console.error("Action error in app.customers:", err);
    return { success: false, error: err.message };
  }

  return { success: false, error: "Invalid intent" };
};

export default function CustomersPage() {
  const { customers, query } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [actionType, setActionType] = useState("issue_credit");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [expiryDays, setExpiryDays] = useState("90");
  const [note, setNote] = useState("");
  const [applyBonus, setApplyBonus] = useState(true);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const isSubmitting = fetcher.state === "submitting";

  const handleOpenModal = (customer, type) => {
    setSelectedCustomer(customer);
    setActionType(type);
    setAmount(type === "refund_to_credit" ? "50.00" : "10.00");
    setNote(
      type === "issue_credit"
        ? "Goodwill customer service credit"
        : type === "debit_credit"
        ? "Manual balance deduction"
        : "Return item converted to store credit"
    );
  };

  const handleCloseModal = () => {
    setSelectedCustomer(null);
  };

  const handleSubmitAction = (e) => {
    e.preventDefault();
    if (!selectedCustomer || !amount) return;

    fetcher.submit(
      {
        intent: actionType,
        customerId: selectedCustomer.id,
        customerEmail: selectedCustomer.email,
        customerName: selectedCustomer.displayName,
        amount,
        currencyCode: currency,
        expiryDays,
        note,
        notify: String(notify),
        applyBonus: String(applyBonus),
      },
      { method: "POST" }
    );

    shopify.toast.show(
      actionType === "issue_credit"
        ? `Processing credit for ${selectedCustomer.displayName}...`
        : actionType === "refund_to_credit"
        ? `Converting refund to store credit for ${selectedCustomer.displayName}...`
        : `Deducting credit from ${selectedCustomer.displayName}...`
    );

    handleCloseModal();
  };

  return (
    <s-page heading="Customers & Store Credit Balances">
      {/* Unified Customers Table Section */}
      <s-section padding="none">
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifycontent="space-between" alignitems="center">
              <s-heading>Store Customers ({customers.length})</s-heading>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {query && (
                  <s-badge tone="info">Filtered: "{query}"</s-badge>
                )}
                <Link
                  to="/app/appeasements"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    background: "#047857",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    textDecoration: "none",
                  }}
                >
                  🎧 1-Click Appeasements
                </Link>
                <Link
                  to="/app/migrate"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    background: "#0f172a",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    textDecoration: "none",
                  }}
                >
                  📥 Import / Migrate CSV
                </Link>
              </div>
            </s-stack>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input, s-search-field");
                setSearchParams(input?.value ? { q: input.value } : {});
              }}
              style={{ display: "flex", gap: "12px", alignItems: "center", width: "100%" }}
            >
              <s-search-field
                placeholder="Search customers by name, email or phone..."
                defaultValue={query}
                name="q"
                style={{ flex: 1 }}
              />
              <s-button type="submit">Search</s-button>
              {query && (
                <s-button
                  variant="tertiary"
                  onClick={() => setSearchParams({})}
                >
                  Clear
                </s-button>
              )}
            </form>
          </s-stack>
        </s-box>

        <s-divider />

        {customers.length === 0 ? (
          <s-box padding="base">
            <s-paragraph tone="neutral">No customers found matching "{query}".</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Orders & Spend</s-table-header>
              <s-table-header>Native Store Credit</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {customers.map((c) => (
                <s-table-row key={c.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text><strong>{c.displayName}</strong></s-text>
                      <s-text tone="neutral" type="subdued">
                        {c.email} {c.phone !== "No phone" ? `• ${c.phone}` : ""}
                      </s-text>
                    </s-stack>
                  </s-table-cell>

                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text>{c.ordersCount} orders</s-text>
                      <s-text tone="neutral" type="subdued">{c.totalSpent} total</s-text>
                    </s-stack>
                  </s-table-cell>

                  <s-table-cell>
                    <s-badge tone={c.creditBalance !== "USD 0.00" ? "success" : "neutral"}>
                      {c.creditBalance}
                    </s-badge>
                  </s-table-cell>

                  <s-table-cell>
                    <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                      <s-button
                        variant="primary"
                        onClick={() => handleOpenModal(c, "issue_credit")}
                      >
                        + Issue Credit
                      </s-button>
                      <s-button
                        onClick={() => handleOpenModal(c, "refund_to_credit")}
                      >
                        Return → Credit
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() => handleOpenModal(c, "debit_credit")}
                      >
                        − Deduct Credit
                      </s-button>
                    </div>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      {/* Modal Dialog with clean native styling without nested s-section */}
      {selectedCustomer && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#ffffff",
            width: "520px",
            maxWidth: "100%",
            borderRadius: "12px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            padding: "24px",
            boxSizing: "border-box"
          }}>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="extra-tight">
                <s-heading>
                  {actionType === "issue_credit"
                    ? "Issue Native Store Credit"
                    : actionType === "refund_to_credit"
                    ? "Convert Refund to Store Credit (+Bonus)"
                    : "Deduct / Revoke Store Credit"}
                </s-heading>
                <s-text tone="neutral" type="subdued">
                  Target: <strong>{selectedCustomer.displayName}</strong> ({selectedCustomer.email}) • Current Balance: <strong>{selectedCustomer.creditBalance}</strong>
                </s-text>
              </s-stack>

              <form onSubmit={handleSubmitAction}>
                <s-stack direction="block" gap="base">
                  <s-grid gridtemplatecolumns="2fr 1fr" gap="base">
                    <s-number-field
                      label={
                        actionType === "refund_to_credit"
                          ? "Refund Amount"
                          : actionType === "debit_credit"
                          ? "Deduction Amount"
                          : "Credit Amount"
                      }
                      value={amount}
                      step="0.01"
                      min="0.01"
                      required
                      onInput={(e) => setAmount(e.target.value)}
                    />
                    <s-select
                      label="Currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <s-option value="USD">USD ($)</s-option>
                      <s-option value="EUR">EUR (€)</s-option>
                      <s-option value="GBP">GBP (£)</s-option>
                      <s-option value="CAD">CAD ($)</s-option>
                      <s-option value="AUD">AUD ($)</s-option>
                      <s-option value="INR">INR (₹)</s-option>
                    </s-select>
                  </s-grid>

                  {actionType === "refund_to_credit" && (
                    <s-banner tone="success" heading="+10% Merchant Retention Bonus">
                      <s-stack direction="block" gap="extra-tight">
                        <s-checkbox
                          label={`Add +10% Bonus (+${(parseFloat(amount || "0") * 0.1).toFixed(2)})`}
                          checked={applyBonus}
                          onChange={(e) => setApplyBonus(e.target.checked)}
                        />
                        <s-paragraph tone="neutral">
                          Customer receives ${(parseFloat(amount || "0") * (applyBonus ? 1.1 : 1.0)).toFixed(2)} in store credit.
                        </s-paragraph>
                      </s-stack>
                    </s-banner>
                  )}

                  {actionType === "debit_credit" && (
                    <s-banner tone="warning" heading="Balance Deduction Notice">
                      <s-paragraph tone="neutral">
                        This will decrease the customer's native Shopify store credit balance by the entered amount.
                      </s-paragraph>
                    </s-banner>
                  )}

                  {actionType === "issue_credit" && (
                    <s-select
                      label="Expiration Policy"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                    >
                      <s-option value="30">Expires in 30 days</s-option>
                      <s-option value="60">Expires in 60 days</s-option>
                      <s-option value="90">Expires in 90 days (Recommended)</s-option>
                      <s-option value="180">Expires in 180 days</s-option>
                      <s-option value="365">Expires in 1 Year</s-option>
                      <s-option value="never">No Expiration (Lifetime)</s-option>
                    </s-select>
                  )}

                  <s-text-field
                    label="Reason / Audit Note"
                    value={note}
                    onInput={(e) => setNote(e.target.value)}
                    placeholder={
                      actionType === "debit_credit"
                        ? "e.g. Issued by mistake, customer agreement..."
                        : "e.g. VIP loyalty award, return resolution..."
                    }
                  />

                  {actionType === "issue_credit" && (
                    <s-checkbox
                      label="Notify customer via Shopify email notification"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                    />
                  )}

                  <s-stack direction="inline" justifycontent="flex-end" gap="small">
                    <s-button type="button" onClick={handleCloseModal}>Cancel</s-button>
                    <s-button
                      type="submit"
                      variant={actionType === "debit_credit" ? "destructive" : "primary"}
                      {...(isSubmitting ? { loading: true } : {})}
                    >
                      {actionType === "debit_credit" ? "Deduct Store Credit" : "Confirm & Apply"}
                    </s-button>
                  </s-stack>
                </s-stack>
              </form>
            </s-stack>
          </div>
        </div>
      )}
    </s-page>
  );
}
