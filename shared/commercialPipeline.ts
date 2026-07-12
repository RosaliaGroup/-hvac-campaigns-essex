/**
 * Commercial Opportunities — pipeline, type, category, and document-category
 * model. Single source of truth shared by client, server, and tests (pure,
 * framework-free — no imports). Do NOT duplicate these values in the client or
 * server; import from here.
 *
 * The pipeline is administrator-configurable at runtime (rows in the
 * `opportunityStages` table); the constants here are the SEED defaults and the
 * canonical key/label/classification vocabulary. Behavior is driven by the
 * stable `key` + `classification`, never by the display label alone.
 *
 * This is purely additive: it does NOT touch the legacy `opportunities.stage`
 * enum or the QuickBooks sync path — commercial records use `stageId` →
 * `opportunityStages`, legacy QBO records keep using `stage`.
 */

export type StageClassification = "open" | "won" | "lost";

export interface PipelineStageSeed {
  /** Stable internal key — the behavioral identity of the stage. */
  key: string;
  /** User-facing name. */
  name: string;
  /** 1-based display order. */
  order: number;
  /** Default win probability 0–100 applied when an opportunity enters the stage. */
  defaultProbability: number;
  /** open = in pipeline; won/lost = terminal outcomes. */
  classification: StageClassification;
}

/** The pipelineKey for the default commercial pipeline. */
export const COMMERCIAL_PIPELINE_KEY = "commercial";

/**
 * The 16 approved default commercial stages, in order. Seeded into
 * `opportunityStages` with `isSystem = true` (protected from deletion; still
 * renamable / reorderable / deactivatable by an admin).
 */
export const COMMERCIAL_STAGE_SEEDS: PipelineStageSeed[] = [
  { key: "new_lead", name: "New Lead", order: 1, defaultProbability: 5, classification: "open" },
  { key: "contacted", name: "Contacted", order: 2, defaultProbability: 10, classification: "open" },
  { key: "qualified", name: "Qualified", order: 3, defaultProbability: 20, classification: "open" },
  { key: "site_visit_scheduled", name: "Site Visit Scheduled", order: 4, defaultProbability: 25, classification: "open" },
  { key: "site_visit_complete", name: "Site Visit Complete", order: 5, defaultProbability: 30, classification: "open" },
  { key: "estimating", name: "Estimating", order: 6, defaultProbability: 40, classification: "open" },
  { key: "internal_review", name: "Internal Review", order: 7, defaultProbability: 45, classification: "open" },
  { key: "proposal_sent", name: "Proposal Sent", order: 8, defaultProbability: 55, classification: "open" },
  { key: "follow_up", name: "Follow-up", order: 9, defaultProbability: 60, classification: "open" },
  { key: "negotiation", name: "Negotiation", order: 10, defaultProbability: 70, classification: "open" },
  { key: "awarded", name: "Awarded", order: 11, defaultProbability: 100, classification: "won" },
  { key: "contract_signed", name: "Contract Signed", order: 12, defaultProbability: 100, classification: "won" },
  { key: "deposit_received", name: "Deposit Received", order: 13, defaultProbability: 100, classification: "won" },
  { key: "ready_for_scheduling", name: "Ready for Scheduling", order: 14, defaultProbability: 100, classification: "won" },
  { key: "converted_to_job", name: "Converted to Job", order: 15, defaultProbability: 100, classification: "won" },
  { key: "lost", name: "Lost", order: 16, defaultProbability: 0, classification: "lost" },
];

export const COMMERCIAL_STAGE_KEYS = COMMERCIAL_STAGE_SEEDS.map(s => s.key);

/**
 * Stages from which an opportunity may be converted to a Job. Matches the
 * approved precondition: Awarded, Contract Signed, Deposit Received, or Ready
 * for Scheduling. (Converted-to-Job is excluded — already converted.)
 */
export const CONVERT_ELIGIBLE_STAGE_KEYS = [
  "awarded",
  "contract_signed",
  "deposit_received",
  "ready_for_scheduling",
] as const;

export function isConvertEligibleStageKey(key?: string | null): boolean {
  return !!key && (CONVERT_ELIGIBLE_STAGE_KEYS as readonly string[]).includes(key);
}

// ── recordType (workspace discriminator on `opportunities`) ──
export const OPPORTUNITY_RECORD_TYPES = [
  "qbo_residential",
  "commercial",
  "residential",
  "maintenance",
  "service_contract",
] as const;
export type OpportunityRecordType = (typeof OPPORTUNITY_RECORD_TYPES)[number];

// ── status (derived from stage classification for commercial records) ──
export const OPPORTUNITY_STATUSES = ["open", "awarded", "lost", "on_hold", "cancelled"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Map a stage classification to the default opportunity status. */
export function statusForClassification(c: StageClassification): OpportunityStatus {
  if (c === "won") return "awarded";
  if (c === "lost") return "lost";
  return "open";
}

// ── Opportunity types (single-select business classification) ──
export interface Labeled {
  key: string;
  label: string;
}
export const OPPORTUNITY_TYPES: Labeled[] = [
  { key: "commercial", label: "Commercial" },
  { key: "residential", label: "Residential" },
  { key: "public_work", label: "Public Work" },
  { key: "decarbonization", label: "Decarbonization" },
  { key: "direct_replacement", label: "Direct Replacement" },
  { key: "new_construction", label: "New Construction" },
  { key: "service_contract", label: "Service Contract" },
  { key: "preventive_maintenance", label: "Preventive Maintenance" },
  { key: "other", label: "Other" },
];
export const OPPORTUNITY_TYPE_KEYS = OPPORTUNITY_TYPES.map(t => t.key);

// ── Project categories (multi-select; NOT pipeline stages) ──
export const PROJECT_CATEGORIES: Labeled[] = [
  { key: "commercial", label: "Commercial" },
  { key: "residential", label: "Residential" },
  { key: "healthcare", label: "Healthcare" },
  { key: "food_manufacturing", label: "Food Manufacturing" },
  { key: "restaurant", label: "Restaurant" },
  { key: "general_retail", label: "General Retail" },
  { key: "laboratory", label: "Laboratory" },
  { key: "data_center", label: "Data Center" },
  { key: "public_work", label: "Public Work" },
  { key: "office", label: "Office" },
  { key: "multifamily", label: "Multifamily" },
  { key: "education", label: "Education" },
  { key: "industrial", label: "Industrial" },
  { key: "warehouse", label: "Warehouse" },
  { key: "hospitality", label: "Hospitality" },
  { key: "other", label: "Other" },
];
export const PROJECT_CATEGORY_KEYS = PROJECT_CATEGORIES.map(c => c.key);

// ── Document categories (expanded — 18) ──
export const DOCUMENT_CATEGORIES: Labeled[] = [
  { key: "photos", label: "Photos" },
  { key: "drone_photos", label: "Drone Photos" },
  { key: "videos", label: "Videos" },
  { key: "drawings", label: "Drawings" },
  { key: "plans", label: "Plans" },
  { key: "scope", label: "Scope" },
  { key: "proposal", label: "Proposal" },
  { key: "estimate", label: "Estimate" },
  { key: "contract", label: "Contract" },
  { key: "permit", label: "Permit" },
  { key: "equipment", label: "Equipment" },
  { key: "specifications", label: "Specifications" },
  { key: "submittals", label: "Submittals" },
  { key: "rfis", label: "RFIs" },
  { key: "change_orders", label: "Change Orders" },
  { key: "closeout", label: "Closeout" },
  { key: "warranty", label: "Warranty" },
  { key: "miscellaneous", label: "Miscellaneous" },
];
export const DOCUMENT_CATEGORY_KEYS = DOCUMENT_CATEGORIES.map(c => c.key);
/** Categories surfaced under the dedicated "Photos" tab. */
export const PHOTO_DOCUMENT_CATEGORY_KEYS = ["photos", "drone_photos", "videos"] as const;

// ── Priority ──
export const OPPORTUNITY_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type OpportunityPriority = (typeof OPPORTUNITY_PRIORITIES)[number];

// ── Label lookup helpers ──
function labelMap(items: Labeled[]): Record<string, string> {
  return Object.fromEntries(items.map(i => [i.key, i.label]));
}
const OPPORTUNITY_TYPE_LABELS = labelMap(OPPORTUNITY_TYPES);
const PROJECT_CATEGORY_LABELS = labelMap(PROJECT_CATEGORIES);
const DOCUMENT_CATEGORY_LABELS = labelMap(DOCUMENT_CATEGORIES);

const titleCase = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());

export const opportunityTypeLabel = (key?: string | null) =>
  key ? OPPORTUNITY_TYPE_LABELS[key] ?? titleCase(key) : "";
export const projectCategoryLabel = (key?: string | null) =>
  key ? PROJECT_CATEGORY_LABELS[key] ?? titleCase(key) : "";
export const documentCategoryLabel = (key?: string | null) =>
  key ? DOCUMENT_CATEGORY_LABELS[key] ?? titleCase(key) : "";

// ── Validation helpers ──
export const isRecordType = (v?: string | null): v is OpportunityRecordType =>
  !!v && (OPPORTUNITY_RECORD_TYPES as readonly string[]).includes(v);
export const isOpportunityStatus = (v?: string | null): v is OpportunityStatus =>
  !!v && (OPPORTUNITY_STATUSES as readonly string[]).includes(v);
export const isOpportunityType = (v?: string | null): boolean => !!v && OPPORTUNITY_TYPE_KEYS.includes(v);
export const isProjectCategory = (v?: string | null): boolean => !!v && PROJECT_CATEGORY_KEYS.includes(v);
export const isDocumentCategory = (v?: string | null): boolean => !!v && DOCUMENT_CATEGORY_KEYS.includes(v);
export const isPriority = (v?: string | null): v is OpportunityPriority =>
  !!v && (OPPORTUNITY_PRIORITIES as readonly string[]).includes(v);

// ── Money helpers (decimals are stored/returned as strings; keep them exact) ──

/**
 * Gross margin (value − cost) as a fixed-2 decimal string, or null when either
 * input is missing. Operates in integer cents to avoid float error — never
 * returns a floating-point money value.
 */
export function grossMargin(value?: string | number | null, cost?: string | number | null): string | null {
  const v = toCents(value);
  const c = toCents(cost);
  if (v === null || c === null) return null;
  return centsToDecimalString(v - c);
}

/**
 * Gross margin percentage (0–100, one decimal) = (value − cost) / value × 100.
 * Null when value is missing/zero or cost missing. Returns a number for display.
 */
export function grossMarginPercent(value?: string | number | null, cost?: string | number | null): number | null {
  const v = toCents(value);
  const c = toCents(cost);
  if (v === null || c === null || v === 0) return null;
  return Math.round(((v - c) / v) * 1000) / 10;
}

/**
 * Weighted value = amount × probability / 100, as a fixed-2 decimal string.
 * Computed in cents. Null when amount missing; probability defaults to 0 and is
 * clamped to 0–100.
 */
export function weightedValue(amount?: string | number | null, probability?: number | null): string | null {
  const a = toCents(amount);
  if (a === null) return null;
  const p = probability == null ? 0 : Math.max(0, Math.min(100, probability));
  return centsToDecimalString(Math.round((a * p) / 100));
}

function toCents(v?: string | number | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Format a human-facing opportunity number: OPP-<year>-<zero-padded id>.
 * Deterministic from the row id (mirrors the jobs.jobNumber convention).
 */
export function makeOpportunityNumber(id: number, year: number): string {
  return `OPP-${year}-${String(id).padStart(4, "0")}`;
}
