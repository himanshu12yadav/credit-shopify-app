import React, { useState } from "react";
import {
  reactExtension,
  AdminAction,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  useApi,
} from "@shopify/ui-extensions-react/admin";

const APP_URL = "https://credit-shopify-app.onrender.com";

function CustomerDetailsAction() {
  const api = useApi();
  const [amount, setAmount] = useState("10.00");
  const [reason, setReason] = useState("Shipping Delay (+$10)");
  const [issued, setIssued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleIssue = async () => {
    setLoading(true);
    setError(null);

    try {
      const customerId = api?.data?.selected?.[0]?.id;
      if (!customerId) {
        throw new Error("No customer selected");
      }

      const token = await api.idToken();
      const response = await fetch(`${APP_URL}/api/admin/customer-credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customerId, amount, reason }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to issue credit");
      }

      setIssued(true);
    } catch (err) {
      setError(err.message || "Failed to issue credit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAction
      title="Issue Store Credit Appeasement"
      primaryAction={
        <Button
          variant="primary"
          loading={loading}
          disabled={issued}
          onPress={handleIssue}
        >
          {issued ? "✓ Credit Issued" : `Issue $${amount} to Customer`}
        </Button>
      }
      secondaryAction={
        <Button onPress={() => api?.close && api.close()}>
          Close
        </Button>
      }
    >
      <BlockStack gap>
        {error && (
          <Banner tone="critical" title="Could not issue credit">
            {error}
          </Banner>
        )}
        {issued ? (
          <Banner tone="success" title="Store Credit Added Successfully">
            {`$${amount} USD store credit has been credited directly to the customer’s wallet and recorded in the audit ledger.`}
          </Banner>
        ) : (
          <BlockStack gap>
            <Text>
              {"Select an appeasement reason or quick amount to immediately credit this buyer’s account without leaving Shopify Admin:"}
            </Text>

            <InlineStack gap>
              <Button
                variant={amount === "10.00" ? "primary" : "secondary"}
                onPress={() => {
                  setAmount("10.00");
                  setReason("Shipping Delay (+$10)");
                }}
              >
                📦 Shipping Delay ($10)
              </Button>

              <Button
                variant={amount === "15.00" ? "primary" : "secondary"}
                onPress={() => {
                  setAmount("15.00");
                  setReason("Damaged Item Perk (+$15)");
                }}
              >
                💔 Damaged Item ($15)
              </Button>

              <Button
                variant={amount === "25.00" ? "primary" : "secondary"}
                onPress={() => {
                  setAmount("25.00");
                  setReason("VIP Loyalty Goodwill (+$25)");
                }}
              >
                ⭐ VIP Goodwill ($25)
              </Button>
            </InlineStack>

            <Banner tone="info" title="Zero Cashout Protection">
              Store credit appeasements protect your cash margins by keeping customer funds inside your store for their next repurchase.
            </Banner>
          </BlockStack>
        )}
      </BlockStack>
    </AdminAction>
  );
}

export default reactExtension("admin.customer-details.action.render", () => <CustomerDetailsAction />);
