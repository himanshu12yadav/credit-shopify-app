import React, { useState, useEffect } from "react";
import {
  reactExtension,
  Page,
  Card,
  BlockStack,
  InlineStack,
  Heading,
  Text,
  Badge,
  Button,
  Divider,
  Banner,
  useApi,
} from "@shopify/ui-extensions-react/customer-account";

function FullPage() {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState({
    balance: "45.00",
    currency: "USD",
    tier: {
      name: "Gold VIP",
      cashbackRate: 12.0,
      nextTierName: "Platinum VIP",
      spendToNextTier: "155.00",
    },
    transactions: [
      { id: "tx-1", action: "CREDIT", amount: 15.0, source: "CASHBACK", note: "Cashback from Order #1002", createdAt: "2026-09-07" },
      { id: "tx-2", action: "CREDIT", amount: 20.0, source: "CAMPAIGN", note: "Holiday VIP Drop", createdAt: "2026-09-05" },
      { id: "tx-3", action: "CREDIT", amount: 10.0, source: "RETURN_BONUS", note: "+20% Store Credit Return Bonus", createdAt: "2026-09-01" },
    ],
  });

  return (
    <Page title="My Store Credit & VIP Rewards">
      <BlockStack spacing="loose">
        {/* Banner Alert */}
        <Banner status="info" title="Store Credit Ready at Checkout">
          Your store credit automatically appears in your wallet and applies at 1-click checkout alongside discount codes!
        </Banner>

        {/* Hero Balance Card */}
        <Card padding>
          <BlockStack spacing="base">
            <InlineStack inlineAlignment="space-between" blockAlignment="center">
              <BlockStack spacing="tight">
                <Text size="small" appearance="subdued">AVAILABLE STORE CREDIT</Text>
                <Heading level={1}>
                  ${wallet.balance} <Text size="medium" appearance="subdued">{wallet.currency}</Text>
                </Heading>
              </BlockStack>
              <Badge tone="success">Active Balance</Badge>
            </InlineStack>

            <Divider />

            {/* Quick Mobile Wallet Pass Action */}
            <InlineStack spacing="base" blockAlignment="center">
              <Button
                kind="secondary"
                to="https://credit-shopify-app.onrender.com/api/storefront/wallet-pass?format=apple"
              >
                📲 Add to Apple Wallet
              </Button>
              <Button
                kind="secondary"
                to="https://credit-shopify-app.onrender.com/api/storefront/wallet-pass?format=google"
              >
                🤖 Save to Google Wallet
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* VIP Loyalty Tier Card */}
        <Card padding>
          <BlockStack spacing="base">
            <InlineStack inlineAlignment="space-between" blockAlignment="center">
              <Heading level={2}>VIP Loyalty Status</Heading>
              <Badge tone="warning">🥇 {wallet.tier.name}</Badge>
            </InlineStack>

            <Text>
              You are currently earning a boosted <Text emphasis="bold">{wallet.tier.cashbackRate}% store credit cashback</Text> on every single order!
            </Text>

            {wallet.tier.nextTierName && (
              <BlockStack spacing="tight">
                <Text size="small" appearance="subdued">
                  Spend ${wallet.tier.spendToNextTier} more to unlock {wallet.tier.nextTierName} & 15% cashback!
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Recent Transaction Ledger */}
        <Card padding>
          <BlockStack spacing="base">
            <Heading level={2}>Recent Rewards Ledger</Heading>
            <Divider />

            <BlockStack spacing="base">
              {wallet.transactions.map((tx) => (
                <InlineStack key={tx.id} inlineAlignment="space-between" blockAlignment="center">
                  <BlockStack spacing="none">
                    <Text emphasis="bold">{tx.note}</Text>
                    <Text size="small" appearance="subdued">{tx.source} • {tx.createdAt}</Text>
                  </BlockStack>
                  <Text emphasis="bold" appearance="success">
                    +${tx.amount.toFixed(2)} USD
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export default reactExtension("customer-account.page.render", () => <FullPage />);
