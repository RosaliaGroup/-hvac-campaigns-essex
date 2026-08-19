/**
 * Task 8B defect (b): a CRM-pushed estimate must not spawn a duplicate opportunity
 * + close loop when it syncs back from QuickBooks. These pure helpers decide the
 * opportunity link and whether the sync opens a nudge loop.
 */
import { describe, it, expect } from "vitest";
import { resolveSyncOpportunityId, shouldOpenCloseLoop } from "./salesDocSync";

describe("resolveSyncOpportunityId", () => {
  it("prefers the sales-doc's existing opportunity", () => {
    expect(resolveSyncOpportunityId(7, 99)).toBe(7);
  });
  it("falls back to the CRM-pushed estimate's opportunity (no duplicate)", () => {
    expect(resolveSyncOpportunityId(null, 42)).toBe(42);
  });
  it("returns null (create fresh) when neither applies — a genuine QBO-origin estimate", () => {
    expect(resolveSyncOpportunityId(null, null)).toBeNull();
  });
});

describe("shouldOpenCloseLoop", () => {
  it("opens the loop for a QBO pending estimate WITH delivery evidence", () => {
    expect(shouldOpenCloseLoop("pending", new Date(), false)).toBe(true);
  });
  it("does NOT open the loop for an UNSENT pending estimate (est 330248 incident)", () => {
    expect(shouldOpenCloseLoop("pending", null, false)).toBe(false);
    expect(shouldOpenCloseLoop("pending", undefined, false)).toBe(false);
  });
  it("does NOT open the loop for a CRM-pushed estimate", () => {
    expect(shouldOpenCloseLoop("pending", new Date(), true)).toBe(false);
  });
  it("does not open for non-pending statuses even when sent", () => {
    for (const st of ["accepted", "closed", "rejected", "expired", null, undefined]) {
      expect(shouldOpenCloseLoop(st, new Date(), false)).toBe(false);
    }
  });
});
