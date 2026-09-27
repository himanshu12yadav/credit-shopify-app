import React, { useEffect, useState } from "react";
import {
  Navigator,
  Screen,
  ScrollView,
  Section,
  Text,
  Button,
  Stack,
  Badge,
  reactExtension,
  useApi,
  useCartSubscription,
} from "@shopify/ui-extensions-react/point-of-sale";

const APP_URL = "https://credit-shopify-app.onrender.com";
const GOODWILL_CREDIT_AMOUNT = "10.00";

const ModalComponent = () => {
  const api = useApi();
  const cart = useCartSubscription();
  const cartCustomerId = cart?.customer?.id ? `gid://shopify/Customer/${cart.customer.id}` : null;

  const [customer, setCustomer] = useState(null);
  const [creditBalance, setCreditBalance] = useState("0.00");
  const [vipTier, setVipTier] = useState("Bronze VIP");
  const [applied, setApplied] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      if (!cartCustomerId) return;
      try {
        const token = await api.session.getSessionToken();
        const resp = await fetch(
          `${APP_URL}/api/pos/credit?customerId=${encodeURIComponent(cartCustomerId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        if (!cancelled && data.success) {
          setCustomer(data.customer);
          setCreditBalance(data.customer.creditBalance || "0.00");
          setVipTier(data.customer.tierName || "Bronze VIP");
        }
      } catch (err) {
        console.error("Failed to load POS customer credit:", err);
      }
    }

    loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [api, cartCustomerId]);

  const handleApplyToCart = async () => {
    const balanceNumber = parseFloat(creditBalance);
    if (!balanceNumber || balanceNumber <= 0) return;
    try {
      await api.cart.applyCartDiscount("FixedAmount", "Store Credit Applied", balanceNumber.toFixed(2));
      setApplied(true);
    } catch (err) {
      console.error("Failed to apply store credit discount:", err);
    }
  };

  const handleIssueGoodwill = async () => {
    if (!cartCustomerId) {
      setError("Select a customer on the cart before issuing goodwill credit");
      return;
    }
    setIssuing(true);
    setError(null);
    try {
      const token = await api.session.getSessionToken();
      const resp = await fetch(`${APP_URL}/api/pos/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: cartCustomerId,
          customerEmail: customer?.email,
          amount: GOODWILL_CREDIT_AMOUNT,
          note: "In-store goodwill gesture",
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed to issue credit");
      }
      setCreditBalance((prev) => (parseFloat(prev || "0") + parseFloat(GOODWILL_CREDIT_AMOUNT)).toFixed(2));
    } catch (err) {
      setError(err.message || "Failed to issue credit");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Navigator initialScreenName="main">
      <Screen name="main" title="In-Store Credit & VIP Rewards">
        <ScrollView>
          <Stack direction="block" gap="base">
            <Section title="Active Retail Customer">
              <Stack direction="block" gap="small">
                <Text variant="headingLarge">{customer?.displayName || "No customer on cart"}</Text>
                <Text variant="captionRegular">{customer?.email || "Add a customer to the cart to look up their wallet"}</Text>
                <Stack direction="inline" gap="small">
                  <Badge text={`🥇 ${vipTier}`} variant="success" />
                </Stack>
              </Stack>
            </Section>

            <Section title="Available Store Credit">
              <Stack direction="block" gap="small">
                <Text variant="display" color="TextSuccess">
                  ${creditBalance} USD
                </Text>
                <Text variant="captionRegular">
                  Available to redeem directly against this in-store retail purchase.
                </Text>
                {error && (
                  <Text variant="captionMedium" color="TextCritical">
                    {error}
                  </Text>
                )}
                <Button
                  title={applied ? "✓ Credit Applied to Cart" : `⚡ Apply $${creditBalance} to POS Cart`}
                  type={applied ? "basic" : "primary"}
                  onPress={handleApplyToCart}
                  isDisabled={applied || parseFloat(creditBalance) <= 0}
                />
              </Stack>
            </Section>

            <Section title="Cashier Quick Actions">
              <Stack direction="block" gap="small">
                <Button
                  title={`+ Issue $${GOODWILL_CREDIT_AMOUNT} In-Store Goodwill Credit`}
                  type="basic"
                  isLoading={issuing}
                  isDisabled={!cartCustomerId}
                  onPress={handleIssueGoodwill}
                />
                <Text variant="captionRegular">
                  {"Instantly credits the buyer’s account via the store credit ledger."}
                </Text>
              </Stack>
            </Section>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension("pos.home.modal.render", () => <ModalComponent />);
