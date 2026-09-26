import { describe, it, expect } from "vitest";
import { isAutomatedContactAllowed, isRecentCustomerTransaction, parseConsentColumn } from "./growthConsent";

describe("isAutomatedContactAllowed", () => {
  it("allows customer and opt_in", () => {
    expect(isAutomatedContactAllowed("customer")).toBe(true);
    expect(isAutomatedContactAllowed("opt_in")).toBe(true);
  });
  it("blocks unknown — the National-DNC default-safe rule (spec §0/§11)", () => {
    expect(isAutomatedContactAllowed("unknown")).toBe(false);
  });
});

describe("isRecentCustomerTransaction", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("true within 18 months", () => {
    expect(isRecentCustomerTransaction(new Date("2025-06-01T00:00:00Z"), now)).toBe(true);
  });
  it("false past 18 months", () => {
    expect(isRecentCustomerTransaction(new Date("2024-01-01T00:00:00Z"), now)).toBe(false);
  });
  it("false for null", () => {
    expect(isRecentCustomerTransaction(null, now)).toBe(false);
  });
});

describe("parseConsentColumn", () => {
  it("parses customer/opt_in case-insensitively", () => {
    expect(parseConsentColumn("Customer")).toBe("customer");
    expect(parseConsentColumn("OPT_IN")).toBe("opt_in");
    expect(parseConsentColumn("opt-in")).toBe("opt_in");
  });
  it("fails closed to unknown for anything else — including empty/garbage", () => {
    expect(parseConsentColumn("")).toBe("unknown");
    expect(parseConsentColumn(undefined)).toBe("unknown");
    expect(parseConsentColumn("maybe")).toBe("unknown");
  });
});
