import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { searchCustomers } from "../services/store-credit.server";
import { processOrderForCredit } from "../services/rules-engine.server";
import { HubSubNav, HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const customers = await searchCustomers({ admin, query: "" });

  return {
    shop: session.shop,
    customers,
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const customerId = formData.get("customerId");
  const customerEmail = formData.get("customerEmail");
  const customerName = formData.get("customerName");
  const orderTotal = parseFloat(formData.get("orderTotal") || "100.00");
  const isFirstOrder = formData.get("isFirstOrder") === "true";
  const customerTags = formData.get("customerTags") || "";

  // Construct simulated mock Shopify order payload
  const mockOrder = {
    id: `sim_${Date.now()}`,
    admin_graphql_api_id: `gid://shopify/Order/SIM_${Date.now()}`,
    total_price: orderTotal.toFixed(2),
    currency: "USD",
    customer: {
      id: customerId.replace("gid://shopify/Customer/", ""),
      admin_graphql_api_id: customerId,
      email: customerEmail,
      first_name: customerName?.split(" ")[0] || "Test",
      last_name: customerName?.split(" ")[1] || "Customer",
      orders_count: isFirstOrder ? 1 : 5,
      total_spent: "300.00",
      tags: customerTags,
    },
  };

  try {
    const simulationResult = await processOrderForCredit({
      admin,
      shop: session.shop,
      order: mockOrder,
    });

    return {
      success: true,
      simulationResult,
      mockOrder,
    };
  } catch (err) {
    console.error("Simulation error:", err);
    return {
      success: false,
      error: err.message,
    };
  }
};

export default function SimulatorPage() {
  const { customers } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [orderTotal, setOrderTotal] = useState("150.00");
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [customerTags, setCustomerTags] = useState("vip");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
  const isRunning = fetcher.state === "submitting";
  const result = fetcher.data?.simulationResult;

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(
        fetcher.data.simulationResult?.rewarded
          ? `Success! Awarded $${fetcher.data.simulationResult.amountAwarded?.toFixed(2)} native store credit!`
          : "Simulation complete: No rules matched threshold."
      );
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleSimulate = (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    fetcher.submit(
      {
        customerId: selectedCustomer.id,
        customerEmail: selectedCustomer.email,
        customerName: selectedCustomer.displayName,
        orderTotal,
        isFirstOrder: String(isFirstOrder),
        customerTags,
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Order Webhook & Automation Simulator">
      <HubBreadcrumb toPath="/app/rules" label="Rules & Automation" />
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
        <HubSubNav clusterKey="rules" currentPath="/app/simulator" />
        <s-banner tone="info" heading="Instant Automation Testing Cockpit">
          Test and verify your cashback rules, VIP tier multipliers, and campaign bonuses without placing real paid orders in checkout. When you run a simulation, the rules engine executes live and deposits actual native store credit into the customer's Shopify account.
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          {/* Simulator Controls */}
          <s-section padding="base">
            <s-stack direction="block" gap="base">
              <s-heading>Simulate New Order Event</s-heading>
              <s-paragraph tone="neutral">
                Configure order parameters to trigger the rules engine:
              </s-paragraph>

              <form onSubmit={handleSimulate}>
                <s-stack direction="block" gap="base">
                  <s-select
                    label="Target Customer"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.currentTarget.value)}
                  >
                    {customers.map((c) => (
                      <s-option key={c.id} value={c.id}>
                        {c.displayName} ({c.creditBalance})
                      </s-option>
                    ))}
                  </s-select>

                  <s-number-field
                    label="Order Subtotal ($)"
                    step="0.01"
                    min="1"
                    value={orderTotal}
                    onInput={(e) => setOrderTotal(e.currentTarget.value)}
                    required
                  />

                  <s-checkbox
                    label="First-time Customer Order (Qualifies for welcome bonuses)"
                    checked={isFirstOrder}
                    onChange={(e) => setIsFirstOrder(e.currentTarget.checked)}
                  />

                  <s-text-field
                    label="Simulated Customer Tags (Comma-separated)"
                    placeholder="e.g. VIP, loyal, influencer"
                    value={customerTags}
                    onInput={(e) => setCustomerTags(e.currentTarget.value)}
                  />

                  <s-button
                    type="submit"
                    variant="primary"
                    {...(isRunning ? { loading: true } : {})}
                  >
                    {isRunning ? "Simulating Webhook..." : "Run Order Automation"}
                  </s-button>
                </s-stack>
              </form>
            </s-stack>
          </s-section>

          {/* Execution Log & Results */}
          <s-section padding="base">
            <s-stack direction="block" gap="base">
              <s-heading>Execution Results</s-heading>

              {!result ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>⚡</div>
                  <div style={{ fontWeight: 600 }}>No Simulation Executed Yet</div>
                  <div style={{ fontSize: "13px", marginTop: "4px" }}>
                    Configure the order parameters on the left and click "Run Order Automation" to test live credit issuance.
                  </div>
                </div>
              ) : (
                <s-stack direction="block" gap="base">
                  {result.rewarded ? (
                    <s-banner tone="success" heading="Store Credit Awarded!">
                      Successfully credited <strong>${result.amountAwarded?.toFixed(2)}</strong> store credit to {selectedCustomer?.displayName}.
                    </s-banner>
                  ) : (
                    <s-banner tone="warning" heading="No Credit Awarded">
                      Order processed, but no active rules matched the order thresholds.
                    </s-banner>
                  )}

                  <s-divider />

                  <s-stack direction="block" gap="tight">
                    <s-text><strong>Applied Loyalty Tier:</strong></s-text>
                    <s-badge tone="info">
                      {result.tierApplied ? `${result.tierApplied.name} (${result.tierApplied.cashbackRate}% Cashback)` : "Base Tier (5%)"}
                    </s-badge>
                  </s-stack>

                  <s-divider />

                  <s-stack direction="block" gap="tight">
                    <s-text><strong>Execution Breakdown & Steps:</strong></s-text>
                    {result.breakdown?.length > 0 ? (
                      result.breakdown.map((b, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "#f8fafc",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "13px",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{b.type}: </span>
                          <span style={{ color: "#475569" }}>{b.reason}</span>
                          {b.amount > 0 && (
                            <span style={{ color: "#16a34a", fontWeight: 700, marginLeft: "6px" }}>
                              (+${b.amount.toFixed(2)})
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <s-text tone="neutral">None</s-text>
                    )}
                  </s-stack>

                  <s-divider />

                  <s-stack direction="block" gap="extra-tight">
                    <s-text><strong>Shopify Transaction Confirmation:</strong></s-text>
                    <s-text tone="neutral">
                      Account ID: {result.result?.shopifyAccount?.id || "Auto-Created"}
                    </s-text>
                    <s-text tone="neutral">
                      Ledger Status: <strong>{result.result?.ledgerEntry?.status || "COMPLETED"}</strong>
                    </s-text>
                  </s-stack>
                </s-stack>
              )}
            </s-stack>
          </s-section>
        </s-grid>
      </div>
    </s-page>
  );
}
