import { describe, expect, it } from "vitest";
import { evaluateCommercialConversion, type ConversionContext } from "./commercialConversion";
import type { PropertyCandidate } from "./opportunityToJob";

const prop = (over: Partial<PropertyCandidate>): PropertyCandidate => ({
  id: 1,
  label: "Main",
  addressLine1: "1 Main St",
  city: "Newark",
  state: "NJ",
  zip: "07102",
  isPrimary: false,
  ...over,
});

const base = (over: Partial<ConversionContext & { customerId: number }> = {}): ConversionContext & { customerId: number } => ({
  recordType: "commercial",
  stageKey: "awarded",
  customerId: 10,
  customerExists: true,
  propertyCandidates: [prop({ id: 5, isPrimary: true })],
  explicitPropertyId: null,
  requiredChecklistItems: [],
  existingJob: null,
  primaryContactId: 20,
  linkedEstimateId: 99,
  ...over,
});

describe("evaluateCommercialConversion — gate", () => {
  it("passes a well-formed awarded opportunity and reuses linked records", () => {
    const v = evaluateCommercialConversion(base());
    expect(v.canConvert).toBe(true);
    expect(v.blockers).toHaveLength(0);
    expect(v.resolvedPropertyId).toBe(5);
    expect(v.reuse).toEqual({ customerId: 10, propertyId: 5, primaryContactId: 20, estimateId: 99 });
  });

  it("blocks stages that are not conversion-eligible", () => {
    const v = evaluateCommercialConversion(base({ stageKey: "proposal_sent" }));
    expect(v.canConvert).toBe(false);
    expect(v.blockers.map(b => b.code)).toContain("STAGE_NOT_ELIGIBLE");
  });

  it("accepts all four eligible stage keys", () => {
    for (const stageKey of ["awarded", "contract_signed", "deposit_received", "ready_for_scheduling"]) {
      expect(evaluateCommercialConversion(base({ stageKey })).canConvert).toBe(true);
    }
  });

  it("blocks a missing customer", () => {
    const v = evaluateCommercialConversion(base({ customerExists: false }));
    expect(v.canConvert).toBe(false);
    expect(v.blockers.map(b => b.code)).toContain("CUSTOMER_NOT_FOUND");
  });

  it("requires a property (no property-less commercial conversion)", () => {
    const v = evaluateCommercialConversion(base({ propertyCandidates: [] }));
    expect(v.canConvert).toBe(false);
    expect(v.blockers.map(b => b.code)).toContain("PROPERTY_REQUIRED");
  });

  it("requires selection when properties are ambiguous", () => {
    const v = evaluateCommercialConversion(base({ propertyCandidates: [prop({ id: 1 }), prop({ id: 2 })], explicitPropertyId: null }));
    expect(v.propertyResolution).toBe("ambiguous");
    expect(v.blockers.map(b => b.code)).toContain("PROPERTY_SELECTION_REQUIRED");
    expect(v.ambiguousProperties).toHaveLength(2);
  });

  it("rejects an explicit property that is not the customer's", () => {
    const v = evaluateCommercialConversion(base({ propertyCandidates: [prop({ id: 1 })], explicitPropertyId: 999 }));
    expect(v.blockers.map(b => b.code)).toContain("PROPERTY_INVALID");
  });

  it("blocks when required checklist items are incomplete", () => {
    const v = evaluateCommercialConversion(
      base({
        requiredChecklistItems: [
          { id: 1, label: "Estimate created", isComplete: false },
          { id: 2, label: "Customer linked", isComplete: true },
        ],
      }),
    );
    expect(v.canConvert).toBe(false);
    expect(v.blockers.map(b => b.code)).toContain("CHECKLIST_INCOMPLETE");
    expect(v.incompleteRequiredChecklist).toEqual([{ id: 1, label: "Estimate created" }]);
  });

  it("passes when all required checklist items are complete", () => {
    const v = evaluateCommercialConversion(
      base({ requiredChecklistItems: [{ id: 1, label: "Estimate created", isComplete: true }] }),
    );
    expect(v.canConvert).toBe(true);
  });

  it("blocks non-commercial records from this flow", () => {
    const v = evaluateCommercialConversion(base({ recordType: "qbo_residential" }));
    expect(v.blockers.map(b => b.code)).toContain("NOT_COMMERCIAL");
  });

  it("is idempotent: an already-converted opp short-circuits to its existing job", () => {
    const v = evaluateCommercialConversion(
      base({ existingJob: { id: 77, jobNumber: "ME-2026-0077", status: "scheduled" }, stageKey: "proposal_sent", customerExists: false }),
    );
    // Even with otherwise-failing inputs, an existing job means "already done".
    expect(v.alreadyConverted).toBe(true);
    expect(v.canConvert).toBe(true);
    expect(v.existingJob).toEqual({ id: 77, jobNumber: "ME-2026-0077", status: "scheduled" });
    expect(v.blockers).toHaveLength(0);
  });
});
