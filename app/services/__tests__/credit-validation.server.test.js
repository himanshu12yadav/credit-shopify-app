import { describe, it, expect } from "vitest";
import { assertValidCreditAmount, CreditValidationError, isDuplicateIdempotencyError } from "../credit-validation.server";

describe("assertValidCreditAmount", () => {
  it("accepts a valid amount and normalizes it to 2 decimal places", () => {
    expect(assertValidCreditAmount(10)).toBe(10);
    expect(assertValidCreditAmount("10.004")).toBe(10);
    expect(assertValidCreditAmount(10.999)).toBe(11);
  });

  it("rejects zero, negative, NaN, and non-numeric input", () => {
    expect(() => assertValidCreditAmount(0)).toThrow(CreditValidationError);
    expect(() => assertValidCreditAmount(-5)).toThrow(CreditValidationError);
    expect(() => assertValidCreditAmount(NaN)).toThrow(CreditValidationError);
    expect(() => assertValidCreditAmount("not a number")).toThrow(CreditValidationError);
    expect(() => assertValidCreditAmount(undefined)).toThrow(CreditValidationError);
  });

  it("enforces the per-source default ceiling", () => {
    expect(() => assertValidCreditAmount(999, { source: "SCRATCH_CARD" })).toThrow(CreditValidationError);
    expect(assertValidCreditAmount(50, { source: "SCRATCH_CARD" })).toBe(50);
  });

  it("enforces an explicit max override even when higher than the source default", () => {
    expect(assertValidCreditAmount(5000, { source: "SCRATCH_CARD", max: 10000 })).toBe(5000);
  });

  it("falls back to a sane ceiling for an unknown source", () => {
    expect(() => assertValidCreditAmount(1_000_000, { source: "SOME_UNKNOWN_SOURCE" })).toThrow(CreditValidationError);
  });
});

describe("isDuplicateIdempotencyError", () => {
  it("recognizes a Prisma P2002 unique-constraint violation on idempotencyKey", () => {
    expect(isDuplicateIdempotencyError({ code: "P2002", meta: { target: "idempotencyKey" } })).toBe(true);
    expect(isDuplicateIdempotencyError({ code: "P2002", meta: { target: ["idempotencyKey"] } })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isDuplicateIdempotencyError({ code: "P2002", meta: { target: "email" } })).toBe(false);
    expect(isDuplicateIdempotencyError({ code: "P2025" })).toBe(false);
    expect(isDuplicateIdempotencyError(new Error("boom"))).toBe(false);
    expect(isDuplicateIdempotencyError(null)).toBe(false);
  });
});
