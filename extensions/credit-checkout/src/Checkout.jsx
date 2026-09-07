import React, { useState } from "react";
import {
  reactExtension,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  useApi,
} from "@shopify/ui-extensions-react/checkout";

function CheckoutExtension() {
  const api = useApi();
  const [balance, setBalance] = useState("45.00");
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
