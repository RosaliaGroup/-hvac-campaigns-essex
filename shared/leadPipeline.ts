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

/**
 * Job statuses that represent real, won business (→ Customer). Aligns with the
 * rule "Won or accepted QuickBooks proposal/estimate = Customer" and
 * "Existing completed jobs/invoices may show Customer". A mere linkage to a
 * customer record (customerId) is NOT enough — only these outcomes are.
 */
export const WON_JOB_STATUSES = ["approved", "completed", "invoice_sent", "paid", "closed"] as const;
export function isWonJobStatus(status?: string | null): boolean {
  return !!status && (WON_JOB_STATUSES as readonly string[]).includes(status);
}

/**
 * Pick the most-advanced stage among several linked lead captures (a single
 * contact may have more than one). Won ranks highest; unknown/lost lowest.
 */
export function furthestStage(stages: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestRank = -Infinity;
  for (const s of stages) {
    const rank = isWon(s) ? 100 : isLost(s) ? -1 : stageIndex(s);
    if (rank > bestRank) {
      bestRank = rank;
      best = normalizeStage(s);
    }
  }
  return best;
}

/**
 * Full set of signals for a Contact (unifies a customer record with any linked
 * lead captures / jobs / appointments). This is the single place that decides
 * Lead vs Prospect vs Customer for a contact, per the lifecycle rules:
 *  - Customer: a won lead, an accepted proposal, or a completed job/invoice.
 *  - Prospect: engaged (contacted → follow_up stage, or has an appointment).
 *  - Lead: a fresh website submission or a new manual contact — the DEFAULT.
 * Crucially, a plain link to a customer record does NOT make someone a Customer.
 */
export interface ContactSignals {
  /** Stages of every lead capture linked to this contact. */
  leadStages?: (string | null | undefined)[];
  /** Statuses of every job linked to this contact. */
  jobStatuses?: (string | null | undefined)[];
  /** The contact has at least one appointment. */
  hasAppointment?: boolean;
  /** An estimate/proposal has been explicitly accepted. */
  acceptedProposal?: boolean;
}

export function deriveContactRelationship(s: ContactSignals): Relationship {
  const wonStage = (s.leadStages ?? []).some(isWon);
  const wonJob = (s.jobStatuses ?? []).some(isWonJobStatus);
  const isCustomer = wonStage || wonJob || Boolean(s.acceptedProposal);
  const stage = furthestStage(s.leadStages ?? []);
  return deriveRelationship({ stage, isCustomer, hasEngagement: s.hasAppointment });
}

/** Editable lead-capture fields exposed in the Lead Inbox popup. */
export interface LeadCaptureEdit {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Requested service — stored on `message`. */
  message?: string | null;
  /** Source — stored on `captureType`. */
  captureType?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
}

/**
 * Build a `leadCaptures` SET patch from the editable fields: recomputes the
 * denormalized `name` when either name part changes, coerces "" → null, and
 * drops keys that were not provided (so a partial edit never nulls untouched
 * columns). Pure — safe to unit test.
 */
export function buildLeadCapturePatch(edit: LeadCaptureEdit): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const assign = (key: keyof LeadCaptureEdit) => {
    const v = edit[key];
    if (v !== undefined) patch[key] = v === "" ? null : v;
  };
  (["firstName", "lastName", "phone", "email", "message", "captureType", "assignedTo", "notes"] as const).forEach(assign);
  if (edit.firstName !== undefined || edit.lastName !== undefined) {
    const name = [edit.firstName, edit.lastName].filter(Boolean).join(" ").trim();
    patch.name = name || null;
  }
  return patch;
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
