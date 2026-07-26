import { describe, it, expect } from "vitest";
import { canConfirmClose, normalizeReason, LOST_REASONS, WON_REASONS } from "./closeReasons";

describe("normalizeReason", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeReason("  went   with a\tcompetitor ")).toBe("went with a competitor");
  });
  it("maps blank/whitespace-only input to an empty string", () => {
    expect(normalizeReason("   ")).toBe("");
    expect(normalizeReason("")).toBe("");
  });
});

describe("canConfirmClose", () => {
  it("requires a non-empty reason to mark Lost", () => {
    expect(canConfirmClose("lost", "")).toBe(false);
    expect(canConfirmClose("lost", "   ")).toBe(false);
    expect(canConfirmClose("lost", "Price too high")).toBe(true);
  });

  it("allows marking Won with or without a reason", () => {
    expect(canConfirmClose("won", "")).toBe(true);
    expect(canConfirmClose("won", "Referral")).toBe(true);
  });
});

describe("suggested reasons", () => {
  it("offers non-empty, de-duplicated quick-pick lists", () => {
    for (const list of [LOST_REASONS, WON_REASONS]) {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
