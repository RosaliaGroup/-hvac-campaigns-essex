import { describe, it, expect } from "vitest";
import { lintSocialContent } from "./linter";

describe("lintSocialContent", () => {
  it("blocks a post with a price not in verified facts", () => {
    const result = lintSocialContent("Get your new heat pump for only $499 today!");
    expect(result.blocked).toBe(true);
    expect(result.reasons.some((r) => r.includes("price"))).toBe(true);
  });

  it("blocks a post that mentions a customer full name", () => {
    const result = lintSocialContent("Huge thanks to John Smith for trusting us with the install.");
    expect(result.blocked).toBe(true);
    expect(result.reasons.some((r) => r.includes("full name"))).toBe(true);
  });

  it("blocks a superlative claim", () => {
    const result = lintSocialContent("We're the #1 HVAC company in New Jersey!");
    expect(result.blocked).toBe(true);
    expect(result.reasons.some((r) => r.toLowerCase().includes("superlative"))).toBe(true);
  });

  it("blocks a non-canonical phone number", () => {
    const result = lintSocialContent("Call us today at (555) 123-4567 for a free quote!");
    expect(result.blocked).toBe(true);
    expect(result.reasons.some((r) => r.includes("phone"))).toBe(true);
  });

  it("blocks an expired-credit reference", () => {
    const result = lintSocialContent("Don't forget the 25C tax credit is still available!");
    expect(result.blocked).toBe(true);
    expect(result.reasons.some((r) => r.toLowerCase().includes("expired"))).toBe(true);
  });

  it("passes clean, facts-only content", () => {
    const result = lintSocialContent("PSE&G / NJ Clean Energy residential HVAC rebate: Up to $16,000. Ask us if your home qualifies.");
    expect(result.blocked).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("passes the canonical phone number", () => {
    const result = lintSocialContent("Call us at (862) 423-9396 to schedule your tune-up.");
    expect(result.blocked).toBe(false);
  });
});
