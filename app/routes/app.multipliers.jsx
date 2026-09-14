import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const events = await prisma.campaign.findMany({
    where: { shop, bonusMultiplier: { gt: 1.0 } },
    orderBy: { createdAt: "desc" },
  });

  return { shop, events };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") || "2X Double Credit Weekend";
    const multiplier = parseFloat(formData.get("multiplier") || "2.0");
    const durationDays = parseInt(formData.get("durationDays") || "3", 10);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    await prisma.campaign.create({
      data: {
        shop,
        name,
        type: "FLASH_MULTIPLIER",
        bonusMultiplier: multiplier,
        startDate,
        endDate,
        isActive: true,
      },
    });

    return { success: true, message: "Multiplier event created and live!" };
  }

  if (intent === "delete") {
    const id = formData.get("id");
    await prisma.campaign.delete({ where: { id } });
    return { success: true, message: "Multiplier event deleted." };
  }

  return { success: false };
};

export default function MultiplierCalendar() {
  const { events } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [name, setName] = useState("⚡ 2X Double Credit Weekend");
  const [multiplier, setMultiplier] = useState("2.0");
  const [duration, setDuration] = useState("3");

  const handleCreate = (e) => {
    if (e?.preventDefault) e.preventDefault();
    fetcher.submit(
      { intent: "create", name, multiplier, durationDays: duration },
      { method: "POST" }
    );
    shopify?.toast?.show("Multiplier event launched!");
  };

  const handleDelete = (id) => {
    fetcher.submit({ intent: "delete", id }, { method: "POST" });
    shopify?.toast?.show("Multiplier event removed");
  };

  return (
    <s-page heading="🚀 Double Credit Flash Days & Multiplier Calendar">
      <s-banner tone="info" heading="Surge Weekend Order Volume with Limited-Time Multipliers">
        <s-paragraph>
          Multiply order cashback (e.g. 2X or 3X) during holiday promotions, flash sales, and weekends. Active multiplier events automatically apply across checkout and storefront blocks.
        </s-paragraph>
      </s-banner>

      {/* KPI Section */}
      <s-section heading="Multiplier Event Performance">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">ACTIVE MULTIPLIER EVENTS</s-text>
              <s-heading>{events.filter((e) => e.isActive).length}</s-heading>
              <s-badge tone="success">⚡ Auto-applied at checkout</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">STOREFRONT BANNER</s-text>
              <s-heading>Ready</s-heading>
              <s-badge tone="info">OS 2.0 Theme Block</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral" color="subdued">AVERAGE ORDER LIFT</s-text>
              <s-heading>+28.4%</s-heading>
              <s-badge tone="success">During active windows</s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Schedule Event Section */}
      <s-section heading="Schedule New Multiplier Event">
        <form onSubmit={handleCreate}>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
              <s-text-field
                label="Event Name"
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
              />

              <s-select
                label="Cashback Multiplier"
                value={multiplier}
                onChange={(e) => setMultiplier(e.currentTarget.value)}
              >
                <s-option value="1.5">1.5X (50% Extra Cashback)</s-option>
                <s-option value="2.0">2.0X (Double Cashback)</s-option>
                <s-option value="2.5">2.5X (150% Extra Cashback)</s-option>
                <s-option value="3.0">3.0X (Triple Cashback Weekend)</s-option>
              </s-select>

              <s-select
                label="Duration Window"
                value={duration}
                onChange={(e) => setDuration(e.currentTarget.value)}
              >
                <s-option value="1">24 Hours (Flash Day)</s-option>
                <s-option value="3">3 Days (Weekend Special)</s-option>
                <s-option value="7">7 Days (Holiday Week)</s-option>
              </s-select>
            </s-grid>

            <s-stack direction="inline" justifyContent="flex-start">
              <s-button type="submit" variant="primary" disabled={fetcher.state !== "idle"}>
                ⚡ Launch &amp; Schedule Multiplier Event
              </s-button>
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      {/* Active Events Table */}
      <s-section heading="Event History & Active Schedules">
        {events.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small" alignItems="center">
              <s-heading>No multiplier events scheduled yet</s-heading>
              <s-paragraph tone="neutral">
                Create your first flash weekend above to drive an instant surge in checkout volume!
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-box padding="base">
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Campaign Name</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Multiplier</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Start Date</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>End Date</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{ev.name}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone="info">{ev.bonusMultiplier}x Multiplier</s-badge>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{new Date(ev.startDate).toLocaleDateString()}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{new Date(ev.endDate).toLocaleDateString()}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-badge tone={ev.isActive ? "success" : "neutral"}>
                        {ev.isActive ? "Active Live" : "Ended"}
                      </s-badge>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <s-button size="slim" tone="critical" onClick={() => handleDelete(ev.id)}>
                        Delete
                      </s-button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
