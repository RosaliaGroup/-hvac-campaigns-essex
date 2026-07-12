/**
 * convertToJobState.ts — pure UI-decision logic for the Opportunity → Job
 * "Convert to Job" control, shared by every opportunity surface (the detail
 * drawer and the full-page view). Keeping the decisions here (framework-free)
 * guarantees both surfaces behave identically and lets us unit-test the logic
 * without a DOM.
 */

/** Minimal linked-job shape returned by opportunities.get → primaryJob. */
export type PrimaryJob = { id: number; jobNumber: string; status: string } | null;

/** Property offered when the customer has more than one to choose from. */
export type PropertyChoice = {
  id: number;
  label: string | null;
  addressLine1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  isPrimary: boolean;
};

/** The two states the control can render. */
export type ConvertControlMode = "view_job" | "convert";

/** Pure: whether to show "View Job" (already converted) or "Convert to Job". */
export function convertControlMode(primaryJob: PrimaryJob): ConvertControlMode {
  return primaryJob ? "view_job" : "convert";
}

/** Shape returned by the opportunities.convertToJob mutation. */
export type ConvertMutationResult =
  | { ok: true; jobId: number; jobNumber: string; status: string; alreadyConverted: boolean; propertyId: number | null }
  | { ok: false; reason: "property_selection_required"; candidates: PropertyChoice[] };

/** The next UI action a surface should take after the mutation resolves. */
export type ConvertUiEffect =
  | { kind: "open_property_modal"; candidates: PropertyChoice[] }
  | { kind: "converted"; jobId: number; jobNumber: string; alreadyConverted: boolean };

/**
 * Pure: map a convertToJob result to the next UI effect. The `ok:false`
 * property-selection case is a normal result (no write happened) and opens the
 * picker; `ok:true` (new or idempotent existing job) resolves the flow.
 */
export function convertResultEffect(res: ConvertMutationResult): ConvertUiEffect {
  if (res.ok === false) return { kind: "open_property_modal", candidates: res.candidates };
  return { kind: "converted", jobId: res.jobId, jobNumber: res.jobNumber, alreadyConverted: res.alreadyConverted };
}

/** Pure: the label + human status for the "View Job" control. */
export function viewJobLabel(primaryJob: NonNullable<PrimaryJob>): { label: string; status: string } {
  return { label: primaryJob.jobNumber || `#${primaryJob.id}`, status: primaryJob.status.replace(/_/g, " ") };
}

/** Pure: one-line address for a property choice in the picker. */
export function propertyChoiceAddress(p: PropertyChoice): string {
  return [p.addressLine1, p.city, p.state, p.zip].filter(Boolean).join(", ");
}
