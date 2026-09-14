import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubSubNav } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [rules, settings] = await Promise.all([
    prisma.creditRule.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creditSettings.findUnique({
      where: { shop },
    }),
  ]);

  return {
    shop,
    rules,
    settings: settings || {
      cashbackEnabled: true,
      cashbackRate: 5.0,
      welcomeBonusEnabled: true,
      welcomeBonusAmount: 10.0,
      defaultExpiryDays: 90,
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_rule") {
    const title = formData.get("title");
    const trigger = formData.get("trigger") || "ORDER_PAID";
    const creditType = formData.get("creditType") || "PERCENTAGE";
    const creditValue = parseFloat(formData.get("creditValue") || "5");
    const minSpend = parseFloat(formData.get("minSpend") || "0");
    const maxCredit = formData.get("maxCredit") ? parseFloat(formData.get("maxCredit")) : null;
    const customerTag = formData.get("customerTag") || null;
    const expiryDays = parseInt(formData.get("expiryDays") || "90", 10);

    await prisma.creditRule.create({
      data: {
        shop,
        title,
        trigger,
        creditType,
        creditValue,
        minSpend,
        maxCredit,
        customerTag,
        expiryDays,
        isActive: true,
      },
    });

    return { success: true, message: "Rule created successfully!" };
  }

  if (intent === "toggle_rule") {
    const id = formData.get("id");
    const currentStatus = formData.get("isActive") === "true";

    await prisma.creditRule.update({
      where: { id },
      data: { isActive: !currentStatus },
    });

    return { success: true };
  }

  if (intent === "delete_rule") {
    const id = formData.get("id");
    await prisma.creditRule.delete({ where: { id } });
    return { success: true };
  }

  if (intent === "update_cashback_settings") {
    const cashbackEnabled = formData.get("cashbackEnabled") === "true";
    const cashbackRate = parseFloat(formData.get("cashbackRate") || "5");
    const welcomeBonusEnabled = formData.get("welcomeBonusEnabled") === "true";
    const welcomeBonusAmount = parseFloat(formData.get("welcomeBonusAmount") || "10");

    await prisma.creditSettings.upsert({
      where: { shop },
      create: {
        shop,
        cashbackEnabled,
        cashbackRate,
        welcomeBonusEnabled,
        welcomeBonusAmount,
      },
      update: {
        cashbackEnabled,
        cashbackRate,
        welcomeBonusEnabled,
        welcomeBonusAmount,
      },
    });

    // 1. Sync Universal Order Cashback into CreditRule
    const existingCashbackRule = await prisma.creditRule.findFirst({
      where: { shop, trigger: "ORDER_PAID", title: "Universal Order Cashback" },
    });
    if (existingCashbackRule) {
      await prisma.creditRule.update({
        where: { id: existingCashbackRule.id },
        data: {
          creditValue: cashbackRate,
          isActive: cashbackEnabled,
        },
      });
    } else if (cashbackEnabled) {
      await prisma.creditRule.create({
        data: {
          shop,
          title: "Universal Order Cashback",
          description: "Automatically awards store credit to shoppers on every paid order",
          trigger: "ORDER_PAID",
          creditType: "PERCENTAGE",
          creditValue: cashbackRate,
          minSpend: 0,
          expiryDays: 90,
          isActive: true,
        },
      });
    }

    // 2. Sync First Purchase Welcome Bonus into CreditRule
    const existingWelcomeRule = await prisma.creditRule.findFirst({
      where: { shop, trigger: "FIRST_ORDER", title: "First Purchase Welcome Bonus" },
    });
    if (existingWelcomeRule) {
      await prisma.creditRule.update({
        where: { id: existingWelcomeRule.id },
        data: {
          creditValue: welcomeBonusAmount,
          isActive: welcomeBonusEnabled,
        },
      });
    } else if (welcomeBonusEnabled) {
      await prisma.creditRule.create({
        data: {
          shop,
          title: "First Purchase Welcome Bonus",
          description: "Bonus store credit granted on a customer's first completed purchase",
          trigger: "FIRST_ORDER",
          creditType: "FIXED",
          creditValue: welcomeBonusAmount,
          minSpend: 0,
          expiryDays: 90,
          isActive: true,
        },
      });
    }

    return { success: true, message: "Baseline cashback settings saved & rules activated!" };
  }

  return { success: false };
};

export default function RulesPage() {
  const { rules, settings } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [showBuilder, setShowBuilder] = useState(false);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("ORDER_PAID");
  const [creditType, setCreditType] = useState("PERCENTAGE");
  const [creditValue, setCreditValue] = useState("5");
  const [minSpend, setMinSpend] = useState("0");
  const [customerTag, setCustomerTag] = useState("");
  const [expiryDays, setExpiryDays] = useState("90");

  // Baseline settings state
  const [cashbackEnabled, setCashbackEnabled] = useState(settings.cashbackEnabled);
  const [cashbackRate, setCashbackRate] = useState(String(settings.cashbackRate));
  const [welcomeBonusEnabled, setWelcomeBonusEnabled] = useState(settings.welcomeBonusEnabled);
  const [welcomeBonusAmount, setWelcomeBonusAmount] = useState(String(settings.welcomeBonusAmount));

  const isSavingBaseline = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "update_cashback_settings";

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (settings) {
      setCashbackEnabled(settings.cashbackEnabled);
      setCashbackRate(String(settings.cashbackRate));
      setWelcomeBonusEnabled(settings.welcomeBonusEnabled);
      setWelcomeBonusAmount(String(settings.welcomeBonusAmount));
    }
  }, [settings]);

  const handleSaveBaseline = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    fetcher.submit(
      {
        intent: "update_cashback_settings",
        cashbackEnabled: String(cashbackEnabled),
        cashbackRate: String(cashbackRate),
        welcomeBonusEnabled: String(welcomeBonusEnabled),
        welcomeBonusAmount: String(welcomeBonusAmount),
      },
      { method: "POST" }
    );
  };

  const handleCreateRule = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      shopify.toast.show("Please provide a rule title");
      return;
    }
    fetcher.submit(
      {
        intent: "create_rule",
        title,
        trigger,
        creditType,
        creditValue,
        minSpend,
        customerTag,
        expiryDays,
      },
      { method: "POST" }
    );
    shopify.toast.show("Automation rule created!");
    setShowBuilder(false);
    setTitle("");
  };

  const handleToggle = (id, currentStatus) => {
    fetcher.submit({ intent: "toggle_rule", id, isActive: String(currentStatus) }, { method: "POST" });
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to remove this automation rule?")) {
      fetcher.submit({ intent: "delete_rule", id }, { method: "POST" });
      shopify.toast.show("Rule deleted");
    }
  };

  return (
    <s-page heading="Credit Rules & Automation Engine">
      <s-button slot="primary-action" variant="primary" onClick={() => setShowBuilder(!showBuilder)}>
        {showBuilder ? "Close Builder" : "+ Create New Rule"}
      </s-button>

      <HubSubNav clusterKey="rules" currentPath="/app/rules" />
      <s-stack direction="inline" gap="small">
        <s-button variant="tertiary" onClick={() => navigate("/app/ledger?source=RULE_AWARD")}>View rule payouts in ledger</s-button>
        <s-button variant="tertiary" onClick={() => navigate("/app/analytics")}>Analytics & ROI</s-button>
        <s-button variant="tertiary" onClick={() => navigate("/app/campaigns")}>Campaigns & Growth</s-button>
      </s-stack>

      {/* Baseline Settings using s-section, s-checkbox, s-number-field */}
      <s-section heading="Baseline Store Cashback Settings">
        <form onSubmit={handleSaveBaseline}>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <s-stack direction="block" gap="small">
                <s-checkbox
                  label="Universal Order Cashback"
                  checked={cashbackEnabled}
                  onChange={(e) => {
                    const val = e.currentTarget.checked !== undefined ? e.currentTarget.checked : e.detail?.checked;
                    setCashbackEnabled(Boolean(val));
                  }}
                  onInput={(e) => {
                    const val = e.currentTarget.checked !== undefined ? e.currentTarget.checked : e.detail?.checked;
                    setCashbackEnabled(Boolean(val));
                  }}
                />
                <s-paragraph tone="neutral">
                  Automatically awards store credit to shoppers on every paid order.
                </s-paragraph>
                <s-number-field
                  label="Cashback Rate"
                  suffix="%"
                  value={cashbackRate}
                  step="0.5"
                  min="0"
                  max="100"
                  onChange={(e) => setCashbackRate(String(e.currentTarget.value ?? e.detail?.value ?? ""))}
                  onInput={(e) => setCashbackRate(String(e.currentTarget.value ?? e.detail?.value ?? ""))}
                />
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-checkbox
                  label="First Purchase Welcome Bonus"
                  checked={welcomeBonusEnabled}
                  onChange={(e) => {
                    const val = e.currentTarget.checked !== undefined ? e.currentTarget.checked : e.detail?.checked;
                    setWelcomeBonusEnabled(Boolean(val));
                  }}
                  onInput={(e) => {
                    const val = e.currentTarget.checked !== undefined ? e.currentTarget.checked : e.detail?.checked;
                    setWelcomeBonusEnabled(Boolean(val));
                  }}
                />
                <s-paragraph tone="neutral">
                  Bonus store credit granted on a customer's first completed purchase.
                </s-paragraph>
                <s-number-field
                  label="Welcome Bonus"
                  prefix="$"
                  value={welcomeBonusAmount}
                  step="1"
                  min="0"
                  onChange={(e) => setWelcomeBonusAmount(String(e.currentTarget.value ?? e.detail?.value ?? ""))}
                  onInput={(e) => setWelcomeBonusAmount(String(e.currentTarget.value ?? e.detail?.value ?? ""))}
                />
              </s-stack>
            </s-grid>

            <s-stack direction="inline" justifyContent="flex-end">
              <s-button
                type="button"
                variant="secondary"
                onClick={handleSaveBaseline}
                {...(isSavingBaseline ? { loading: true } : {})}
              >
                Save Baseline Settings
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Rule Builder using s-text-field, s-select, s-option, s-number-field */}
      {showBuilder && (
        <s-section heading="Create Custom Automation Rule">
          <form onSubmit={handleCreateRule}>
            <s-stack direction="block" gap="base">
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                <s-text-field
                  label="Rule Name / Title"
                  placeholder="e.g. VIP 10% Weekend Cashback, Spend $100 get $15..."
                  value={title}
                  required
                  onInput={(e) => setTitle(e.currentTarget.value)}
                />
                <s-select
                  label="Event Trigger"
                  value={trigger}
                  onChange={(e) => setTrigger(e.currentTarget.value)}
                >
                  <s-option value="ORDER_PAID">Order Paid (General)</s-option>
                  <s-option value="FIRST_ORDER">First Order Ever (New Customers)</s-option>
                  <s-option value="SPEND_THRESHOLD">Spend Threshold Reached</s-option>
                  <s-option value="CUSTOMER_TAG">Customer Has Specific Tag</s-option>
                </s-select>
              </s-grid>

              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
                <s-select
                  label="Credit Calculation"
                  value={creditType}
                  onChange={(e) => setCreditType(e.currentTarget.value)}
                >
                  <s-option value="PERCENTAGE">Percentage of Order Total (%)</s-option>
                  <s-option value="FIXED">Fixed Amount ($)</s-option>
                </s-select>
                <s-number-field
                  label={`Reward Value (${creditType === "PERCENTAGE" ? "%" : "$"})`}
                  value={creditValue}
                  step="0.1"
                  min="0.1"
                  required
                  onInput={(e) => setCreditValue(e.currentTarget.value)}
                />
                <s-number-field
                  label="Minimum Order Spend"
                  prefix="$"
                  value={minSpend}
                  step="1"
                  min="0"
                  onInput={(e) => setMinSpend(e.currentTarget.value)}
                />
              </s-grid>

              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                <s-select
                  label="Expiration Policy"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.currentTarget.value)}
                >
                  <s-option value="30">Expires in 30 days</s-option>
                  <s-option value="60">Expires in 60 days</s-option>
                  <s-option value="90">Expires in 90 days</s-option>
                  <s-option value="180">Expires in 180 days</s-option>
                  <s-option value="365">Expires in 1 Year</s-option>
                </s-select>

                {trigger === "CUSTOMER_TAG" && (
                  <s-text-field
                    label="Required Customer Tag"
                    placeholder="e.g. VIP, Wholesale"
                    value={customerTag}
                    onInput={(e) => setCustomerTag(e.currentTarget.value)}
                  />
                )}
              </s-grid>

              <s-stack direction="inline" justifyContent="flex-end" gap="small">
                <s-button type="button" onClick={() => setShowBuilder(false)}>Cancel</s-button>
                <s-button type="submit" variant="primary">Save & Enable Rule</s-button>
              </s-stack>
            </s-stack>
          </form>
        </s-section>
      )}

      {/* Rules Table Section */}
      <s-section padding="none">
        <s-box padding="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-heading>Active Store Rules &amp; Automations ({rules.length})</s-heading>
            {rules.length > 0 && (
              <s-button variant="secondary" onClick={() => setShowBuilder(true)}>+ New Rule</s-button>
            )}
          </s-stack>
        </s-box>
        <s-divider />

        {rules.length === 0 ? (
          <s-box padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph tone="neutral">No active automation rules yet. Click "Save Baseline Settings" above or create a custom rule.</s-paragraph>
              <s-button variant="primary" onClick={() => setShowBuilder(true)}>Create First Rule</s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Rule Name</s-table-header>
              <s-table-header>Trigger Event</s-table-header>
              <s-table-header>Reward</s-table-header>
              <s-table-header>Min Spend</s-table-header>
              <s-table-header>Expiry</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rules.map((rule) => (
                <s-table-row key={rule.id}>
                  <s-table-cell>
                    <s-text><strong>{rule.title}</strong></s-text>
                  </s-table-cell>

                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-badge tone="info">{rule.trigger}</s-badge>
                      {rule.customerTag && (
                        <s-text tone="neutral" color="subdued">Tag: {rule.customerTag}</s-text>
                      )}
                    </s-stack>
                  </s-table-cell>

                  <s-table-cell>
                    <s-text>
                      <strong>{rule.creditType === "PERCENTAGE" ? `${rule.creditValue}%` : `$${rule.creditValue.toFixed(2)}`}</strong>
                    </s-text>
                  </s-table-cell>

                  <s-table-cell>
                    <s-text>{rule.minSpend > 0 ? `$${rule.minSpend.toFixed(2)}` : "None"}</s-text>
                  </s-table-cell>

                  <s-table-cell>
                    <s-text tone="neutral">{rule.expiryDays} days</s-text>
                  </s-table-cell>

                  <s-table-cell>
                    <s-badge tone={rule.isActive ? "success" : "neutral"}>
                      {rule.isActive ? "ACTIVE" : "PAUSED"}
                    </s-badge>
                  </s-table-cell>

                  <s-table-cell>
                    <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                      <s-button
                        variant="tertiary"
                        onClick={() => handleToggle(rule.id, rule.isActive)}
                      >
                        {rule.isActive ? "Pause" : "Activate"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() => handleDelete(rule.id)}
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
    </s-page>
  );
}
