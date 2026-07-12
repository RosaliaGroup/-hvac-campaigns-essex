import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toPatch } from "./zodPatch";

// Mirrors the real Jobs `partInput` (server/routers/jobs.ts) field-for-field so
// the regression is faithful to the endpoint that surfaced the bug.
const partInput = z.object({
  itemName: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  quantity: z.number().min(0).max(99999).default(1),
  unit: z.string().max(32).optional().nullable(),
  unitCost: z.number().min(0).max(9999999).default(0),
  unitPrice: z.number().min(0).max(9999999).default(0),
  billable: z.boolean().default(true),
});

// Mirrors the real `laborInput` (has a boolean default).
const laborInput = z.object({
  technicianId: z.number().int().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  description: z.string().min(1).max(500),
  billable: z.boolean().default(true),
});

// Mirrors a create schema with an enum default (like priority / type / propertyType).
const withEnumDefault = z.object({
  title: z.string(),
  priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  isPrimary: z.boolean().default(false),
});

describe("toPatch — PATCH semantics (omitted fields are never synthesized)", () => {
  it("a single-field update carries ONLY that field (no defaulted fields injected)", () => {
    const patch = toPatch(partInput).parse({ quantity: 5 });
    expect(patch).toEqual({ quantity: 5 });
    // every other field must be absent / undefined — the bug was these becoming 0/true
    expect("unitCost" in patch).toBe(false);
    expect("unitPrice" in patch).toBe(false);
    expect("billable" in patch).toBe(false);
    expect(patch.unitCost).toBeUndefined();
    expect(patch.unitPrice).toBeUndefined();
    expect(patch.billable).toBeUndefined();
  });

  it("contrast: the buggy .partial() DOES inject defaults (what this fixes)", () => {
    const buggy = partInput.partial().parse({ quantity: 5 });
    expect(buggy).toMatchObject({ quantity: 5, unitCost: 0, unitPrice: 0, billable: true });
  });

  it("supplied numeric 0 passes through (not treated as omitted)", () => {
    expect(toPatch(partInput).parse({ unitCost: 0 })).toEqual({ unitCost: 0 });
  });

  it("supplied decimal values pass through unchanged", () => {
    expect(toPatch(partInput).parse({ unitPrice: 19.99 })).toEqual({ unitPrice: 19.99 });
  });

  it("supplied boolean false passes through (not reset to the default true)", () => {
    expect(toPatch(partInput).parse({ billable: false })).toEqual({ billable: false });
    expect(toPatch(laborInput).parse({ billable: false })).toEqual({ billable: false });
  });

  it("supplied null passes through for nullable fields", () => {
    expect(toPatch(partInput).parse({ description: null })).toEqual({ description: null });
    expect(toPatch(laborInput).parse({ technicianId: null })).toEqual({ technicianId: null });
  });

  it("enum + boolean defaults are not synthesized on a partial update", () => {
    const patch = toPatch(withEnumDefault).parse({ title: "x" });
    expect(patch).toEqual({ title: "x" });
    expect(patch.priority).toBeUndefined();
    expect(patch.isPrimary).toBeUndefined();
  });

  it("still validates supplied fields (constraints preserved after stripping defaults)", () => {
    expect(toPatch(partInput).safeParse({ quantity: -1 }).success).toBe(false); // min(0)
    expect(toPatch(withEnumDefault).safeParse({ priority: "bogus" }).success).toBe(false);
  });

  it("an empty update parses to an empty object (touches nothing)", () => {
    expect(toPatch(partInput).parse({})).toEqual({});
  });
});

describe("toPatch — create schemas still apply defaults (behavior unchanged)", () => {
  it("partInput create still fills quantity/unitCost/unitPrice/billable", () => {
    expect(partInput.parse({ itemName: "Cap" })).toEqual({
      itemName: "Cap", quantity: 1, unitCost: 0, unitPrice: 0, billable: true,
    });
  });
  it("laborInput create still fills billable", () => {
    expect(laborInput.parse({ description: "work" })).toMatchObject({ description: "work", billable: true });
  });
  it("enum/boolean create defaults still apply", () => {
    expect(withEnumDefault.parse({ title: "x" })).toEqual({ title: "x", priority: "normal", isPrimary: false });
  });
});
