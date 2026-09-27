import { describe, it, expect, vi, afterEach } from "vitest";
import { isRateLimited, getClientIp } from "../rate-limit.server";

describe("isRateLimited", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit and blocks once the limit is exceeded", () => {
    const key = `test-key-${Math.random()}`;
    const opts = { windowMs: 60_000, max: 3 };

    expect(isRateLimited(key, opts)).toBe(false); // 1st
    expect(isRateLimited(key, opts)).toBe(false); // 2nd
    expect(isRateLimited(key, opts)).toBe(false); // 3rd
    expect(isRateLimited(key, opts)).toBe(true); // 4th — over the limit
  });

  it("resets the count once the window has elapsed", () => {
    vi.useFakeTimers();
    const key = `test-key-${Math.random()}`;
    const opts = { windowMs: 1000, max: 1 };

    expect(isRateLimited(key, opts)).toBe(false);
    expect(isRateLimited(key, opts)).toBe(true);

    vi.advanceTimersByTime(1001);

    expect(isRateLimited(key, opts)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const opts = { windowMs: 60_000, max: 1 };
    const keyA = `key-a-${Math.random()}`;
    const keyB = `key-b-${Math.random()}`;

    expect(isRateLimited(keyA, opts)).toBe(false);
    expect(isRateLimited(keyB, opts)).toBe(false);
    expect(isRateLimited(keyA, opts)).toBe(true);
    expect(isRateLimited(keyB, opts)).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry of X-Forwarded-For", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    const withRealIp = new Request("https://example.com", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(withRealIp)).toBe("9.9.9.9");

    const withNothing = new Request("https://example.com");
    expect(getClientIp(withNothing)).toBe("unknown");
  });
});
