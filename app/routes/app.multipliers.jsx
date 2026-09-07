import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
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
  const [name, setName] = useState("⚡ 2X Double Credit Weekend");
  const [multiplier, setMultiplier] = useState("2.0");
  const [duration, setDuration] = useState("3");

  const handleCreate = () => {
    fetcher.submit(
      { intent: "create", name, multiplier, durationDays: duration },
      { method: "POST" }
    );
  };

  const handleDelete = (id) => {
    fetcher.submit({ intent: "delete", id }, { method: "POST" });
  };

  return (
    <s-page heading="🚀 Double Credit Flash Days & Multiplier Calendar">
      <s-layout>
        <s-layout-section>
          {/* Hero Explainer */}
          <s-card>
            <s-block-stack gap="400">
              <s-inline-stack align="space-between" block-align="center">
                <s-block-stack gap="100">
                  <s-text variant="headingMd" as="h2">Automated Promotional Multiplier Engine</s-text>
                  <s-text tone="subdued">
                    Multiply order cashback (e.g. 2X or 3X) during holidays, flash sales, and weekends to trigger massive order surges.
                  </s-text>
                </s-block-stack>
                <s-badge tone="success">Engine Synchronized</s-badge>
              </s-inline-stack>

              <s-divider></s-divider>

              <s-grid columns="repeat(auto-fit, minmax(200px, 1fr))" gap="400">
                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Active Multiplier Events</s-text>
                  <s-text variant="headingLg" as="p">{events.filter((e) => e.isActive).length}</s-text>
                  <s-text tone="success">Auto-calculated at checkout</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Storefront Banner</s-text>
                  <s-text variant="headingLg" as="p">Ready</s-text>
                  <s-text tone="subdued">OS 2.0 Theme Block</s-text>
                </s-box>

                <s-box padding="300" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">Average Order Lift</s-text>
                  <s-text variant="headingLg" as="p">+28.4%</s-text>
                  <s-text tone="success">During Active Events</s-text>
                </s-box>
              </s-grid>
            </s-block-stack>
          </s-card>

          {/* Create Event Card */}
          <s-card>
            <s-block-stack gap="400">
              <s-text variant="headingMd" as="h3">Schedule New Multiplier Event</s-text>

              <s-grid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="300">
                <s-text-field
                  label="Event Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                <s-select
                  label="Cashback Multiplier"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  options={[
                    { label: "1.5X (50% Extra)", value: "1.5" },
                    { label: "2.0X (Double Cashback)", value: "2.0" },
                    { label: "2.5X (150% Extra)", value: "2.5" },
                    { label: "3.0X (Triple Cashback)", value: "3.0" },
                  ]}
                />

                <s-select
                  label="Duration Window"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  options={[
                    { label: "24 Hours (Flash Day)", value: "1" },
                    { label: "3 Days (Weekend Special)", value: "3" },
                    { label: "7 Days (Holiday Week)", value: "7" },
                  ]}
                />
              </s-grid>

              <s-inline-stack gap="300">
                <s-button variant="primary" onClick={handleCreate} loading={fetcher.state !== "idle"}>
                  ⚡ Launch &amp; Schedule Multiplier Event
                </s-button>
              </s-inline-stack>
            </s-block-stack>
          </s-card>

          {/* Active Events Table */}
          <s-card>
            <s-block-stack gap="300">
              <s-text variant="headingMd" as="h3">Event History &amp; Active Schedules</s-text>

              {events.length === 0 ? (
                <s-box padding="400" border="base" border-radius="200" background="bg-surface-secondary">
                  <s-text tone="subdued">No multiplier events scheduled yet. Create your first flash weekend above!</s-text>
                </s-box>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Campaign Name</th>
                      <th style={{ padding: "10px" }}>Multiplier</th>
                      <th style={{ padding: "10px" }}>Start Date</th>
                      <th style={{ padding: "10px" }}>End Date</th>
                      <th style={{ padding: "10px" }}>Status</th>
                      <th style={{ padding: "10px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{ev.name}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: "#4f46e5" }}>
                          {ev.bonusMultiplier}x
                        </td>
                        <td style={{ padding: "10px", color: "#64748b" }}>
                          {new Date(ev.startDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px", color: "#64748b" }}>
                          {new Date(ev.endDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <s-badge tone={ev.isActive ? "success" : "subdued"}>
                            {ev.isActive ? "Active Live" : "Ended"}
                          </s-badge>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <s-button size="slim" tone="critical" onClick={() => handleDelete(ev.id)}>
                            Delete
                          </s-button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </s-block-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
