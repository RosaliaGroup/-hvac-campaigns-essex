/**
 * Commercial Opportunity → Job conversion VALIDATION (pure).
 *
 * This does NOT convert — it produces the structured, human-reviewable
 * validation result shown before conversion, and is the same gate the actual
 * `opportunities.convertToJob` mutation enforces for commercial records. The
 * real write still goes through the single existing converter
 * (convertOpportunityToJob in opportunityToJob.ts); we reuse its property
 * resolver here so there is exactly one property rule.
 */
import { isConvertEligibleStageKey } from "@shared/commercialPipeline";
import { resolveJobProperty, type PropertyCandidate } from "./opportunityToJob";

export interface ConversionContext {
  recordType: string;
  /** Resolved commercial stage key (from opportunityStages), or null. */
  stageKey: string | null;
  customerExists: boolean;
  propertyCandidates: PropertyCandidate[];
  explicitPropertyId?: number | null;
  /** Only the checklist items flagged requiredForConversion. */
  requiredChecklistItems: Array<{ id: number; label: string; isComplete: boolean }>;
  /** The first job already linked to this opportunity, if any. */
  existingJob: { id: number; jobNumber: string; status: string } | null;
  primaryContactId?: number | null;
  linkedEstimateId?: number | null;
}

export interface ConversionBlocker {
  code:
    | "NOT_COMMERCIAL"
    | "STAGE_NOT_ELIGIBLE"
    | "CUSTOMER_NOT_FOUND"
    | "PROPERTY_REQUIRED"
    | "PROPERTY_INVALID"
    | "PROPERTY_SELECTION_REQUIRED"
    | "CHECKLIST_INCOMPLETE";
  message: string;
}

export interface ConversionValidation {
  canConvert: boolean;
  alreadyConverted: boolean;
  existingJob: { id: number; jobNumber: string; status: string } | null;
  blockers: ConversionBlocker[];
  propertyResolution: "resolved" | "ambiguous" | "invalid" | "none";
  resolvedPropertyId: number | null;
  ambiguousProperties: PropertyCandidate[];
  incompleteRequiredChecklist: Array<{ id: number; label: string }>;
  /** What the conversion will reuse (never re-create). */
  reuse: {
    customerId: number | null;
    propertyId: number | null;
    primaryContactId: number | null;
    estimateId: number | null;
  };
}

/**
 * Evaluate whether a commercial opportunity may be converted. Idempotent-aware:
 * if a linked job already exists, conversion is "already done" (the mutation
 * returns that job) and no other gate applies.
 */
export function evaluateCommercialConversion(ctx: ConversionContext & { customerId: number }): ConversionValidation {
  // Idempotency short-circuit: repeated request just returns the existing job.
  if (ctx.existingJob) {
    return {
      canConvert: true,
      alreadyConverted: true,
      existingJob: ctx.existingJob,
      blockers: [],
      propertyResolution: "resolved",
      resolvedPropertyId: null,
      ambiguousProperties: [],
      incompleteRequiredChecklist: [],
      reuse: {
        customerId: ctx.customerId,
        propertyId: null,
        primaryContactId: ctx.primaryContactId ?? null,
        estimateId: ctx.linkedEstimateId ?? null,
      },
    };
  }

  const blockers: ConversionBlocker[] = [];

  if (ctx.recordType !== "commercial") {
    blockers.push({ code: "NOT_COMMERCIAL", message: "Only commercial opportunities use this conversion flow." });
  }
  if (!isConvertEligibleStageKey(ctx.stageKey)) {
    blockers.push({
      code: "STAGE_NOT_ELIGIBLE",
      message: "Opportunity must be Awarded, Contract Signed, Deposit Received, or Ready for Scheduling.",
    });
  }
  if (!ctx.customerExists) {
    blockers.push({ code: "CUSTOMER_NOT_FOUND", message: "A linked customer is required." });
  }

  // Property resolution (reuses the single converter rule).
  const resolution = resolveJobProperty(ctx.propertyCandidates, ctx.explicitPropertyId);
  let propertyResolution: ConversionValidation["propertyResolution"] = "none";
  let resolvedPropertyId: number | null = null;
  let ambiguousProperties: PropertyCandidate[] = [];
  if (resolution.kind === "invalid") {
    propertyResolution = "invalid";
    blockers.push({ code: "PROPERTY_INVALID", message: "Selected property does not belong to this customer." });
  } else if (resolution.kind === "ambiguous") {
    propertyResolution = "ambiguous";
    ambiguousProperties = resolution.candidates;
    blockers.push({ code: "PROPERTY_SELECTION_REQUIRED", message: "Select which property this job is for." });
  } else if (resolution.propertyId == null) {
    // Commercial conversion requires a property (stricter than the legacy path).
    propertyResolution = "none";
    blockers.push({ code: "PROPERTY_REQUIRED", message: "A linked property/address is required to convert." });
  } else {
    propertyResolution = "resolved";
    resolvedPropertyId = resolution.propertyId;
  }

  const incompleteRequiredChecklist = ctx.requiredChecklistItems
    .filter(i => !i.isComplete)
    .map(i => ({ id: i.id, label: i.label }));
  if (incompleteRequiredChecklist.length) {
    blockers.push({
      code: "CHECKLIST_INCOMPLETE",
      message: `${incompleteRequiredChecklist.length} required checklist item(s) not complete.`,
    });
  }

  return {
    canConvert: blockers.length === 0,
    alreadyConverted: false,
    existingJob: null,
    blockers,
    propertyResolution,
    resolvedPropertyId,
    ambiguousProperties,
    incompleteRequiredChecklist,
    reuse: {
      customerId: ctx.customerId,
      propertyId: resolvedPropertyId,
      primaryContactId: ctx.primaryContactId ?? null,
      estimateId: ctx.linkedEstimateId ?? null,
    },
  };
}
