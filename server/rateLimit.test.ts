import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp, phoneKey, resetRateLimits } from "./_core/rateLimit";

describe("rateLimit — checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests under the limit and blocks at the limit", () => {
    const now = () => 1_000_000;
    expect(checkRateLimit("t", "k", 3, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit("t", "k", 3, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit("t", "k", 3, 60_000, now).allowed).toBe(true);
    const fourth = checkRateLimit("t", "k", 3, 60_000, now);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("slides the window: old hits expire and free capacity", () => {
    let t = 0;
    const now = () => t;
    checkRateLimit("t", "k", 2, 1000, now); // t=0
    t = 400;
    checkRateLimit("t", "k", 2, 1000, now); // t=400 → full
    t = 900;
    expect(checkRateLimit("t", "k", 2, 1000, now).allowed).toBe(false);
    t = 1100; // first hit (t=0) expired
    expect(checkRateLimit("t", "k", 2, 1000, now).allowed).toBe(true);
  });

  it("isolates keys and buckets", () => {
    const now = () => 5;
    checkRateLimit("a", "key1", 1, 1000, now);
    expect(checkRateLimit("a", "key1", 1, 1000, now).allowed).toBe(false);
    expect(checkRateLimit("a", "key2", 1, 1000, now).allowed).toBe(true); // other key
    expect(checkRateLimit("b", "key1", 1, 1000, now).allowed).toBe(true); // other bucket
  });

  it("reports remaining capacity", () => {
    const now = () => 1;
    expect(checkRateLimit("t", "k", 5, 1000, now).remaining).toBe(4);
    expect(checkRateLimit("t", "k", 5, 1000, now).remaining).toBe(3);
  });
});

describe("rateLimit — key helpers", () => {
  it("phoneKey normalizes to last 10 digits", () => {
    expect(phoneKey("(862) 419-1763")).toBe("8624191763");
    expect(phoneKey("+18624191763")).toBe("8624191763");
    expect(phoneKey(null)).toBe("unknown-phone");
  });

  it("getClientIp prefers x-forwarded-for first hop", () => {
    const ctx = { req: { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, ip: "9.9.9.9" } } as never;
    expect(getClientIp(ctx)).toBe("1.2.3.4");
  });

  it("getClientIp falls back to req.ip then unknown", () => {
    expect(getClientIp({ req: { headers: {}, ip: "9.9.9.9" } } as never)).toBe("9.9.9.9");
    expect(getClientIp({ req: { headers: {} } } as never)).toBe("unknown-ip");
  });
});
