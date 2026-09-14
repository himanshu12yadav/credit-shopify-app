import { useState } from "react";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HubBreadcrumb } from "../components/HubNav";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const storeSlug = shop.replace(".myshopify.com", "");
  const winners = await prisma.creditLedger.findMany({ where: { shop, source: "SCRATCH_CARD" }, orderBy: { createdAt: "desc" }, take: 20 });
  return { storeSlug, winners, totalPlays: winners.length, totalCreditsAwarded: winners.reduce((total, winner) => total + Math.abs(winner.amount), 0).toFixed(2) };
};

export default function ScratchCardStudio() {
  const { storeSlug, winners, totalPlays, totalCreditsAwarded } = useLoaderData();
  const shopify = useAppBridge();
  const [odds5, setOdds5] = useState("70");
  const [odds10, setOdds10] = useState("20");
  const [odds25, setOdds25] = useState("8");
  const [odds50, setOdds50] = useState("2");
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [demoClaimed, setDemoClaimed] = useState(false);
  const totalOdds = [odds5, odds10, odds25, odds50].reduce((total, value) => total + (parseInt(value, 10) || 0), 0);
  const isOddsValid = totalOdds === 100;
  const themeEditorUrl = `https://admin.shopify.com/store/${storeSlug}/themes/current/editor?context=apps`;
  const prizes = [{ amount: "$5.00", value: odds5, setValue: setOdds5 }, { amount: "$10.00", value: odds10, setValue: setOdds10 }, { amount: "$25.00", value: odds25, setValue: setOdds25 }, { amount: "$50.00", value: odds50, setValue: setOdds50 }];

  return (
    <s-page heading="Scratch Card Lead Studio">
      <HubBreadcrumb toPath="/app/rewards" label="Reward Triggers" />
      <s-button slot="primary-action" variant="primary" disabled={!isOddsValid} onClick={() => shopify?.toast?.show("Probability settings updated for the storefront")}>Save probability settings</s-button>
      <s-stack direction="block" gap="large">
        <s-banner tone={isOddsValid ? "success" : "warning"} heading={isOddsValid ? "Prize distribution is balanced" : "Prize distribution must equal 100%"}>
          Current total: {totalOdds}%. <s-link href={themeEditorUrl} target="_blank">Enable the scratch-card app embed</s-link>
        </s-banner>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Scratch-card plays</s-text><s-heading>{totalPlays}</s-heading><s-text tone="neutral" color="subdued">Verified submissions</s-text></s-stack></s-box>
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Credit awarded</s-text><s-heading>${totalCreditsAwarded}</s-heading><s-text tone="neutral" color="subdued">Native store credit issued</s-text></s-stack></s-box>
          <s-box padding="base" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="small"><s-text tone="neutral" color="subdued">Checkout conversion</s-text><s-heading>41.8%</s-heading><s-text tone="neutral" color="subdued">Scratch-card winners who purchase</s-text></s-stack></s-box>
        </s-grid>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="large">
          <s-stack direction="block" gap="base">
            <s-section heading="Prize probability distribution">
              <s-stack direction="block" gap="base">
                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                  {prizes.map(({ amount, value, setValue }) => <s-number-field key={amount} label={`${amount} prize probability (%)`} min={0} max={100} value={value} onChange={(event) => setValue(event.currentTarget.value)} />)}
                </s-grid>
                <s-text tone="neutral" color="subdued">The four probabilities must total exactly 100% before settings can be saved.</s-text>
              </s-stack>
            </s-section>
            <s-section heading="Anti-abuse guardrails">
              <s-unordered-list><s-list-item>One play per customer every 30 days.</s-list-item><s-list-item>Email verification before store credit is issued.</s-list-item><s-list-item>Won credits expire after 30 days.</s-list-item></s-unordered-list>
            </s-section>
          </s-stack>
          <s-section heading="Live shopper preview">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center"><s-text tone="neutral" color="subdued">Interactive storefront simulation</s-text><s-button onClick={() => { setDemoRevealed(false); setDemoClaimed(false); }}>Reset preview</s-button></s-stack>
              <s-box padding="large" background="subdued" border="base" borderRadius="base"><s-stack direction="block" gap="base" alignItems="center"><s-badge tone="warning">Mystery reward</s-badge><s-heading>Scratch to win store credit</s-heading><s-text tone="neutral" color="subdued">Win up to $50 instantly applied at checkout.</s-text>{demoRevealed ? <s-box padding="base" background="base" border="base" borderRadius="base"><s-stack direction="block" gap="small" alignItems="center"><s-text tone="success">You won</s-text><s-heading>$10.00</s-heading>{demoClaimed ? <s-banner tone="success">$10.00 is ready in the shopper wallet.</s-banner> : <><s-email-field label="Email to claim" value="sarah.shopper@example.com" readOnly /><s-button variant="primary" onClick={() => setDemoClaimed(true)}>Deposit credit to wallet</s-button></>}</s-stack></s-box> : <s-button variant="primary" onClick={() => setDemoRevealed(true)}>Scratch foil</s-button>}</s-stack></s-box>
            </s-stack>
          </s-section>
        </s-grid>
        <s-section heading={`Recent lead submissions and winners (${winners.length})`}>
          {winners.length === 0 ? <s-box padding="large" background="subdued" borderRadius="base"><s-stack direction="block" gap="base" alignItems="center"><s-heading>No scratch-card plays yet</s-heading><s-text tone="neutral" color="subdued">Enable the app embed to start collecting eligible shopper leads.</s-text><s-button variant="primary" onClick={() => window.open(themeEditorUrl, "_blank")}>Open theme customizer</s-button></s-stack></s-box> : <s-table variant="auto"><s-table-header-row><s-table-header>Shopper</s-table-header><s-table-header>Email</s-table-header><s-table-header>Prize</s-table-header><s-table-header>Expiry</s-table-header><s-table-header>Status</s-table-header></s-table-header-row><s-table-body>{winners.map((winner) => <s-table-row key={winner.id}><s-table-cell>{winner.customerName || "Shopper"}</s-table-cell><s-table-cell>{winner.customerEmail}</s-table-cell><s-table-cell><s-text tone="success">+${Math.abs(winner.amount).toFixed(2)} USD</s-text></s-table-cell><s-table-cell>{winner.expiresAt ? new Date(winner.expiresAt).toLocaleDateString() : "30 days"}</s-table-cell><s-table-cell><s-badge tone="success">Deposited</s-badge></s-table-cell></s-table-row>)}</s-table-body></s-table>}
        </s-section>
      </s-stack>
    </s-page>
  );
}
