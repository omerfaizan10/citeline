import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  getClientKey,
  MAX_REQUESTS,
  WINDOW_MS,
} from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < MAX_REQUESTS; i++) checkRateLimit(key);
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < MAX_REQUESTS; i++) checkRateLimit(keyA);
    expect(checkRateLimit(keyA).allowed).toBe(false);
    expect(checkRateLimit(keyB).allowed).toBe(true);
  });

  it("never blocks loopback keys, used for local dev/eval testing", () => {
    for (let i = 0; i < MAX_REQUESTS + 10; i++) {
      expect(checkRateLimit("::1").allowed).toBe(true);
      expect(checkRateLimit("127.0.0.1").allowed).toBe(true);
    }
  });

  it("allows requests again once the window passes", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    for (let i = 0; i < MAX_REQUESTS; i++) checkRateLimit(key);
    expect(checkRateLimit(key).allowed).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS + 1);
    expect(checkRateLimit(key).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("getClientKey", () => {
  it("uses the first IP in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientKey(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientKey(headers)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(getClientKey(new Headers())).toBe("unknown");
  });
});
