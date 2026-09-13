import React from "react";
import {
  reactExtension,
  Card,
  BlockStack,
  InlineStack,
  Heading,
  Text,
  Badge,
  Button,
} from "@shopify/ui-extensions-react/customer-account";

function OrderStatusBlock() {
  return (
    <Card padding>
      <BlockStack spacing="tight">
        <InlineStack inlineAlignment="space-between" blockAlignment="center">
          <InlineStack spacing="tight" blockAlignment="center">
            <Heading level={3}>🎉 Store Credit Cashback Earned</Heading>
            <Badge tone="success">+5% Cashback</Badge>
          </InlineStack>
        </InlineStack>
        <Text>
          This purchase qualified for instant store credit. Your balance is ready to spend on your next order or in-store retail checkout!
        </Text>
        <InlineStack spacing="tight">
          <Button kind="plain" to="extension:credit-customer-account/">
            View My Rewards Wallet →
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export default reactExtension("customer-account.order-status.block.render", () => <OrderStatusBlock />);
