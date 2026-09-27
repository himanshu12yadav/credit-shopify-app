import React, { useState } from "react";
import {
  reactExtension,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
} from "@shopify/ui-extensions-react/checkout";

// NOTE: this block currently shows a static placeholder balance and does not
// call any Checkout API to actually apply store credit to the order total —
// native Shopify Store Credit Accounts are applied automatically by Shopify
// at checkout, so wiring this up for real requires deciding what, if
// anything, this block should add beyond that (e.g. a read-only balance
// display) rather than implying manual control that doesn't exist today.
const PLACEHOLDER_BALANCE = "45.00";

function CheckoutExtension() {
  const balance = PLACEHOLDER_BALANCE;
  const [applied, setApplied] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleApplyFull = () => {
    setApplied(true);
    setErrorMsg("");
  };

  const handleApplyCustom = () => {
    const val = parseFloat(customAmount);
    if (!val || val <= 0 || val > parseFloat(balance)) {
      setErrorMsg(`Please enter an amount between $1.00 and $${balance}`);
      return;
    }
    setApplied(true);
    setErrorMsg("");
  };

  const handleRemove = () => {
    setApplied(false);
    setCustomAmount("");
  };

  return (
    <BlockStack spacing="base" border="base" padding="base" cornerRadius="base">
      <InlineStack inlineAlignment="space-between" blockAlignment="center">
        <InlineStack spacing="tight" blockAlignment="center">
          <Text size="base" emphasis="bold">💳 Store Credit Wallet</Text>
        </InlineStack>
        <Text size="base" emphasis="bold" appearance="success">
          ${balance} USD Available
        </Text>
      </InlineStack>

      {applied ? (
        <Banner status="success" title="Store Credit Applied to Checkout">
          <InlineStack inlineAlignment="space-between" blockAlignment="center">
            <Text>
              ${customAmount ? parseFloat(customAmount).toFixed(2) : balance} deducted from your order total.
            </Text>
            <Button kind="plain" onPress={handleRemove}>
              Remove
            </Button>
          </InlineStack>
        </Banner>
      ) : (
        <BlockStack spacing="tight">
          <Text size="small" appearance="subdued">
            Apply your native store credit balance directly against this purchase. Stacks with all coupons!
          </Text>

          <InlineStack spacing="base" blockAlignment="center">
            <Button kind="primary" onPress={handleApplyFull}>
              ⚡ Apply All (${balance})
            </Button>

            <InlineStack spacing="tight" blockAlignment="center">
              <TextField
                label="Amount"
                value={customAmount}
                onChange={(val) => setCustomAmount(val)}
                placeholder="Or custom $"
              />
              <Button kind="secondary" onPress={handleApplyCustom}>
                Apply
              </Button>
            </InlineStack>
          </InlineStack>

          {errorMsg ? (
            <Text appearance="critical" size="small">
              {errorMsg}
            </Text>
          ) : null}
        </BlockStack>
      )}
    </BlockStack>
  );
}

export default reactExtension("purchase.checkout.block.render", () => <CheckoutExtension />);
