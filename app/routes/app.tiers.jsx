import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge, SaveBar, Modal, TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getVipTiers, createVipTier, updateVipTier, deleteVipTier } from "../services/tiers.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const tiers = await getVipTiers(session.shop);

  return {
    shop: session.shop,
    tiers,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_all_tiers") {
    const tiersJson = formData.get("tiers");
    const updatedTiers = JSON.parse(tiersJson);

    for (const t of updatedTiers) {
      await updateVipTier(t.id, {
        name: t.name,
        minSpend: t.minSpend,
        cashbackRate: t.cashbackRate,
        perks: t.perks,
        badgeColor: t.badgeColor,
      });
    }

    return { success: true, message: "VIP loyalty tiers saved successfully!" };
  }

  if (intent === "create_tier") {
    const name = formData.get("name");
    const minSpend = formData.get("minSpend");
    const cashbackRate = formData.get("cashbackRate");
    const perks = formData.get("perks");
    const badgeColor = formData.get("badgeColor") || "#4f46e5";

    await createVipTier(session.shop, {
      name,
      minSpend,
      cashbackRate,
      perks,
      badgeColor,
    });

    return { success: true, message: `Created VIP Tier "${name}" successfully!` };
  }

  if (intent === "delete_tier") {
    const tierId = formData.get("tierId");
    await deleteVipTier(tierId);
    return { success: true, message: "Tier removed successfully!" };
  }

  return { success: false, error: "Invalid intent" };
};

export default function TiersPage() {
  const { tiers: initialTiers } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [tiers, setTiers] = useState(initialTiers);
  const [isDirty, setIsDirty] = useState(false);
  const [tierToDelete, setTierToDelete] = useState(null);

  const [name, setName] = useState("");
  const [minSpend, setMinSpend] = useState("100.00");
  const [cashbackRate, setCashbackRate] = useState("10.0");
  const [perks, setPerks] = useState("");
  const [badgeColor, setBadgeColor] = useState("#4f46e5");
  const [showAddForm, setShowAddForm] = useState(false);

  const isSubmitting = fetcher.state === "submitting";

  // Sync state when initialTiers updates from loader
  useEffect(() => {
    setTiers(initialTiers);
    setIsDirty(false);
  }, [initialTiers]);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
      if (fetcher.data?.message.includes("Created")) {
        setName("");
        setPerks("");
        setShowAddForm(false);
      }
      setIsDirty(false);
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleTierChange = (id, field, value) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    setIsDirty(true);
  };

  const handleSave = () => {
    fetcher.submit(
      {
        intent: "save_all_tiers",
        tiers: JSON.stringify(
          tiers.map((t) => ({
            ...t,
            minSpend: parseFloat(t.minSpend) || 0,
            cashbackRate: parseFloat(t.cashbackRate) || 0,
          }))
        ),
      },
      { method: "POST" }
    );
  };

  const handleCreate = (event) => {
    event.preventDefault();
    fetcher.submit(
      { intent: "create_tier", name, minSpend, cashbackRate, perks, badgeColor },
      { method: "POST" }
    );
  };

  const handleDiscard = () => {
    setTiers(initialTiers);
    setIsDirty(false);
  };

  const handleDeleteClick = (tier) => {
    setTierToDelete(tier);
  };

  const confirmDelete = () => {
    if (!tierToDelete) return;
    fetcher.submit(
      {
        intent: "delete_tier",
        tierId: tierToDelete.id,
      },
      { method: "POST" }
    );
    setTierToDelete(null);
  };

  return (
    <s-page heading="VIP Loyalty Tiers & Spend Thresholds">
      <HubBreadcrumb toPath="/app/customers" label="Customers & Wallet" />
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
        <HubSubNav clusterKey="customers" currentPath="/app/tiers" />
        {/* Banner with clean spacing */}
        <s-banner tone="info" heading="Automatic VIP Tier Progression">
          Customers automatically ascend to higher tiers as their lifetime store spend increases. Higher tiers grant higher store credit cashback on every paid order!
        </s-banner>

        {/* Tier Overview Cards with VIP styling, accent borders, and generous padding */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {tiers.map((t, idx) => (
            <div
              key={t.id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                borderTop: `4px solid ${t.badgeColor || "#4f46e5"}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                transition: "all 0.2s ease-in-out",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    backgroundColor: t.badgeColor || "#4f46e5",
                    color: "#ffffff",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "12px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    display: "inline-block",
                  }}
                >
                  {t.name}
                </span>
                <span
                  style={{
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "9999px",
                  }}
                >
                  Level {idx + 1}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {t.cashbackRate}% <span style={{ fontSize: "14px", fontWeight: 600, color: "#10b981" }}>Cashback</span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
                  {(parseFloat(t.minSpend) || 0) === 0
                    ? "Entry Level ($0 min spend)"
                    : `Unlocked at $${(parseFloat(t.minSpend) || 0).toFixed(2)} spend`}
                </div>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: "1.5",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "12px",
                  minHeight: "40px",
                }}
              >
                {t.perks || "Earn store credit on every purchase."}
              </div>
            </div>
          ))}
        </div>

        {/* Tiers Management Table Card with Header & Spacing */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #e2e8f0",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Configured Loyalty Tiers ({tiers.length})
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "3px" }}>
                Manage customer spend thresholds, cashback percentages, and VIP perks
              </div>
            </div>
            <s-button
              variant="primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? "Cancel / Close" : "+ Add Custom VIP Tier"}
            </s-button>
          </div>

          {/* Add Form Drawer */}
          {showAddForm && (
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <form onSubmit={handleCreate}>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>
                    Create New VIP Loyalty Tier
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <s-text-field
                      label="Tier Name"
                      placeholder="e.g. Diamond VIP"
                      value={name}
                      onInput={(e) => setName(e.currentTarget.value)}
                      required
                    />
                    <s-number-field
                      label="Lifetime Spend Required ($)"
                      step={1}
                      min={0}
                      value={minSpend}
                      onInput={(e) => setMinSpend(String(e.currentTarget.value))}
                      required
                    />
                    <s-number-field
                      label="Cashback Rate (%)"
                      step={0.5}
                      min={0.5}
                      value={cashbackRate}
                      onInput={(e) => setCashbackRate(String(e.currentTarget.value))}
                      required
                    />
                    <s-select
                      label="Badge Color"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.currentTarget.value)}
                    >
                      <s-option value="#4f46e5">Indigo (#4f46e5)</s-option>
                      <s-option value="#d97706">Gold (#d97706)</s-option>
                      <s-option value="#059669">Emerald (#059669)</s-option>
                      <s-option value="#dc2626">Ruby Red (#dc2626)</s-option>
                      <s-option value="#7c3aed">Purple (#7c3aed)</s-option>
                      <s-option value="#0284c7">Cyan (#0284c7)</s-option>
                    </s-select>
                  </div>

                  <s-text-field
                    label="Perks & Benefits Description"
                    placeholder="e.g. 20% cashback on all orders, secret seasonal sales, dedicated VIP concierge"
                    value={perks}
                    onInput={(e) => setPerks(e.currentTarget.value)}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "4px" }}>
                    <s-button type="button" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </s-button>
                    <s-button type="submit" variant="primary" {...(isSubmitting ? { loading: true } : {})}>
                      Save VIP Tier
                    </s-button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Table with inline editing, comfortable cell padding, and typography */}
          {/* Table with responsive compact columns and no horizontal scrollbar */}
          <div style={{ overflow: "hidden" }}>
            <s-table>
              <s-table-header-row>
                <s-table-header><div style={{ padding: "4px 8px" }}>Tier</div></s-table-header>
                <s-table-header><div style={{ padding: "4px 8px" }}>Min Spend</div></s-table-header>
                <s-table-header><div style={{ padding: "4px 8px" }}>Cashback</div></s-table-header>
                <s-table-header><div style={{ padding: "4px 8px" }}>Perks & Description</div></s-table-header>
                <s-table-header><div style={{ padding: "4px 8px", textAlign: "right" }}>Actions</div></s-table-header>
              </s-table-header-row>
              <s-table-body>
                {tiers.map((t) => (
                  <s-table-row key={t.id}>
                    <s-table-cell>
                      <div style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            backgroundColor: t.badgeColor || "#4f46e5",
                            color: "#ffffff",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "11px",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            display: "inline-block",
                          }}
                        >
                          {t.name}
                        </span>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ padding: "10px 8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>$</span>
                        <s-number-field
                          label="Minimum spend"
                          step={10}
                          min={0}
                          value={String(t.minSpend)}
                          onChange={(e) => handleTierChange(t.id, "minSpend", e.currentTarget.value)}
                        />
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ padding: "10px 8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <s-number-field
                          label="Cashback rate"
                          step={0.5}
                          min={0.1}
                          max={100}
                          value={String(t.cashbackRate)}
                          onChange={(e) => handleTierChange(t.id, "cashbackRate", e.currentTarget.value)}
                        />
                        <span
                          style={{
                            backgroundColor: "#ecfdf5",
                            color: "#065f46",
                            border: "1px solid #a7f3d0",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          %
                        </span>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ padding: "10px 16px 10px 8px" }}>
                        <s-text-field
                          label="Tier perks"
                          value={t.perks || ""}
                          onChange={(e) => handleTierChange(t.id, "perks", e.currentTarget.value)}
                          placeholder="e.g. Standard 5% cashback on orders"
                        />
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ padding: "10px 8px", display: "flex", justifyContent: "flex-end" }}>
                        <s-button
                          variant="secondary"
                          tone="critical"
                          onClick={() => handleDeleteClick(t)}
                        >
                          Delete
                        </s-button>
                      </div>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </div>
        </div>
      </div>

      {/* Shopify Contextual Save Bar for unsaved tier configurations */}
      <SaveBar open={isDirty}>
        <s-button variant="primary" onClick={handleSave} loading={isSubmitting}>
          Save
        </s-button>
        <s-button onClick={handleDiscard} disabled={isSubmitting}>
          Discard
        </s-button>
      </SaveBar>

      {/* Native App Bridge Modal for clean delete confirmation (no browser alert popup) */}
      <Modal id="delete-tier-modal" open={Boolean(tierToDelete)} onHide={() => setTierToDelete(null)}>
        <TitleBar title={`Delete ${tierToDelete?.name || ""} Tier?`}>
          <s-button variant="primary" tone="critical" onClick={confirmDelete}>
            Delete Tier
          </s-button>
          <s-button onClick={() => setTierToDelete(null)}>Cancel</s-button>
        </TitleBar>
        <div style={{ padding: "24px", fontSize: "14px", color: "#374151", lineHeight: "1.6" }}>
          Are you sure you want to delete the <strong>{tierToDelete?.name}</strong> loyalty tier?
          <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "13px" }}>
            Customers whose lifetime spend meets this threshold will automatically fall back to the next available tier.
          </div>
        </div>
      </Modal>
    </s-page>
  );
}
