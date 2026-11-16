import { describe, expect, it } from "vitest";
import { SALES_OWNED_TARGETS, isSalesAllowedProcedure } from "@shared/salesAccess";
import { inScope } from "./services/salesScope";

describe("sales own-contacts scope", () => {
  it("every owned-target procedure is one sales can call", () => {
    for (const p of Object.keys(SALES_OWNED_TARGETS)) expect(isSalesAllowedProcedure(p)).toBe(true);
  });
  it("reads the contact or lead id from the input", () => {
    expect(SALES_OWNED_TARGETS["customers.getById"]({ id: 5 })).toEqual({ type: "customer", id: 5 });
    expect(SALES_OWNED_TARGETS["leadCaptures.addNote"]({ id: 9, notes: "x" })).toEqual({ type: "lead", id: 9 });
    expect(SALES_OWNED_TARGETS["calls.listForContact"]({ leadCaptureId: 3 })).toEqual({ type: "lead", id: 3 });
    expect(SALES_OWNED_TARGETS["crmCommunications.openLeadContact"]({ id: 3, kind: "lead" })).toBeNull();
  });
  it("only assigned ids are in scope; admins are unlimited", () => {
    const scope = { customers: new Set([1]), leads: new Set([2]) };
    expect(inScope(scope, "customer", 1)).toBe(true);
    expect(inScope(scope, "customer", 2)).toBe(false);
    expect(inScope(scope, "lead", 2)).toBe(true);
    expect(inScope(null, "customer", 99)).toBe(true);
  });
});
