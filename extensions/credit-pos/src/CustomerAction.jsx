import React, { useEffect, useState } from "react";
import {
  Navigator,
  Screen,
  ScrollView,
  Section,
  Text,
  Stack,
  Badge,
  reactExtension,
  useApi,
} from "@shopify/ui-extensions-react/point-of-sale";

const APP_URL = "https://credit-shopify-app.onrender.com";

const CustomerActionComponent = () => {
  const api = useApi();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      try {
        const customerId = api?.customer?.id;
        if (!customerId) return;
        const token = await api.session.getSessionToken();
        const resp = await fetch(
          `${APP_URL}/api/pos/credit?customerId=${encodeURIComponent(`gid://shopify/Customer/${customerId}`)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        if (!cancelled && data.success) {
          setCustomer(data.customer);
        }
      } catch (err) {
        console.error("Failed to load customer credit profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <Navigator initialScreenName="profile">
      <Screen name="profile" title="Store Credit & VIP Profile">
        <ScrollView>
          <Stack direction="block" gap="base">
            <Section title="Store Credit Balance">
              <Stack direction="block" gap="small">
                <Text variant="display" color="TextSuccess">
                  {loading ? "…" : `$${customer?.creditBalance || "0.00"} ${customer?.currency || "USD"}`}
                </Text>
              </Stack>
            </Section>
            <Section title="VIP Status">
              <Stack direction="block" gap="small">
                <Badge text={`🥇 ${customer?.tierName || "Bronze VIP"}`} variant="success" />
                <Text variant="captionRegular">{customer?.cashbackRate || 5}% cashback on future orders</Text>
              </Stack>
            </Section>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension("pos.customer-details.action.render", () => <CustomerActionComponent />);
