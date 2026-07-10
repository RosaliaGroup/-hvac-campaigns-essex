/**
 * Opportunity Center dashboard math (pure, unit-tested).
 *
 * All aggregation, weighting, aging, search, filter and sort semantics live
 * here as deterministic functions over an in-memory row shape. No DB or network
 * — the server builds equivalent SQL for the scalable path, but these functions
 * are the single source of truth for the *meaning* of each metric/filter and
 * are what the tests exercise. An injected `now` keeps everything deterministic.
 *
 * QuickBooks stays the source of truth for money: `quickbooksAmount` mirrors the
 * QBO document total (read-only) while `amount` is the editable CRM Opportunity
 * Value. Nothing here writes back to QuickBooks.
 */
import type { WorkCategory } from "./opportunityCategory";
import { deriveRelationship, type Relationship } from "./leadPipeline";

export type OpportunityStage = "new" | "proposal_sent" | "pending" | "won" | "lost";
export type SalesDocStatus = "pending" | "accepted" | "closed" | "rejected" | "expired";
export type WonLostOpen = "won" | "lost" | "open";
export type AgingBucket = "0-3" | "4-7" | "8-14" | "15+";

export const OPEN_STAGES: OpportunityStage[] = ["new", "proposal_sent", "pending"];
export const AGING_BUCKETS: AgingBucket[] = ["0-3", "4-7", "8-14", "15+"];

/** Default win probability (%) per stage, used when a row has no explicit probability. */
export const STAGE_DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  new: 10,
  proposal_sent: 30,
  pending: 50,
  won: 100,
  lost: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalized row the dashboard math operates on. The server projects each
 * opportunity (+ its primary sales doc + customer) into this shape.
 */
export interface OpportunityRow {
  id: number;
  stage: OpportunityStage;
  /** Editable CRM Opportunity Value. */
  amount: number;
  /** 0–100, or null to fall back to the stage default. */
  probability: number | null;
  /** Read-only QuickBooks document total, or null for a manual (non-QBO) opportunity. */
  quickbooksAmount: number | null;
  workCategory: WorkCategory | null;
  docStatus: SalesDocStatus | null;
  docType: "estimate" | "invoice" | null;
  /** Display doc-type label, e.g. "Estimate" | "Proposal" (derived; QBO has no Proposal entity). */
  docTypeLabel: string | null;
  assignedToId: number | null;
  customerName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  docNumber: string | null;
  /** Opportunity title (the "requested service"). */
  title: string | null;
  daysPending: number | null;
  sentAt: Date | null;
  txnDate: Date | null;
  createdAt: Date;
  nextActionDueAt: Date | null;
  closedAt: Date | null;
}

export function isOpenStage(stage: OpportunityStage): boolean {
  return stage === "new" || stage === "proposal_sent" || stage === "pending";
}
export function isWonStage(stage: OpportunityStage): boolean {
  return stage === "won";
}
export function isLostStage(stage: OpportunityStage): boolean {
  return stage === "lost";
}

/** The probability actually used for weighting: explicit value, else the stage default. Clamped 0–100. */
export function effectiveProbability(row: Pick<OpportunityRow, "stage" | "probability">): number {
  const p = row.probability ?? STAGE_DEFAULT_PROBABILITY[row.stage];
  return Math.max(0, Math.min(100, p));
}

/** weightedValue = amount × effectiveProbability / 100. */
export function weightedValue(row: Pick<OpportunityRow, "stage" | "amount" | "probability">): number {
  return round2(row.amount * (effectiveProbability(row) / 100));
}

/** True when the CRM Opportunity Value differs from the read-only QuickBooks amount. */
export function valueDiffersFromQuickbooks(
  row: Pick<OpportunityRow, "amount" | "quickbooksAmount">,
): boolean {
  if (row.quickbooksAmount == null) return false;
  return round2(row.amount) !== round2(row.quickbooksAmount);
}

/** Map whole days-pending to an aging bucket; null when there is no anchor date. */
export function agingBucket(daysPending: number | null | undefined): AgingBucket | null {
  if (daysPending == null) return null;
  if (daysPending <= 3) return "0-3";
  if (daysPending <= 7) return "4-7";
  if (daysPending <= 14) return "8-14";
  return "15+";
}

/** USD currency formatting for display. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationship lifecycle (requirement 8) — same rules everywhere.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relationship implied by an opportunity's state, reusing the shared lifecycle:
 *   accepted/closed document OR won opportunity  → "customer"
 *   pending/sent document OR open+engaged deal   → "prospect"
 *   otherwise                                    → "lead"
 */
export function relationshipForOpportunity(input: {
  stage: OpportunityStage;
  docStatus?: SalesDocStatus | null;
  hasAppointment?: boolean;
}): Relationship {
  const accepted = input.docStatus === "accepted" || input.docStatus === "closed";
  const isCustomer = accepted || input.stage === "won";
  // A live/sent document makes the contact at least a prospect.
  const sentDoc = input.docStatus === "pending";
  return deriveRelationship({
    stage: input.stage === "won" ? "won" : input.stage === "lost" ? "lost" : "contacted",
    isCustomer,
    hasEngagement: Boolean(input.hasAppointment) || sentDoc,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Search (requirement 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Fields a free-text query is matched against (mirrors the server-side SQL search). */
export function opportunitySearchHaystack(row: OpportunityRow): string {
  return [
    row.customerName,
    row.companyName,
    row.email,
    row.phone,
    row.docNumber,
    row.title,
    row.workCategory,
    row.amount != null ? String(row.amount) : null,
    `OPP-${row.id}`,
  ]
    .filter(Boolean)
    .join("  ")
    .toLowerCase();
}

export function matchesSearch(row: OpportunityRow, query: string | null | undefined): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return opportunitySearchHaystack(row).includes(q);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters (requirement 4) — combinable and independently optional.
// ─────────────────────────────────────────────────────────────────────────────

export interface OpportunityFilters {
  search?: string | null;
  workCategory?: WorkCategory[] | null;
  /** "estimate" | "proposal" — proposal is a derived label, both are QBO Estimates. */
  docTypeLabel?: string[] | null;
  stage?: OpportunityStage[] | null;
  docStatus?: SalesDocStatus[] | null;
  assignedToId?: number[] | null;
  /** Inclusive range on the sent/issue date. */
  dateFrom?: Date | null;
  dateTo?: Date | null;
  amountMin?: number | null;
  amountMax?: number | null;
  followUpDue?: boolean | null;
  agingBucket?: AgingBucket[] | null;
  wonLostOpen?: WonLostOpen[] | null;
}

function anchorDate(row: OpportunityRow): Date | null {
  return row.sentAt ?? row.txnDate ?? null;
}

export function wonLostOpenOf(row: OpportunityRow): WonLostOpen {
  if (isWonStage(row.stage)) return "won";
  if (isLostStage(row.stage)) return "lost";
  return "open";
}

export function matchesFilters(
  row: OpportunityRow,
  filters: OpportunityFilters,
  now: Date = new Date(),
): boolean {
  if (!matchesSearch(row, filters.search)) return false;

  if (filters.workCategory?.length) {
    if (!row.workCategory || !filters.workCategory.includes(row.workCategory)) return false;
  }
  if (filters.docTypeLabel?.length) {
    const label = (row.docTypeLabel ?? "").toLowerCase();
    if (!filters.docTypeLabel.map(l => l.toLowerCase()).includes(label)) return false;
  }
  if (filters.stage?.length && !filters.stage.includes(row.stage)) return false;
  if (filters.docStatus?.length) {
    if (!row.docStatus || !filters.docStatus.includes(row.docStatus)) return false;
  }
  if (filters.assignedToId?.length) {
    if (row.assignedToId == null || !filters.assignedToId.includes(row.assignedToId)) return false;
  }
  if (filters.dateFrom || filters.dateTo) {
    const d = anchorDate(row);
    if (!d) return false;
    if (filters.dateFrom && d.getTime() < filters.dateFrom.getTime()) return false;
    if (filters.dateTo && d.getTime() > filters.dateTo.getTime()) return false;
  }
  if (filters.amountMin != null && row.amount < filters.amountMin) return false;
  if (filters.amountMax != null && row.amount > filters.amountMax) return false;
  if (filters.followUpDue) {
    if (!isFollowUpDue(row, now)) return false;
  }
  if (filters.agingBucket?.length) {
    const b = agingBucket(row.daysPending);
    if (!b || !filters.agingBucket.includes(b)) return false;
  }
  if (filters.wonLostOpen?.length && !filters.wonLostOpen.includes(wonLostOpenOf(row))) return false;
  return true;
}

/** A follow-up is "due" when the opportunity is open and its next action is at/before end of today. */
export function isFollowUpDue(row: OpportunityRow, now: Date = new Date()): boolean {
  if (!isOpenStage(row.stage)) return false;
  if (!row.nextActionDueAt) return false;
  return row.nextActionDueAt.getTime() <= endOfDay(now).getTime();
}

export function filterOpportunities(
  rows: OpportunityRow[],
  filters: OpportunityFilters,
  now: Date = new Date(),
): OpportunityRow[] {
  return rows.filter(r => matchesFilters(r, filters, now));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sorting (requirement 3)
// ─────────────────────────────────────────────────────────────────────────────

export type SortKey =
  | "customer"
  | "amount"
  | "stage"
  | "sentAt"
  | "createdAt"
  | "daysPending"
  | "nextFollowUp"
  | "assignedTo"
  | "docStatus"
  | "workCategory";
export type SortDir = "asc" | "desc";

const STAGE_ORDER: Record<OpportunityStage, number> = {
  new: 0,
  proposal_sent: 1,
  pending: 2,
  won: 3,
  lost: 4,
};

function sortValue(row: OpportunityRow, key: SortKey): number | string {
  switch (key) {
    case "customer":
      return (row.companyName || row.customerName || "").toLowerCase();
    case "amount":
      return row.amount;
    case "stage":
      return STAGE_ORDER[row.stage];
    case "sentAt":
      return row.sentAt ? row.sentAt.getTime() : -Infinity;
    case "createdAt":
      return row.createdAt.getTime();
    case "daysPending":
      return row.daysPending ?? -Infinity;
    case "nextFollowUp":
      return row.nextActionDueAt ? row.nextActionDueAt.getTime() : Infinity;
    case "assignedTo":
      return row.assignedToId ?? -Infinity;
    case "docStatus":
      return row.docStatus ?? "";
    case "workCategory":
      return row.workCategory ?? "";
  }
}

export function compareOpportunities(a: OpportunityRow, b: OpportunityRow, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv));
  if (cmp === 0) cmp = a.id - b.id; // stable tiebreak
  return dir === "asc" ? cmp : -cmp;
}

export function sortOpportunities(rows: OpportunityRow[], key: SortKey, dir: SortDir): OpportunityRow[] {
  return [...rows].sort((a, b) => compareOpportunities(a, b, key, dir));
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtered totals (requirement 7: total filtered pipeline value)
// ─────────────────────────────────────────────────────────────────────────────

export interface FilteredTotals {
  count: number;
  totalValue: number;
  weightedValue: number;
  quickbooksTotal: number;
}

export function filteredTotals(rows: OpportunityRow[]): FilteredTotals {
  let totalValue = 0;
  let weighted = 0;
  let qb = 0;
  for (const r of rows) {
    totalValue += r.amount;
    weighted += weightedValue(r);
    qb += r.quickbooksAmount ?? 0;
  }
  return {
    count: rows.length,
    totalValue: round2(totalValue),
    weightedValue: round2(weighted),
    quickbooksTotal: round2(qb),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview KPIs (requirement 1)
// ─────────────────────────────────────────────────────────────────────────────

export interface OverviewMetrics {
  openPipeline: number;
  weightedPipeline: number;
  sentCount: number;
  followUpsDueToday: number;
  wonThisMonth: number;
  lostThisMonth: number;
  wonValueThisMonth: number;
  closeRate: number; // 0..1 over all closed deals in the set
  averageTicket: number; // avg value of won deals
  averageDaysToClose: number; // avg createdAt→closedAt days for won deals
  pipelineByStage: Record<OpportunityStage, number>;
  categoryTotals: Record<WorkCategory, number>;
  agingBuckets: Record<AgingBucket, { count: number; amount: number }>;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}
function endOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function computeOverview(rows: OpportunityRow[], now: Date = new Date()): OverviewMetrics {
  const monthStart = startOfMonth(now).getTime();
  const pipelineByStage: Record<OpportunityStage, number> = {
    new: 0,
    proposal_sent: 0,
    pending: 0,
    won: 0,
    lost: 0,
  };
  const categoryTotals: Record<WorkCategory, number> = { residential: 0, commercial: 0, change_order: 0 };
  const agingBuckets: Record<AgingBucket, { count: number; amount: number }> = {
    "0-3": { count: 0, amount: 0 },
    "4-7": { count: 0, amount: 0 },
    "8-14": { count: 0, amount: 0 },
    "15+": { count: 0, amount: 0 },
  };

  let openPipeline = 0;
  let weightedPipeline = 0;
  let sentCount = 0;
  let followUpsDueToday = 0;
  let wonThisMonth = 0;
  let lostThisMonth = 0;
  let wonValueThisMonth = 0;
  let totalWon = 0;
  let totalLost = 0;
  let wonValueSum = 0;
  let daysToCloseSum = 0;
  let daysToCloseCount = 0;

  for (const r of rows) {
    pipelineByStage[r.stage] += r.amount;

    if (isOpenStage(r.stage)) {
      openPipeline += r.amount;
      weightedPipeline += weightedValue(r);
      if (r.workCategory) categoryTotals[r.workCategory] += r.amount;
      const b = agingBucket(r.daysPending);
      if (b) {
        agingBuckets[b].count += 1;
        agingBuckets[b].amount += r.amount;
      }
      if (r.sentAt) sentCount += 1;
      if (isFollowUpDue(r, now)) followUpsDueToday += 1;
    }

    if (isWonStage(r.stage)) {
      totalWon += 1;
      wonValueSum += r.amount;
      if (r.closedAt) {
        const days = Math.max(0, Math.floor((r.closedAt.getTime() - r.createdAt.getTime()) / DAY_MS));
        daysToCloseSum += days;
        daysToCloseCount += 1;
        if (r.closedAt.getTime() >= monthStart) {
          wonThisMonth += 1;
          wonValueThisMonth += r.amount;
        }
      }
    }
    if (isLostStage(r.stage)) {
      totalLost += 1;
      if (r.closedAt && r.closedAt.getTime() >= monthStart) lostThisMonth += 1;
    }
  }

  const closedTotal = totalWon + totalLost;
  return {
    openPipeline: round2(openPipeline),
    weightedPipeline: round2(weightedPipeline),
    sentCount,
    followUpsDueToday,
    wonThisMonth,
    lostThisMonth,
    wonValueThisMonth: round2(wonValueThisMonth),
    closeRate: closedTotal === 0 ? 0 : round2(totalWon / closedTotal),
    averageTicket: totalWon === 0 ? 0 : round2(wonValueSum / totalWon),
    averageDaysToClose: daysToCloseCount === 0 ? 0 : Math.round(daysToCloseSum / daysToCloseCount),
    pipelineByStage: roundRecord(pipelineByStage),
    categoryTotals: roundRecord(categoryTotals),
    agingBuckets: {
      "0-3": { count: agingBuckets["0-3"].count, amount: round2(agingBuckets["0-3"].amount) },
      "4-7": { count: agingBuckets["4-7"].count, amount: round2(agingBuckets["4-7"].amount) },
      "8-14": { count: agingBuckets["8-14"].count, amount: round2(agingBuckets["8-14"].amount) },
      "15+": { count: agingBuckets["15+"].count, amount: round2(agingBuckets["15+"].amount) },
    },
  };
}

function roundRecord<K extends string>(rec: Record<K, number>): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of Object.keys(rec) as K[]) out[k] = round2(rec[k]);
  return out;
}
