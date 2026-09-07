import React, { useState } from "react";
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

function CustomerDetailsBlock() {
  const api = useApi();
  const [balance, setBalance] = useState("45.00");
  const [tier, setTier] = useState("Gold VIP");
  const [cashbackRate, setCashbackRate] = useState("12%");

  return (
    <AdminBlock title="Store Credit & VIP Rewards">
      <BlockStack gap>
        <InlineStack inlineAlignment="space-between" blockAlignment="center">
          <BlockStack gap="none">
            <Text tone="subdued">Available Store Credit</Text>
            <Heading size="medium" tone="success">
              ${balance} USD
            </Heading>
          </BlockStack>
          <Badge tone="success">Active Balance</Badge>
        </InlineStack>

        <InlineStack inlineAlignment="space-between" blockAlignment="center">
          <BlockStack gap="none">
            <Text tone="subdued">VIP Status Level</Text>
            <Text fontWeight="bold">🥇 {tier} ({cashbackRate} Cashback)</Text>
          </BlockStack>
          <Badge tone="info">Top 5% Spender</Badge>
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
