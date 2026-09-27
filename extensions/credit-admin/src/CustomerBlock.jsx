import React, { useEffect, useState } from "react";
import {
  reactExtension,
  AdminBlock,
  BlockStack,
  InlineStack,
  Heading,
  Text,
  Badge,
  Button,
  useApi,
} from "@shopify/ui-extensions-react/admin";

const APP_URL = "https://credit-shopify-app.onrender.com";

function CustomerDetailsBlock() {
  const api = useApi();
  const [credit, setCredit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      try {
        const customerId = api?.data?.selected?.[0]?.id;
        if (!customerId) return;

        const token = await api.idToken();
        const response = await fetch(
          `${APP_URL}/api/admin/customer-credit?customerId=${encodeURIComponent(customerId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const result = await response.json();
        if (!cancelled && result.success) {
          setCredit(result.customer);
        }
      } catch (err) {
        console.error("Failed to load store credit balance:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const balance = credit?.balance ?? "0.00";
  const currency = credit?.currency ?? "USD";
  const tier = credit?.tierName ?? "Bronze VIP";
  const cashbackRate = credit?.cashbackRate ?? 5.0;

  return (
    <AdminBlock title="Store Credit & VIP Rewards">
      <BlockStack gap>
        <InlineStack inlineAlignment="space-between" blockAlignment="center">
          <BlockStack gap="none">
            <Text tone="subdued">Available Store Credit</Text>
            <Heading size="medium" tone="success">
              {loading ? "…" : `${currency} ${parseFloat(balance).toFixed(2)}`}
            </Heading>
          </BlockStack>
          <Badge tone="success">Active Balance</Badge>
        </InlineStack>

        <InlineStack inlineAlignment="space-between" blockAlignment="center">
          <BlockStack gap="none">
            <Text tone="subdued">VIP Status Level</Text>
            <Text fontWeight="bold">🥇 {tier} ({cashbackRate}% Cashback)</Text>
          </BlockStack>
        </InlineStack>

        <InlineStack inlineAlignment="end">
          <Button
            variant="secondary"
            onPress={() => {
              if (api?.navigation?.navigate) {
                api.navigation.navigate("admin.customer-details.action.render");
              }
            }}
          >
            ⚡ Issue Store Credit Appeasement
          </Button>
        </InlineStack>
      </BlockStack>
    </AdminBlock>
  );
}

export default reactExtension("admin.customer-details.block.render", () => <CustomerDetailsBlock />);
