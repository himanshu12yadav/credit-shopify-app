// Klaviyo & Omnisend deep event synchronization service

export function formatKlaviyoCustomerProfile({ customerEmail, customerName, balance, tierName, expiresAt }) {
  const daysUntilExpiry = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    type: "profile",
    attributes: {
      email: customerEmail,
      first_name: customerName?.split(" ")[0] || "Shopper",
      properties: {
        store_credit_balance: parseFloat(balance).toFixed(2),
        store_credit_currency: "USD",
        vip_tier: tierName || "Bronze VIP",
        credit_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        days_until_credit_expiry: daysUntilExpiry,
        loyalty_member: true,
      },
    },
  };
}

export function formatKlaviyoEvent(eventName, { email, amount, balance, note, tierName }) {
  return {
    type: "event",
    attributes: {
      metric: { name: eventName },
      profile: { email },
      value: parseFloat(amount || 0),
      properties: {
        amount: parseFloat(amount || 0),
        new_balance: parseFloat(balance || 0),
        reason: note || "Loyalty perk",
        vip_tier: tierName || "Gold VIP",
        timestamp: new Date().toISOString(),
      },
    },
  };
}

export async function syncToKlaviyo(apiKey, payload) {
  if (!apiKey || apiKey === "demo") {
    // Simulated sandbox mode
    return { success: true, mode: "SANDBOX_SIMULATED", payload };
  }

  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: "2024-02-15",
      },
      body: JSON.stringify({ data: payload }),
    });

    const json = await res.json();
    return { success: res.ok, data: json };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
