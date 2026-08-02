/**
 * Commercial Opportunities — client-side pure logic (framework-free, unit-tested
 * under vitest's node environment, matching the project's .test.ts convention).
 *
 * All list filtering is server-side: the UI builds a `list` input here and the
 * server does the work — the browser never fetches everything and filters
 * locally. recordType is always "commercial", keeping the legacy QBO Opportunity
 * Center completely isolated.
 */
import {
  grossMargin,
  grossMarginPercent,
  weightedValue as sharedWeightedValue,
  type StageClassification,
} from "@shared/commercialPipeline";

export const COMMERCIAL_RECORD_TYPE = "commercial" as const;

/** The six Sales sub-views. Each maps to a server-side filter preset. */
export type CommercialView = "board" | "all" | "mine" | "followups" | "won" | "lost";

export const COMMERCIAL_VIEWS: { key: CommercialView; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "all", label: "All Opportunities" },
  { key: "mine", label: "My Opportunities" },
  { key: "followups", label: "Follow-ups" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export function isCommercialView(v: string | null | undefined): v is CommercialView {
  return !!v && COMMERCIAL_VIEWS.some(view => view.key === v);
}

/** UI filter state (all optional). Mirrors the server `list` input vocabulary. */
export interface CommercialFilters {
  search?: string;
  stageId?: number[];
  opportunityType?: string[];
  projectCategories?: string[];
  priority?: ("low" | "normal" | "high" | "urgent")[];
  assignedToId?: number[];
  estimatorId?: number[];
  projectManagerId?: number[];
  customerId?: number;
  city?: string;
  state?: string;
  wonLostOpen?: ("open" | "won" | "lost")[];
  overdue?: boolean;
  bidDueBefore?: Date;
  followUpDue?: boolean;
  valueMin?: number;
  valueMax?: number;
}

export type CommercialSortBy =
  | "createdAt" | "updatedAt" | "title" | "amount" | "probability"
  | "bidDueAt" | "followUpAt" | "expectedCloseAt" | "priority";

export interface Paging {
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** The server `opportunities.commercial.list` input shape (subset we send). */
export interface CommercialListInput extends CommercialFilters {
  recordType: "commercial";
  mine?: boolean;
  sortBy?: CommercialSortBy;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const SORT_KEYS: CommercialSortBy[] = ["createdAt", "updatedAt", "title", "amount", "probability", "bidDueAt", "followUpAt", "expectedCloseAt", "priority"];
const asSortBy = (v: string | undefined): CommercialSortBy => (v && (SORT_KEYS as string[]).includes(v) ? (v as CommercialSortBy) : "createdAt");

/**
 * Build the server list input from the active view + user filters. The view
 * supplies a preset (e.g. "won" → wonLostOpen:["won"]); empty filters are
 * omitted. recordType is pinned to commercial so legacy QBO records never appear.
 */
export function buildCommercialListInput(view: CommercialView, filters: CommercialFilters = {}, paging: Paging = {}): CommercialListInput {
  const input: CommercialListInput = {
    recordType: COMMERCIAL_RECORD_TYPE,
    sortBy: asSortBy(paging.sortBy),
    sortDir: paging.sortDir ?? "desc",
    limit: paging.limit ?? (view === "board" ? 200 : 25),
    offset: paging.offset ?? 0,
  };

  // Copy only non-empty filters (server-side filtering; tidy payload).
  if (filters.search?.trim()) input.search = filters.search.trim();
  if (filters.stageId?.length) input.stageId = filters.stageId;
  if (filters.opportunityType?.length) input.opportunityType = filters.opportunityType;
  if (filters.projectCategories?.length) input.projectCategories = filters.projectCategories;
  if (filters.priority?.length) input.priority = filters.priority;
  if (filters.assignedToId?.length) input.assignedToId = filters.assignedToId;
  if (filters.estimatorId?.length) input.estimatorId = filters.estimatorId;
  if (filters.projectManagerId?.length) input.projectManagerId = filters.projectManagerId;
  if (filters.customerId != null) input.customerId = filters.customerId;
  if (filters.city?.trim()) input.city = filters.city.trim();
  if (filters.state?.trim()) input.state = filters.state.trim();
  if (filters.wonLostOpen?.length) input.wonLostOpen = filters.wonLostOpen;
  if (filters.overdue) input.overdue = true;
  if (filters.bidDueBefore) input.bidDueBefore = filters.bidDueBefore;
  if (filters.followUpDue) input.followUpDue = true;
  if (filters.valueMin != null) input.valueMin = filters.valueMin;
  if (filters.valueMax != null) input.valueMax = filters.valueMax;

  switch (view) {
    case "mine": input.mine = true; break;
    case "followups": input.followUpDue = true; break;
    case "won": input.wonLostOpen = mergeWlo(input.wonLostOpen, "won"); break;
    case "lost": input.wonLostOpen = mergeWlo(input.wonLostOpen, "lost"); break;
    case "board":
    case "all": break;
  }
  return input;
}

function mergeWlo(existing: ("open" | "won" | "lost")[] | undefined, add: "open" | "won" | "lost") {
  return Array.from(new Set([...(existing ?? []), add]));
}

// ── Board grouping ───────────────────────────────────────────────────────────

export interface BoardStage {
  id: number;
  stageKey: string;
  name: string;
  sortOrder: number;
  classification: StageClassification;
  isActive: boolean;
}

export interface BoardCard {
  id: number;
  stageId: number | null;
  [k: string]: unknown;
}

export interface BoardColumn<C> {
  stage: BoardStage;
  cards: C[];
}

/**
 * Group cards into columns ordered by the stage sortOrder. Only ACTIVE stages
 * become columns; a card whose stage is inactive/unknown is placed nowhere
 * (returned in `orphans`) rather than silently dropped.
 */
export function groupByStage<C extends BoardCard>(cards: C[], stages: BoardStage[]): { columns: BoardColumn<C>[]; orphans: C[] } {
  const active = stages.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const byStage = new Map<number, C[]>(active.map(s => [s.id, []]));
  const orphans: C[] = [];
  for (const card of cards) {
    const bucket = card.stageId != null ? byStage.get(card.stageId) : undefined;
    if (bucket) bucket.push(card);
    else orphans.push(card);
  }
  return { columns: active.map(stage => ({ stage, cards: byStage.get(stage.id) ?? [] })), orphans };
}

// ── Stage-move intent (drives the confirm/lost-reason dialogs) ───────────────

export type MoveIntent = "plain" | "confirm_won" | "require_lost_reason" | "noop";

/** Decide what a drag/menu move needs before it can be committed to the server. */
export function moveIntent(fromStageId: number | null, target: BoardStage): MoveIntent {
  if (fromStageId != null && fromStageId === target.id) return "noop";
  if (target.classification === "won") return "confirm_won";
  if (target.classification === "lost") return "require_lost_reason";
  return "plain";
}

// ── Checklist progress ───────────────────────────────────────────────────────

export interface ChecklistItemLike {
  isComplete: boolean;
  requiredForConversion: boolean;
}

export interface ChecklistProgress {
  total: number;
  done: number;
  pct: number;
  requiredTotal: number;
  requiredDone: number;
  requiredIncomplete: number;
  /** True when every conversion-required item is complete. */
  conversionReady: boolean;
}

export function checklistProgress(items: ChecklistItemLike[]): ChecklistProgress {
  const total = items.length;
  const done = items.filter(i => i.isComplete).length;
  const required = items.filter(i => i.requiredForConversion);
  const requiredDone = required.filter(i => i.isComplete).length;
  return {
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    requiredTotal: required.length,
    requiredDone,
    requiredIncomplete: required.length - requiredDone,
    conversionReady: required.length === requiredDone,
  };
}

// ── Card status helpers ──────────────────────────────────────────────────────

/** Overdue when a bid-due or follow-up date is in the past. */
export function isOverdue(bidDueAt: Date | string | null | undefined, followUpAt: Date | string | null | undefined, now: Date): boolean {
  const past = (d: Date | string | null | undefined) => (d != null ? new Date(d).getTime() < now.getTime() : false);
  return past(bidDueAt) || past(followUpAt);
}

/** The card's "next date" — the earlier of bid-due / follow-up, labelled. */
export function nextDate(bidDueAt: Date | string | null | undefined, followUpAt: Date | string | null | undefined): { kind: "bid" | "followup"; date: Date } | null {
  const bid = bidDueAt != null ? new Date(bidDueAt) : null;
  const fu = followUpAt != null ? new Date(followUpAt) : null;
  if (bid && fu) return bid.getTime() <= fu.getTime() ? { kind: "bid", date: bid } : { kind: "followup", date: fu };
  if (bid) return { kind: "bid", date: bid };
  if (fu) return { kind: "followup", date: fu };
  return null;
}

// ── Financials for display (calculated vs override — never conflated) ─────────

export interface FinancialView {
  estimatedValue: string | null;
  estimatedCost: string | null;
  calculatedMargin: string | null;
  calculatedMarginPercent: number | null;
  marginOverride: string | null;
  marginIsOverridden: boolean;
  effectiveMargin: string | null;
  weightedValue: string | null;
}

export function financialView(
  amount: string | number | null | undefined,
  estimatedCost: string | number | null | undefined,
  marginOverride: string | number | null | undefined,
  probability: number | null | undefined,
): FinancialView {
  const value = amount == null || amount === "" ? null : String(amount);
  const cost = estimatedCost == null || estimatedCost === "" ? null : String(estimatedCost);
  const override = marginOverride == null || marginOverride === "" ? null : String(marginOverride);
  const calculatedMargin = grossMargin(value, cost);
  return {
    estimatedValue: value,
    estimatedCost: cost,
    calculatedMargin,
    calculatedMarginPercent: grossMarginPercent(value, cost),
    marginOverride: override,
    marginIsOverridden: override !== null,
    effectiveMargin: override !== null ? override : calculatedMargin,
    weightedValue: sharedWeightedValue(value, probability ?? 0),
  };
}

// ── Money / date formatting for the UI ───────────────────────────────────────

export function fmtMoney(n: string | number | null | undefined): string {
  if (n == null || n === "") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Conversion validation → display rows ─────────────────────────────────────

export interface ConversionCheckRow {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ConversionValidationLike {
  canConvert: boolean;
  alreadyConverted: boolean;
  existingJob: { id: number; jobNumber: string; status: string } | null;
  blockers: { code: string; message: string }[];
  propertyResolution: string;
  incompleteRequiredChecklist: { id: number; label: string }[];
}

/** Turn the server validation into an ordered checklist the panel renders. */
export function conversionCheckRows(v: ConversionValidationLike): ConversionCheckRow[] {
  const has = (code: string) => v.blockers.some(b => b.code === code);
  return [
    { key: "commercial", label: "Commercial opportunity", ok: !has("NOT_COMMERCIAL") },
    { key: "stage", label: "Stage is conversion-eligible", ok: !has("STAGE_NOT_ELIGIBLE"), detail: "Awarded / Contract Signed / Deposit Received / Ready for Scheduling" },
    { key: "customer", label: "Customer linked", ok: !has("CUSTOMER_NOT_FOUND") },
    {
      key: "property",
      label: "Property linked",
      ok: !has("PROPERTY_REQUIRED") && !has("PROPERTY_INVALID") && !has("PROPERTY_SELECTION_REQUIRED"),
      detail: has("PROPERTY_SELECTION_REQUIRED") ? "Select which property this job is for" : undefined,
    },
    {
      key: "checklist",
      label: "Required checklist complete",
      ok: !has("CHECKLIST_INCOMPLETE"),
      detail: v.incompleteRequiredChecklist.length ? v.incompleteRequiredChecklist.map(i => i.label).join(", ") : undefined,
    },
  ];
}
