import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings, init }) => {
  const sendTelemetry = (eventType, payload) => {
    try {
      const data = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        settings: settings || {},
        payload,
      });

      // Transmit non-blocking telemetry via sendBeacon if available, otherwise fetch
      if (browser?.sendBeacon) {
        browser.sendBeacon("/api/pixel/events", data);
      } else if (typeof fetch !== "undefined") {
        fetch("/api/pixel/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: data,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (err) {
      // Fail silently to guarantee zero interruption to buyer checkout experience
    }
  };

  // 1. Order Completed & Attribution
  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event?.data?.checkout || {};
    const discounts = checkout?.discountApplications || [];
    const hasCreditApplied = discounts.some((d) => 
      (d?.title && d.title.toLowerCase().includes("credit")) ||
      (d?.code && d.code.toLowerCase().includes("credit"))
    );

    sendTelemetry("checkout_completed", {
      orderId: checkout?.order?.id,
      token: checkout?.token,
      totalPrice: checkout?.totalPrice?.amount,
      currency: checkout?.totalPrice?.currencyCode,
      subtotalPrice: checkout?.subtotalPrice?.amount,
      discountCodes: discounts.map((d) => d.code || d.title),
      hasStoreCreditRedemption: hasCreditApplied,
      linesCount: checkout?.lineItems?.length || 0,
    });
  });

  // 2. Checkout Started (Funnel Analytics)
  analytics.subscribe("checkout_started", (event) => {
    const checkout = event?.data?.checkout || {};
    sendTelemetry("checkout_started", {
      token: checkout?.token,
      subtotalPrice: checkout?.subtotalPrice?.amount,
      currency: checkout?.totalPrice?.currencyCode,
      itemsCount: checkout?.lineItems?.length || 0,
    });
  });

  // 3. Cart Updates (Threshold & Cashback Nudges)
  analytics.subscribe("cart_updated", (event) => {
    const cart = event?.data?.cart || {};
    sendTelemetry("cart_updated", {
      totalCost: cart?.cost?.totalAmount?.amount,
      currency: cart?.cost?.totalAmount?.currencyCode,
      linesCount: cart?.lines?.length || 0,
    });
  });

  // 4. Product Viewed (Intent & AI Retention Signals)
  analytics.subscribe("product_viewed", (event) => {
    const productVariant = event?.data?.productVariant || {};
    sendTelemetry("product_viewed", {
      productId: productVariant?.product?.id,
      productTitle: productVariant?.product?.title,
      price: productVariant?.price?.amount,
      currency: productVariant?.price?.currencyCode,
    });
  });

  // 5. Custom App Events (Gamified Scratch Cards, Tier Unlocks, Quick-Redeem Telemetry)
  analytics.subscribe("custom_event", (event) => {
    sendTelemetry("custom_app_event", {
      customName: event?.name,
      customPayload: event?.customData,
    });
  });
});
