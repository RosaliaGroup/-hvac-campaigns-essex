import { describe, it, expect, vi } from "vitest";

vi.mock("../../../db", () => ({ getDb: vi.fn(async () => null) }));
vi.mock("../auditLog", () => ({ logAudit: vi.fn(async () => {}) }));

import { canReleaseOwnerDecisionItem, submitOwnerDecisionValue, OwnerDecisionValueRequiredError } from "./ownerDecision";

describe("canReleaseOwnerDecisionItem (§7: an owner-decision item never publishes while its facts value is null)", () => {
  it("is not releasable while facts-blocked and ownerDecisionValue is null", () => {
    expect(canReleaseOwnerDecisionItem({ factsBlocked: true, ownerDecisionValue: null })).toBe(false);
  });

  it("is not releasable while facts-blocked and ownerDecisionValue is an empty/whitespace string", () => {
    expect(canReleaseOwnerDecisionItem({ factsBlocked: true, ownerDecisionValue: "   " })).toBe(false);
  });

  it("is releasable once facts-blocked and ownerDecisionValue is set", () => {
    expect(canReleaseOwnerDecisionItem({ factsBlocked: true, ownerDecisionValue: "$4,500-$6,000" })).toBe(true);
  });

  it("a non-facts-blocked item is always releasable", () => {
    expect(canReleaseOwnerDecisionItem({ factsBlocked: false, ownerDecisionValue: null })).toBe(true);
  });
});

describe("submitOwnerDecisionValue", () => {
  it("throws OwnerDecisionValueRequiredError for a blank value, never touching the DB", async () => {
    await expect(submitOwnerDecisionValue(1, "   ", null)).rejects.toThrow(OwnerDecisionValueRequiredError);
  });
});
