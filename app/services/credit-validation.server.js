/**
 * Shared amount validation and duplicate-issuance guards for every code path
 * that mints or removes native Shopify store credit. Centralizing this closes
 * the gap where individual routes each hand-rolled (or skipped) their own
 * NaN/negative/upper-bound checks.
 */

// Per-source ceilings on a single credit issuance. Tune per merchant risk
// tolerance via CreditSettings in the future; these are conservative
// defaults that stop unbounded/attacker-controlled amounts today.
const DEFAULT_MAX_BY_SOURCE = {
  MANUAL: 500,
  RULE_AWARD: 1000,
  CASHBACK: 1000,
  REFUND_CREDIT: 5000,
  REFERRAL: 200,
  CAMPAIGN: 1000,
  FLOW_ACTION: 1000,
  SUBSCRIPTION_REWARD: 500,
  POS: 500,
  SCRATCH_CARD: 50,
  GIFT_CARD: 200,
  APPEASEMENT: 250,
};

const FALLBACK_MAX = 1000;

export class CreditValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CreditValidationError";
  }
}

/**
 * Validates and normalizes a requested credit/debit amount.
 * Throws CreditValidationError on any invalid input instead of letting
 * NaN/negative/oversized amounts reach the Shopify Admin API.
 */
export function assertValidCreditAmount(amount, { max, source } = {}) {
  const numeric = typeof amount === "number" ? amount : parseFloat(amount);

  if (!Number.isFinite(numeric)) {
    throw new CreditValidationError("Amount must be a valid number");
  }
  if (numeric <= 0) {
    throw new CreditValidationError("Amount must be greater than 0");
  }

  const ceiling = max ?? DEFAULT_MAX_BY_SOURCE[source] ?? FALLBACK_MAX;
  if (numeric > ceiling) {
    throw new CreditValidationError(`Amount exceeds the maximum allowed (${ceiling})`);
  }

  return Math.round(numeric * 100) / 100;
}

/**
 * True when a Prisma write failed because of the CreditLedger.idempotencyKey
 * unique constraint — i.e. this exact issuance was already recorded.
 */
export function isDuplicateIdempotencyError(err) {
  return Boolean(
    err &&
      err.code === "P2002" &&
      (err.meta?.target === "idempotencyKey" ||
        (Array.isArray(err.meta?.target) && err.meta.target.includes("idempotencyKey")))
  );
}
