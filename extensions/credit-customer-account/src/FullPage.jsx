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

const APP_URL = "https://credit-shopify-app.onrender.com";

function FullPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      try {
        const token = await api.sessionToken.get();
        const resp = await fetch(`${APP_URL}/api/customer-account/wallet`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (!cancelled) {
          if (data.success) {
            setWallet(data.wallet);
          } else {
            setError(data.error || "Failed to load your store credit wallet");
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load your store credit wallet");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWallet();
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) {
    return (
      <Page title="My Store Credit & VIP Rewards">
        <BlockStack spacing="loose" inlineAlignment="center">
          <Text appearance="subdued">Loading your wallet…</Text>
        </BlockStack>
      </Page>
    );
  }

  if (error || !wallet) {
    return (
      <Page title="My Store Credit & VIP Rewards">
        <Banner status="critical" title="Couldn't load your wallet">
          {error || "Please try again shortly."}
        </Banner>
      </Page>
    );
  }

  return (
    <Page title="My Store Credit & VIP Rewards">
      <BlockStack spacing="loose">
        <Banner status="info" title="Store Credit Ready at Checkout">
          Your store credit automatically appears in your wallet and applies at 1-click checkout alongside discount codes!
        </Banner>

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

            <InlineStack spacing="base" blockAlignment="center">
              <Button kind="secondary" to={wallet.walletPassAppleUrl}>
                📲 Add to Apple Wallet
              </Button>
              <Button kind="secondary" to={wallet.walletPassGoogleUrl}>
                🤖 Save to Google Wallet
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

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
                  Spend ${wallet.tier.spendToNextTier} more to unlock {wallet.tier.nextTierName}!
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        <Card padding>
          <BlockStack spacing="base">
            <Heading level={2}>Recent Rewards Ledger</Heading>
            <Divider />

            {wallet.transactions.length === 0 ? (
              <Text appearance="subdued">No store credit activity yet.</Text>
            ) : (
              <BlockStack spacing="base">
                {wallet.transactions.map((tx) => (
                  <InlineStack key={tx.id} inlineAlignment="space-between" blockAlignment="center">
                    <BlockStack spacing="none">
                      <Text emphasis="bold">{tx.note}</Text>
                      <Text size="small" appearance="subdued">{tx.source} • {new Date(tx.createdAt).toLocaleDateString()}</Text>
                    </BlockStack>
                    <Text emphasis="bold" appearance={tx.action === "DEBIT" ? "critical" : "success"}>
                      {tx.action === "DEBIT" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)} USD
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export default reactExtension("customer-account.page.render", () => <FullPage />);
