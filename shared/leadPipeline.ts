/**
 * Lead Inbox pipeline model (UI/workflow refactor). Single source of truth for
 * lead stages, legacy normalization, and the derived Lead/Prospect/Customer
 * relationship. Pure + framework-free so client, server, and tests all share it.
 *
 * NOTE: this is additive. The only schema change is expanding the
 * leadCaptures.status enum; legacy values (`qualified`, `booked`) are retained so
 * existing rows stay valid and are mapped to the new stages for display.
 */

export interface Stage {
  value: string;
  label: string;
}

/** The eight lead stages, in pipeline order. "Booked" is intentionally gone. */
export const LEAD_STAGES: Stage[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "assessment_scheduled", label: "Assessment Scheduled" },
  { value: "assessment_completed", label: "Assessment Completed" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "follow_up", label: "Follow Up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

/** Legacy status values → new stage, for display of pre-migration rows. */
export const LEGACY_STAGE_MAP: Record<string, string> = {
  booked: "assessment_scheduled",
  qualified: "contacted",
};

/** Full DB enum = new stages + retained legacy values (existing rows stay valid). */
export const LEAD_STAGE_ENUM = [
  "new", "contacted", "assessment_scheduled", "assessment_completed",
  "proposal_sent", "follow_up", "won", "lost",
  // legacy — retained so pre-migration rows remain valid; mapped on display:
  "qualified", "booked",
] as const;
export type LeadStageValue = (typeof LEAD_STAGE_ENUM)[number];

/** The linear progression (excludes the terminal Won/Lost outcomes). */
export const PIPELINE_ORDER = [
  "new", "contacted", "assessment_scheduled", "assessment_completed", "proposal_sent", "follow_up",
];

export function normalizeStage(value?: string | null): string {
  if (!value) return "new";
  return LEGACY_STAGE_MAP[value] ?? value;
}

const STAGE_LABELS: Record<string, string> = Object.fromEntries(LEAD_STAGES.map(s => [s.value, s.label]));
export function stageLabel(value?: string | null): string {
  return STAGE_LABELS[normalizeStage(value)] ?? "New";
}

export function isWon(value?: string | null): boolean {
  return normalizeStage(value) === "won";
}
export function isLost(value?: string | null): boolean {
  return normalizeStage(value) === "lost";
}
export function isOpen(value?: string | null): boolean {
  return PIPELINE_ORDER.includes(normalizeStage(value));
}

/** Position in the linear pipeline (0-based); -1 for Won/Lost/unknown. */
export function stageIndex(value?: string | null): number {
  return PIPELINE_ORDER.indexOf(normalizeStage(value));
}

// ── Relationship (Lead → Prospect → Customer), derived — no stored column ──
export type Relationship = "lead" | "prospect" | "customer";

export interface RelationshipSignals {
  /** Current lead stage (leadCaptures.status), if this is a lead. */
  stage?: string | null;
  /** Linked to a customer record / won business (customerId set, or a job/invoice exists). */
  isCustomer?: boolean;
  /** Has an appointment or opportunity in progress. */
  hasEngagement?: boolean;
}

/**
 * Derive the relationship without a schema change:
 *  - Customer: won the deal, or already linked to a customer/job.
 *  - Prospect: engaged (contacted → follow_up, or has an appointment/opportunity).
 *  - Lead: brand new, no engagement yet.
 * Finer separation lands when Opportunity/Job wiring exists (future architecture).
 */
export function deriveRelationship(s: RelationshipSignals): Relationship {
  if (s.isCustomer || isWon(s.stage)) return "customer";
  if (s.hasEngagement || isOpen(s.stage) && normalizeStage(s.stage) !== "new") return "prospect";
  return "lead";
}

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
};
export function relationshipLabel(r: Relationship): string {
  return RELATIONSHIP_LABELS[r];
}

// ── Lead age (Submitted → now) as a human label ──
export function leadAgeLabel(createdAt: Date | string, now: Date | string): string {
  const start = new Date(createdAt).getTime();
  const end = new Date(now).getTime();
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
