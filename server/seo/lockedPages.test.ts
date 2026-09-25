import { describe, it, expect } from "vitest";
import { isStaticallyLocked, hashPagePath } from "./lockedPages";

describe("isStaticallyLocked — exact-path exclusion list (spec §2)", () => {
  it("locks every exact path in the spec's list", () => {
    for (const p of [
      "/", "/commercial", "/promos", "/courses", "/partnerships", "/referral",
      "/lp/referral-partner", "/qualify", "/assessment", "/terms", "/privacy",
      "/careers", "/testimonials", "/rebate-calculator", "/rebate-guide",
    ]) {
      expect(isStaticallyLocked(p).locked, p).toBe(true);
    }
  });

  it("locks /vs-* prefix pages (competitor comparisons)", () => {
    expect(isStaticallyLocked("/vs-aj-perri").locked).toBe(true);
    expect(isStaticallyLocked("/vs-anything-at-all").locked).toBe(true);
  });

  it("locks noindex routes (reusing PR-1's registry, not a second copy)", () => {
    expect(isStaticallyLocked("/lp/fb-commercial").locked).toBe(true);
    expect(isStaticallyLocked("/estimating").locked).toBe(true);
  });

  it("locks CRM/internal routes", () => {
    expect(isStaticallyLocked("/admin").locked).toBe(true);
    expect(isStaticallyLocked("/leads").locked).toBe(true);
    expect(isStaticallyLocked("/leads/123").locked).toBe(true);
  });

  it("locks every customer-facing Vapi/SMS/email send-target URL", () => {
    for (const p of ["/referral", "/qualify", "/assessment", "/rebate-calculator", "/pseg-rebate-contractor-nj", "/promos"]) {
      const result = isStaticallyLocked(p);
      expect(result.locked, p).toBe(true);
    }
  });

  it("locks the seeded claims-review pages (25C audit)", () => {
    expect(isStaticallyLocked("/hvac-newark-nj").locked).toBe(true);
    expect(isStaticallyLocked("/blog/federal-25c-tax-credit-hvac-2026").locked).toBe(true);
  });

  it("does NOT lock an ordinary, unflagged city page", () => {
    expect(isStaticallyLocked("/hvac-elizabeth-nj").locked).toBe(false);
  });

  it("does NOT lock an ordinary blog post", () => {
    expect(isStaticallyLocked("/blog/how-much-does-r22-replacement-cost-nj").locked).toBe(false);
  });

  it("ignores query strings and trailing slashes", () => {
    expect(isStaticallyLocked("/commercial?utm_source=x").locked).toBe(true);
    expect(isStaticallyLocked("/commercial/").locked).toBe(true);
  });

  it("every locked result includes a human-readable message and a typed reason", () => {
    const result = isStaticallyLocked("/qualify");
    expect(result.locked).toBe(true);
    if (result.locked) {
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.reason.kind).toBeTruthy();
    }
  });
});

describe("hashPagePath — seoPageTags/seoAuditLog's indexed key (pagePath itself is too long to index)", () => {
  it("is deterministic — same input, same hash", () => {
    expect(hashPagePath("/hvac-newark-nj")).toBe(hashPagePath("/hvac-newark-nj"));
  });

  it("is a 64-char lowercase hex sha256 digest", () => {
    expect(hashPagePath("/hvac-newark-nj")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different paths hash differently", () => {
    expect(hashPagePath("/hvac-newark-nj")).not.toBe(hashPagePath("/hvac-elizabeth-nj"));
  });

  it("normalizes before hashing — a trailing slash and a query string hash the same as the canonical path", () => {
    const canonical = hashPagePath("/commercial");
    expect(hashPagePath("/commercial/")).toBe(canonical);
    expect(hashPagePath("/commercial?utm_source=x")).toBe(canonical);
  });
});
