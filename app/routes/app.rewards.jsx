import { useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

const REWARD_TRIGGERS = [
  { path: "/app/returns", label: "Save-the-Sale Returns", description: "Offer bonus store credit instead of a refund on returns and exchanges.", source: "REFUND_CREDIT" },
  { path: "/app/appeasements", label: "Support Appeasements", description: "1-click store credit for support agents to smooth over a bad experience.", source: "APPEASEMENT" },
  { path: "/app/birthdays", label: "Birthday Rewards", description: "Automated birthday credit drops on a short expiry window.", source: "BIRTHDAY_REWARD" },
  { path: "/app/reviews", label: "Review Rewards", description: "Reward customers with credit for verified reviews and UGC video.", source: "REVIEW_REWARD" },
  { path: "/app/subscriptions", label: "Subscription Perks", description: "Milestone credit rewards for subscription customers.", source: "SUBSCRIPTION_REWARD" },
  { path: "/app/scratch-card", label: "Scratch Card Leads", description: "Gamified scratch-card lead capture that awards store credit.", source: "SCRATCH_CARD" },
  { path: "/app/pos", label: "POS Extension", description: "Award and redeem store credit from the POS terminal.", source: "POS" },
];

export default function RewardTriggersHub() {
  const navigate = useNavigate();

  return (
    <s-page heading="Reward Triggers" inlineSize="large">
      <s-stack direction="block" gap="large">
        <s-banner tone="info" heading="Every way a customer can earn store credit">
          Each trigger below writes to the same store credit ledger. Open the ledger filtered to a trigger's activity from its card, or manage the trigger itself.
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
          {REWARD_TRIGGERS.map((trigger) => (
            <s-box key={trigger.path} padding="base" background="subdued" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-heading>{trigger.label}</s-heading>
                <s-text tone="neutral" color="subdued">{trigger.description}</s-text>
                <s-stack direction="inline" gap="small">
                  <s-button variant="primary" onClick={() => navigate(trigger.path)}>Open</s-button>
                  <s-button onClick={() => navigate(`/app/ledger?source=${trigger.source}`)}>View in ledger</s-button>
                </s-stack>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-stack>
    </s-page>
  );
}
