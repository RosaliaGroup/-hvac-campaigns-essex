/**
 * opportunityToJob.ts — Phase A: safe, idempotent Opportunity → Job conversion.
 *
 * The Opportunity is the sales record; the Job is the operational record. This
 * module turns an opportunity into a job WITHOUT any QuickBooks interaction and
 * without ever silently creating a property.
 *
 * Design decisions:
 *  - One opportunity may legitimately produce MANY jobs (an HVAC deal can spawn
 *    several visits). We do NOT add a unique constraint. Instead the standard
 *    "Convert to Job" path is idempotent: if a converted job already exists it
 *    returns the first (primary) one rather than creating a duplicate.
 *  - Property resolution never guesses: exactly-one property is used; zero
 *    proceeds property-less (nullable); multiple with a single primary uses the
 *    primary; otherwise it asks the caller to choose (no write happens).
 *
 * The core (resolveJobProperty + convertOpportunityToJob) is pure/port-injected
 * so every branch is unit-testable without a database or auth layer.
 */

/** A customer property offered as a conversion target. */
export interface PropertyCandidate {
  id: number;
  label: string | null;
  addressLine1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  isPrimary: boolean;
}

export type PropertyResolution =
  | { kind: "resolved"; propertyId: number | null }
  | { kind: "ambiguous"; candidates: PropertyCandidate[] }
  | { kind: "invalid"; propertyId: number };

/**
 * Decide which property a converted job should use. Pure.
 * - explicit id: must belong to the customer, else `invalid`.
 * - 0 candidates: `resolved` with null (job created property-less; never auto-create).
 * - 1 candidate: use it.
 * - >1 candidates: a single designated primary is used (not a guess); otherwise
 *   `ambiguous` — the caller must have the user pick.
 */
export function resolveJobProperty(
  candidates: PropertyCandidate[],
  explicitPropertyId: number | null | undefined,
): PropertyResolution {
  if (explicitPropertyId != null) {
    const match = candidates.find(c => c.id === explicitPropertyId);
    return match ? { kind: "resolved", propertyId: match.id } : { kind: "invalid", propertyId: explicitPropertyId };
  }
  if (candidates.length === 0) return { kind: "resolved", propertyId: null };
  if (candidates.length === 1) return { kind: "resolved", propertyId: candidates[0].id };
  const primaries = candidates.filter(c => c.isPrimary);
  if (primaries.length === 1) return { kind: "resolved", propertyId: primaries[0].id };
  return { kind: "ambiguous", candidates };
}

export interface OpportunityLite {
  id: number;
  customerId: number;
  title: string;
  projectReference: string | null;
}

export interface ConvertedJobLite {
  id: number;
  jobNumber: string;
  status: string;
  propertyId: number | null;
}

/** All DB effects the conversion needs, so the core stays pure/testable. */
export interface ConvertJobPort {
  getOpportunity(id: number): Promise<OpportunityLite | null>;
  customerExists(customerId: number): Promise<boolean>;
  /** First job already produced by the standard conversion path, if any. */
  getExistingConvertedJob(opportunityId: number): Promise<ConvertedJobLite | null>;
  getCustomerProperties(customerId: number): Promise<PropertyCandidate[]>;
  /** Insert the job and assign its human job number; returns identifiers. */
  createJob(input: {
    customerId: number;
    opportunityId: number;
    title: string;
    propertyId: number | null;
    internalNotes: string | null;
  }): Promise<{ id: number; jobNumber: string }>;
  /** Append the auditable conversion event on the opportunity. */
  recordEvent(opportunityId: number, jobId: number, userId: number): Promise<void>;
}

/** Thrown for hard failures the caller maps to tRPC error codes. */
export class ConvertError extends Error {
  constructor(public code: "OPPORTUNITY_NOT_FOUND" | "CUSTOMER_NOT_FOUND" | "PROPERTY_NOT_FOUND", message?: string) {
    super(message ?? code);
    this.name = "ConvertError";
  }
}

export type ConvertResult =
  | {
      ok: true;
      jobId: number;
      jobNumber: string;
      status: string;
      alreadyConverted: boolean;
      propertyId: number | null;
    }
  | { ok: false; reason: "property_selection_required"; candidates: PropertyCandidate[] };

/**
 * Convert an opportunity into a job. Idempotent on the standard path. Performs
 * NO QuickBooks calls. Writes at most one job + one opportunity event, and only
 * after all validation and property resolution succeed.
 */
export async function convertOpportunityToJob(
  port: ConvertJobPort,
  args: { opportunityId: number; propertyId?: number | null; userId: number },
): Promise<ConvertResult> {
  const opp = await port.getOpportunity(args.opportunityId);
  if (!opp) throw new ConvertError("OPPORTUNITY_NOT_FOUND", "Opportunity not found");

  if (!(await port.customerExists(opp.customerId))) {
    throw new ConvertError("CUSTOMER_NOT_FOUND", "Customer not found for this opportunity");
  }

  // Idempotency: the standard conversion returns the existing primary job.
  const existing = await port.getExistingConvertedJob(args.opportunityId);
  if (existing) {
    return {
      ok: true,
      jobId: existing.id,
      jobNumber: existing.jobNumber,
      status: existing.status,
      alreadyConverted: true,
      propertyId: existing.propertyId,
    };
  }

  const candidates = await port.getCustomerProperties(opp.customerId);
  const resolution = resolveJobProperty(candidates, args.propertyId);
  if (resolution.kind === "ambiguous") {
    return { ok: false, reason: "property_selection_required", candidates: resolution.candidates };
  }
  if (resolution.kind === "invalid") {
    throw new ConvertError("PROPERTY_NOT_FOUND", "Selected property does not belong to this customer");
  }

  const internalNotes = opp.projectReference
    ? `Converted from Opportunity #${opp.id} (project ${opp.projectReference}).`
    : `Converted from Opportunity #${opp.id}.`;

  const { id: jobId, jobNumber } = await port.createJob({
    customerId: opp.customerId,
    opportunityId: opp.id,
    title: opp.title,
    propertyId: resolution.propertyId,
    internalNotes,
  });

  await port.recordEvent(opp.id, jobId, args.userId);

  return { ok: true, jobId, jobNumber, status: "new", alreadyConverted: false, propertyId: resolution.propertyId };
}
