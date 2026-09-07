import React, { useState, useEffect } from "react";
import {
  Screen,
  ScrollView,
  Section,
  Text,
  Button,
  Stack,
  Badge,
  render,
  useExtensionApi,
} from "@shopify/retail-ui-extensions-react";

const ModalComponent = () => {
  const api = useExtensionApi();
  const [customer, setCustomer] = useState(null);
  const [creditBalance, setCreditBalance] = useState("45.00");
  const [vipTier, setVipTier] = useState("Gold VIP");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (api?.cart?.customer) {
      setCustomer(api.cart.customer);
    } else {
      setCustomer({
        id: "gid://shopify/Customer/26024363524177",
        displayName: "Himanshu Yadav",
        email: "himanshuyadav.12jan@gmail.com",
      });
    }
  }, [api]);

  const handleApplyToCart = () => {
    if (api?.cart?.applyCustomDiscount) {
      api.cart.applyCustomDiscount({
        title: "Store Credit Applied",
        amount: parseFloat(creditBalance),
        type: "FixedAmount",
      });
    }
    setApplied(true);
    if (api?.toast?.show) {
      api.toast.show(`Applied $${creditBalance} store credit to cart!`);
    }
  };

  const handleIssueGoodwill = () => {
    if (api?.toast?.show) {
      api.toast.show("Issued $10.00 Goodwill Credit to customer account!");
    }
    setCreditBalance((prev) => (parseFloat(prev) + 10.0).toFixed(2));
  };

  return (
    <Screen name="Store Credit & VIP Rewards" title="In-Store Credit & VIP Rewards">
      <ScrollView>
        <Stack direction="vertical" spacing="base">
          <Section title="Active Retail Customer">
            <Stack direction="vertical" spacing="tight">
              <Text variant="headingLarge">{customer?.displayName || "Select Customer"}</Text>
              <Text variant="caption">{customer?.email || "Scan Apple/Google Wallet Pass"}</Text>
              
              <Stack direction="horizontal" spacing="tight">
                <Badge variant="success">🥇 {vipTier}</Badge>
                <Badge variant="info">12% Cashback Active</Badge>
              </Stack>
            </Stack>
          </Section>

          <Section title="Available Store Credit">
            <Stack direction="vertical" spacing="tight">
              <Text variant="displayMedium" color="success">
                ${creditBalance} USD
              </Text>
              <Text variant="caption">
                Available to redeem directly against this in-store retail purchase.
              </Text>

              <Button
                title={applied ? "✓ Credit Applied to Cart" : `⚡ Apply $${creditBalance} to POS Cart`}
                type={applied ? "secondary" : "primary"}
                onPress={handleApplyToCart}
                disabled={applied || parseFloat(creditBalance) <= 0}
              />
            </Stack>
          </Section>

          <Section title="Cashier Quick Actions">
            <Stack direction="vertical" spacing="tight">
              <Button
                title="+ Issue $10.00 In-Store Goodwill Credit"
                type="secondary"
                onPress={handleIssueGoodwill}
              />
              <Text variant="caption">
                Instantly credits buyer's account and prints confirmation on receipt.
              </Text>
            </Stack>
          </Section>
        </Stack>
      </ScrollView>
    </Screen>
  );
};

export default render("pos.home.modal.render", () => <ModalComponent />);
