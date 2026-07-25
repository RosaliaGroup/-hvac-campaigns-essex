/**
 * Opportunities router — powers the Opportunity Center v2 dashboard.
 *
 * QuickBooks remains the source of truth for sales documents and the QuickBooks
 * Amount (read-only). Mechanical Enterprise owns pipeline stage, the CRM
 * Opportunity Value, probability, assignments, follow-ups and closing analytics.
 * Manual stage/value edits set override flags that the QBO sync then respects.
 * Nothing here pushes back to QuickBooks. Raw QBO payloads are never returned.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  OPPORTUNITY_PRIORITIES,
  appendSortOrder,
  planReorder,
  decideStageMove,
  resolvePropertyLink,
  buildCreateValues,
  isClosedStage,
  type BoardCard,
} from "./opportunityBoard";
import {
  opportunities,
  opportunityEvents,
  opportunityTasks,
  quickbooksSalesDocuments,
  customers,
  customerSyncConflicts,
  properties,
  appointments,
  teamMembers,
  jobs,
  type InsertJob,
} from "../../drizzle/schema";
import { makeJobNumber } from "./jobs";
import {
  convertOpportunityToJob,
  ConvertError,
  type ConvertJobPort,
} from "./opportunityToJob";
import { computeDaysPending } from "../integrations/accounting/estimates";
import { cancelOpenFollowups, smsFollowupsEnabled } from "../integrations/accounting/followups";
import { extractSalesDocSignals, deriveDocTypeLabel, deriveWorkCategory } from "@shared/opportunityCategory";
import {
  AGING_BUCKETS,
  agingBucket,
  computeOverview,
  effectiveProbability,
  filteredTotals,
  relationshipForOpportunity,
  valueDiffersFromQuickbooks,
  weightedValue,
  type OpportunityRow,
} from "@shared/opportunityDashboard";

const STAGE_ENUM = ["new", "proposal_sent", "pending", "won", "lost"] as const;
const OPEN_STAGES = ["new", "proposal_sent", "pending"] as const;
const DOC_STATUS_ENUM = ["pending", "accepted", "closed", "rejected", "expired"] as const;
const WORK_CATEGORY_ENUM = ["residential", "commercial", "change_order"] as const;
const PRIORITY_ENUM = OPPORTUNITY_PRIORITIES;
const AGING_ENUM = ["0-3", "4-7", "8-14", "15+"] as const;
const WON_LOST_OPEN_ENUM = ["won", "lost", "open"] as const;
const SORT_ENUM = [
  "customer", "amount", "stage", "sentAt", "createdAt",
  "daysPending", "nextFollowUp", "assignedTo", "docStatus", "workCategory",
  "priority", "expectedCloseAt", "sortOrder",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** SQL: weighted value using explicit probability or the stage default. */
const weightedSql = sql<string>`${opportunities.amount} * (COALESCE(${opportunities.probability}, CASE ${opportunities.stage} WHEN 'new' THEN 10 WHEN 'proposal_sent' THEN 30 WHEN 'pending' THEN 50 WHEN 'won' THEN 100 ELSE 0 END)) / 100`;
/** SQL: whole days pending, anchored on sent (else issue) date, per the DB clock. */
const daysPendingSql = sql<number>`DATEDIFF(CURDATE(), COALESCE(${quickbooksSalesDocuments.sentAt}, ${quickbooksSalesDocuments.txnDate}))`;
/** SQL: the anchor date used by date-range + aging filters. */
const anchorSql = sql`COALESCE(${quickbooksSalesDocuments.sentAt}, ${quickbooksSalesDocuments.txnDate})`;

function endOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

const listInput = z
  .object({
    search: z.string().max(255).optional(),
    // Back-compat: single stage still accepted; `stages` is the multi-select form.
    stage: z.enum(STAGE_ENUM).optional(),
    stages: z.array(z.enum(STAGE_ENUM)).optional(),
    docStatus: z.array(z.enum(DOC_STATUS_ENUM)).optional(),
    workCategory: z.array(z.enum(WORK_CATEGORY_ENUM)).optional(),
    priority: z.array(z.enum(PRIORITY_ENUM)).optional(),
    docTypeLabel: z.array(z.enum(["estimate", "proposal"])).optional(),
    assignedToId: z.array(z.number().int()).optional(),
    wonLostOpen: z.array(z.enum(WON_LOST_OPEN_ENUM)).optional(),
    amountMin: z.number().optional(),
    amountMax: z.number().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    agingBucket: z.array(z.enum(AGING_ENUM)).optional(),
    followUpDue: z.boolean().optional(),
    sortBy: z.enum(SORT_ENUM).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .default({ sortBy: "createdAt", sortDir: "desc", limit: 50, offset: 0 });

/** Build the combined WHERE conditions shared by the list + totals queries. */
function buildConditions(input: z.infer<typeof listInput>, now: Date) {
  const conditions = [];

  if (input.search?.trim()) {
    const s = input.search.trim();
    const q = `%${s}%`;
    const digits = s.replace(/[^0-9]/g, "");
    const parts = [
      like(customers.displayName, q),
      like(customers.companyName, q),
      like(customers.firstName, q),
      like(customers.lastName, q),
      like(customers.email, q),
      like(quickbooksSalesDocuments.docNumber, q),
      like(opportunities.title, q),
      sql`CAST(${opportunities.amount} AS CHAR) LIKE ${q}`,
      sql`CONCAT('OPP-', ${opportunities.id}) LIKE ${q}`,
    ];
    if (digits.length >= 4) {
      parts.push(sql`RIGHT(REGEXP_REPLACE(COALESCE(${customers.phone}, ''), '[^0-9]', ''), 10) LIKE ${`%${digits}%`}`);
    }
    conditions.push(or(...parts));
  }

  const stages = input.stages ?? (input.stage ? [input.stage] : undefined);
  if (stages?.length) conditions.push(inArray(opportunities.stage, stages));
  if (input.docStatus?.length) conditions.push(inArray(quickbooksSalesDocuments.status, input.docStatus));
  if (input.workCategory?.length) conditions.push(inArray(opportunities.workCategory, input.workCategory));
  if (input.priority?.length) conditions.push(inArray(opportunities.priority, input.priority));
  if (input.assignedToId?.length) conditions.push(inArray(opportunities.assignedToId, input.assignedToId));

  if (input.wonLostOpen?.length) {
    const wlo = new Set(input.wonLostOpen);
    const stagesFromWlo: (typeof STAGE_ENUM)[number][] = [];
    if (wlo.has("open")) stagesFromWlo.push(...OPEN_STAGES);
    if (wlo.has("won")) stagesFromWlo.push("won");
    if (wlo.has("lost")) stagesFromWlo.push("lost");
    conditions.push(inArray(opportunities.stage, stagesFromWlo));
  }

  if (input.amountMin != null) conditions.push(sql`${opportunities.amount} >= ${input.amountMin}`);
  if (input.amountMax != null) conditions.push(sql`${opportunities.amount} <= ${input.amountMax}`);
  if (input.dateFrom) conditions.push(sql`${anchorSql} >= ${input.dateFrom}`);
  if (input.dateTo) conditions.push(sql`${anchorSql} <= ${input.dateTo}`);

  if (input.agingBucket?.length) {
    const ranges = input.agingBucket.map(b => {
      if (b === "0-3") return sql`(${daysPendingSql} BETWEEN 0 AND 3)`;
      if (b === "4-7") return sql`(${daysPendingSql} BETWEEN 4 AND 7)`;
      if (b === "8-14") return sql`(${daysPendingSql} BETWEEN 8 AND 14)`;
      return sql`(${daysPendingSql} >= 15)`;
    });
    conditions.push(or(...ranges));
  }

  if (input.followUpDue) {
    conditions.push(
      and(
        inArray(opportunities.stage, OPEN_STAGES),
        sql`${opportunities.nextActionDueAt} IS NOT NULL`,
        sql`${opportunities.nextActionDueAt} <= ${endOfToday(now)}`,
      ),
    );
  }

  // "Proposal" is a display-derived label (QBO has no Proposal entity); match on
  // the stored payload text. "estimate" = everything not explicitly a proposal.
  if (input.docTypeLabel?.length) {
    const wants = new Set(input.docTypeLabel);
    if (wants.has("proposal") && !wants.has("estimate")) {
      conditions.push(sql`LOWER(CAST(${quickbooksSalesDocuments.raw} AS CHAR)) LIKE '%proposal%'`);
    } else if (wants.has("estimate") && !wants.has("proposal")) {
      conditions.push(sql`(${quickbooksSalesDocuments.raw} IS NULL OR LOWER(CAST(${quickbooksSalesDocuments.raw} AS CHAR)) NOT LIKE '%proposal%')`);
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

function orderExpression(sortBy: (typeof SORT_ENUM)[number]) {
  switch (sortBy) {
    case "customer":
      return sql`COALESCE(${customers.companyName}, ${customers.displayName})`;
    case "amount":
      return opportunities.amount;
    case "stage":
      return sql`FIELD(${opportunities.stage}, 'new','proposal_sent','pending','won','lost')`;
    case "sentAt":
      return quickbooksSalesDocuments.sentAt;
    case "createdAt":
      return opportunities.createdAt;
    case "daysPending":
      return daysPendingSql;
    case "nextFollowUp":
      return opportunities.nextActionDueAt;
    case "assignedTo":
      return opportunities.assignedToId;
    case "docStatus":
      return quickbooksSalesDocuments.status;
    case "workCategory":
      return opportunities.workCategory;
    case "priority":
      // Rank urgent→low so `desc` puts the most urgent first; unset sorts lowest.
      return sql`CASE ${opportunities.priority} WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END`;
    case "expectedCloseAt":
      return opportunities.expectedCloseAt;
    case "sortOrder":
      // Board order: intra-stage rank. Pair with a stage filter for a single column.
      return opportunities.sortOrder;
  }
}

/** Columns projected for both the dashboard list and the overview aggregation. */
const projection = {
  id: opportunities.id,
  stage: opportunities.stage,
  amount: opportunities.amount,
  probability: opportunities.probability,
  amountOverridden: opportunities.amountOverridden,
  stageOverridden: opportunities.stageOverridden,
  workCategory: opportunities.workCategory,
  priority: opportunities.priority,
  expectedCloseAt: opportunities.expectedCloseAt,
  sortOrder: opportunities.sortOrder,
  propertyId: opportunities.propertyId,
  title: opportunities.title,
  nextAction: opportunities.nextAction,
  nextActionDueAt: opportunities.nextActionDueAt,
  assignedToId: opportunities.assignedToId,
  createdAt: opportunities.createdAt,
  updatedAt: opportunities.updatedAt,
  closedAt: opportunities.closedAt,
  customerId: opportunities.customerId,
  customerName: customers.displayName,
  customerType: customers.type,
  customerCompany: customers.companyName,
  customerEmail: customers.email,
  customerPhone: customers.phone,
  docId: quickbooksSalesDocuments.id,
  docType: quickbooksSalesDocuments.docType,
  docNumber: quickbooksSalesDocuments.docNumber,
  docStatus: quickbooksSalesDocuments.status,
  docAmount: quickbooksSalesDocuments.totalAmount,
  txnDate: quickbooksSalesDocuments.txnDate,
  sentAt: quickbooksSalesDocuments.sentAt,
  documentLink: quickbooksSalesDocuments.documentLink,
  raw: quickbooksSalesDocuments.raw,
};

type ProjectedRow = {
  [K in keyof typeof projection]: unknown;
};

/** Turn a projected DB row into the pure OpportunityRow used by the dashboard math. */
function toOpportunityRow(r: Record<string, unknown>): OpportunityRow {
  const signals = extractSalesDocSignals(r.raw);
  return {
    id: Number(r.id),
    stage: r.stage as OpportunityRow["stage"],
    amount: Number(r.amount ?? 0),
    probability: r.probability == null ? null : Number(r.probability),
    quickbooksAmount: r.docAmount == null ? null : Number(r.docAmount),
    workCategory: (r.workCategory as OpportunityRow["workCategory"]) ?? null,
    docStatus: (r.docStatus as OpportunityRow["docStatus"]) ?? null,
    docType: (r.docType as OpportunityRow["docType"]) ?? null,
    docTypeLabel: r.docId ? deriveDocTypeLabel({ docType: String(r.docType ?? "estimate"), text: signals.text }) : null,
    assignedToId: r.assignedToId == null ? null : Number(r.assignedToId),
    customerName: String(r.customerName ?? "Unknown"),
    companyName: (r.customerCompany as string) ?? null,
    email: (r.customerEmail as string) ?? null,
    phone: (r.customerPhone as string) ?? null,
    docNumber: (r.docNumber as string) ?? null,
    title: (r.title as string) ?? null,
    daysPending: computeDaysPending({ sentAt: r.sentAt as Date | null, txnDate: r.txnDate as Date | null }),
    sentAt: (r.sentAt as Date) ?? null,
    txnDate: (r.txnDate as Date) ?? null,
    createdAt: (r.createdAt as Date) ?? new Date(),
    nextActionDueAt: (r.nextActionDueAt as Date) ?? null,
    closedAt: (r.closedAt as Date) ?? null,
  };
}

/** Shape a projected row for the client (adds derived display fields, drops raw). */
function toListItem(r: Record<string, unknown>) {
  const rowForMath = toOpportunityRow(r);
  const signals = extractSalesDocSignals(r.raw);
  return {
    id: rowForMath.id,
    stage: rowForMath.stage,
    amount: rowForMath.amount,
    probability: rowForMath.probability,
    effectiveProbability: effectiveProbability(rowForMath),
    weightedValue: weightedValue(rowForMath),
    amountOverridden: Boolean(r.amountOverridden),
    stageOverridden: Boolean(r.stageOverridden),
    quickbooksAmount: rowForMath.quickbooksAmount,
    valueDiffersFromQuickbooks: valueDiffersFromQuickbooks(rowForMath),
    workCategory: rowForMath.workCategory,
    priority: (r.priority as string) ?? null,
    expectedCloseAt: (r.expectedCloseAt as Date) ?? null,
    sortOrder: Number(r.sortOrder ?? 0),
    propertyId: r.propertyId == null ? null : Number(r.propertyId),
    docTypeLabel: rowForMath.docTypeLabel,
    title: rowForMath.title,
    nextAction: (r.nextAction as string) ?? null,
    nextActionDueAt: rowForMath.nextActionDueAt,
    assignedToId: rowForMath.assignedToId,
    customerId: Number(r.customerId),
    customerName: rowForMath.customerName,
    customerType: (r.customerType as string) ?? null,
    customerCompany: rowForMath.companyName,
    customerEmail: rowForMath.email,
    customerPhone: rowForMath.phone,
    docId: r.docId == null ? null : Number(r.docId),
    docType: rowForMath.docType,
    docNumber: rowForMath.docNumber,
    docStatus: rowForMath.docStatus,
    txnDate: rowForMath.txnDate,
    sentAt: rowForMath.sentAt,
    documentLink: (r.documentLink as string) ?? null,
    daysPending: rowForMath.daysPending,
    agingBucket: agingBucket(rowForMath.daysPending),
    categoryText: signals.text,
    linkedToExistingJob: signals.linkedToExistingJob,
    createdAt: rowForMath.createdAt,
    updatedAt: (r.updatedAt as Date) ?? null,
  };
}

const OVERVIEW_CAP = 10000;

async function insertEvent(
  db: { insert: NonNullable<Awaited<ReturnType<typeof getDb>>>["insert"] },
  opportunityId: number,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
  actorId?: number | null,
) {
  await db.insert(opportunityEvents).values({ opportunityId, type, message, metadata: metadata ?? null, actorId: actorId ?? null });
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Atomic, auditable pipeline-stage move — the single transactional path used by
 * setStage / markWon / markLost. Mirrors completeJob's commit-or-rollback and
 * persistReschedule's optimistic guard:
 *  - reads current stage INSIDE the transaction,
 *  - honours an optional `expectedStage` (client's last-seen value) → CONFLICT if stale,
 *  - re-guards the UPDATE with `WHERE id = ? AND stage = fromStage` so a race that
 *    slips between our read and write also becomes a CONFLICT (never a lost update),
 *  - writes the `status_changed` audit event (actor + from/to) in the SAME tx.
 * Follow-up cancellation is a downstream side effect and runs OUTSIDE the tx.
 */
async function performStageMove(
  db: Db,
  params: {
    id: number;
    toStage: (typeof STAGE_ENUM)[number];
    expectedStage?: (typeof STAGE_ENUM)[number] | null;
    toSortOrder?: number;
    closeReason?: string | null;
    lossReason?: string | null;
    /** markWon/markLost re-apply reason + close stamp even when already in that stage. */
    allowSameStage?: boolean;
    actorId: number;
  },
): Promise<{ moved: boolean; closing: boolean; fromStage: (typeof STAGE_ENUM)[number] }> {
  const now = new Date();
  const CONFLICT = new TRPCError({ code: "CONFLICT", message: "That opportunity was just updated somewhere else. Refresh and try again." });

  const applyReasons = (set: Record<string, unknown>) => {
    if (params.closeReason !== undefined) set.closeReason = params.closeReason ?? null;
    if (params.lossReason !== undefined) set.lossReason = params.lossReason ?? null;
  };

  return db.transaction(async tx => {
    const current = (await tx
      .select({ stage: opportunities.stage, closedAt: opportunities.closedAt })
      .from(opportunities)
      .where(eq(opportunities.id, params.id))
      .limit(1))[0] ?? null;

    // Placement rank in the target column (bottom-append unless explicitly given).
    let placement = params.toSortOrder;
    if (placement == null) {
      const [{ maxOrder = null } = { maxOrder: null }] = await tx
        .select({ maxOrder: sql<number | null>`MAX(${opportunities.sortOrder})` })
        .from(opportunities)
        .where(eq(opportunities.stage, params.toStage));
      placement = appendSortOrder(maxOrder == null ? [] : [Number(maxOrder)]);
    }

    const decision = decideStageMove(current, {
      toStage: params.toStage,
      expectedStage: params.expectedStage ?? null,
      placementSortOrder: placement,
      now,
    });

    if (decision.kind === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
    if (decision.kind === "stale") throw new TRPCError({ code: "CONFLICT", message: decision.reason });

    if (decision.kind === "noop") {
      if (!params.allowSameStage) return { moved: false, closing: false, fromStage: decision.stage };
      // markWon/markLost on a deal already in that stage: refresh close stamp + reason.
      const closing = isClosedStage(params.toStage);
      const set: Record<string, unknown> = { stageOverridden: true, closedAt: closing ? now : null };
      applyReasons(set);
      const upd = await tx.update(opportunities).set(set).where(and(eq(opportunities.id, params.id), eq(opportunities.stage, params.toStage)));
      if (Number((upd as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 0) throw CONFLICT;
      await insertEvent(tx, params.id, "status_changed", `Stage confirmed ${params.toStage} (manual).`, { fromStage: decision.stage, toStage: params.toStage }, params.actorId);
      return { moved: true, closing, fromStage: decision.stage };
    }

    const set: Record<string, unknown> = { ...decision.set };
    applyReasons(set);
    const upd = await tx
      .update(opportunities)
      .set(set)
      .where(and(eq(opportunities.id, params.id), eq(opportunities.stage, decision.fromStage)));
    if (Number((upd as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 0) throw CONFLICT;

    await insertEvent(tx, params.id, "status_changed", `Stage → ${params.toStage} (manual).`, { fromStage: decision.fromStage, toStage: decision.toStage }, params.actorId);
    return { moved: true, closing: decision.closing, fromStage: decision.fromStage };
  });
}

export const opportunitiesRouter = router({
  /**
   * Dashboard list: one row per opportunity joined to its customer and PRIMARY
   * QuickBooks sales document (one-to-one via quickbooksSalesDocumentId). Fully
   * server-side search / sort / filter / paginate, plus filtered totals.
   */
  list: protectedProcedure.input(listInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0, totals: { count: 0, totalValue: 0, weightedValue: 0, quickbooksTotal: 0 } };

    const now = new Date();
    const where = buildConditions(input, now);
    const orderCol = orderExpression(input.sortBy);
    const orderBy = input.sortDir === "asc" ? sql`${orderCol} asc` : sql`${orderCol} desc`;

    const rows = await db
      .select(projection)
      .from(opportunities)
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .leftJoin(quickbooksSalesDocuments, eq(opportunities.quickbooksSalesDocumentId, quickbooksSalesDocuments.id))
      .where(where)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    const items = rows.map(r => toListItem(r as Record<string, unknown>));

    const [agg = { count: 0, totalValue: null, weightedValue: null, qbTotal: null }] = await db
      .select({
        count: sql<number>`count(*)`,
        totalValue: sql<string>`COALESCE(SUM(${opportunities.amount}), 0)`,
        weightedValue: sql<string>`COALESCE(SUM(${weightedSql}), 0)`,
        qbTotal: sql<string>`COALESCE(SUM(${quickbooksSalesDocuments.totalAmount}), 0)`,
      })
      .from(opportunities)
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .leftJoin(quickbooksSalesDocuments, eq(opportunities.quickbooksSalesDocumentId, quickbooksSalesDocuments.id))
      .where(where);

    return {
      items,
      total: Number(agg.count),
      totals: {
        count: Number(agg.count),
        totalValue: Number(agg.totalValue ?? 0),
        weightedValue: Number(agg.weightedValue ?? 0),
        quickbooksTotal: Number(agg.qbTotal ?? 0),
      },
    };
  }),

  /** Legacy pipeline counts by stage (kept for the existing header chips). */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStage: {} as Record<string, number> };
    const rows = await db
      .select({ stage: opportunities.stage, count: sql<number>`count(*)` })
      .from(opportunities)
      .groupBy(opportunities.stage);
    const byStage: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStage[r.stage] = Number(r.count);
      total += Number(r.count);
    }
    return { total, byStage };
  }),

  /** Overview KPIs: open + weighted pipeline, close rate, aging, category totals, etc. */
  overview: protectedProcedure.query(async () => {
    const db = await getDb();
    const empty = {
      openPipeline: 0, weightedPipeline: 0, sentCount: 0, followUpsDueToday: 0,
      wonThisMonth: 0, lostThisMonth: 0, wonValueThisMonth: 0, closeRate: 0,
      averageTicket: 0, averageDaysToClose: 0,
      pipelineByStage: { new: 0, proposal_sent: 0, pending: 0, won: 0, lost: 0 },
      categoryTotals: { residential: 0, commercial: 0, change_order: 0 },
      agingBuckets: Object.fromEntries(AGING_BUCKETS.map(b => [b, { count: 0, amount: 0 }])),
    };
    if (!db) return empty;
    const rows = await db
      .select(projection)
      .from(opportunities)
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .leftJoin(quickbooksSalesDocuments, eq(opportunities.quickbooksSalesDocumentId, quickbooksSalesDocuments.id))
      .limit(OVERVIEW_CAP);
    const mapped = rows.map(r => toOpportunityRow(r as Record<string, unknown>));
    return computeOverview(mapped, new Date());
  }),

  /** Team members available as salespeople (for filters + assignment). */
  salespeople: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [] as { id: number; name: string }[];
    const rows = await db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(inArray(teamMembers.status, ["active", "invited"]));
    return rows;
  }),

  /**
   * Detail: opportunity + customer (with billing address), service addresses,
   * sales documents (QBO amount), tasks, the customer's appointments, timeline,
   * and any open sync conflicts. CRM value/probability come from the opportunity.
   */
  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
    if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });

    const [customer, serviceAddresses, docs, tasks, appts, events, conflicts, linkedJobs] = await Promise.all([
      db.select().from(customers).where(eq(customers.id, opp.customerId)).limit(1),
      db.select().from(properties).where(eq(properties.customerId, opp.customerId)),
      db.select().from(quickbooksSalesDocuments).where(eq(quickbooksSalesDocuments.opportunityId, input.id)),
      db.select().from(opportunityTasks).where(eq(opportunityTasks.opportunityId, input.id)).orderBy(opportunityTasks.dueAt),
      db.select().from(appointments).where(eq(appointments.customerId, opp.customerId)).orderBy(desc(appointments.scheduledAt)),
      db.select().from(opportunityEvents).where(eq(opportunityEvents.opportunityId, input.id)).orderBy(desc(opportunityEvents.createdAt)),
      db.select().from(customerSyncConflicts).where(and(eq(customerSyncConflicts.customerId, opp.customerId), eq(customerSyncConflicts.status, "open"))),
      db.select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status, title: jobs.title, createdAt: jobs.createdAt })
        .from(jobs).where(eq(jobs.opportunityId, input.id)).orderBy(jobs.id),
    ]);

    // Never ship the raw QBO payload; expose only the derived signals it needs.
    const primaryDoc = docs.find(d => d.id === opp.quickbooksSalesDocumentId) ?? docs[0] ?? null;
    const salesDocuments = docs.map(({ raw, ...d }) => {
      const signals = extractSalesDocSignals(raw);
      return { ...d, categoryText: signals.text, linkedToExistingJob: signals.linkedToExistingJob };
    });

    const quickbooksAmount = primaryDoc ? Number(primaryDoc.totalAmount) : null;
    const opportunityValue = Number(opp.amount);
    const row: OpportunityRow = {
      id: opp.id, stage: opp.stage, amount: opportunityValue, probability: opp.probability,
      quickbooksAmount, workCategory: opp.workCategory ?? null, docStatus: primaryDoc?.status ?? null,
      docType: primaryDoc?.docType ?? null, docTypeLabel: null, assignedToId: opp.assignedToId,
      customerName: customer[0]?.displayName ?? "Unknown", companyName: customer[0]?.companyName ?? null,
      email: customer[0]?.email ?? null, phone: customer[0]?.phone ?? null, docNumber: primaryDoc?.docNumber ?? null,
      title: opp.title, daysPending: computeDaysPending({ sentAt: primaryDoc?.sentAt, txnDate: primaryDoc?.txnDate }),
      sentAt: primaryDoc?.sentAt ?? null, txnDate: primaryDoc?.txnDate ?? null, createdAt: opp.createdAt,
      nextActionDueAt: opp.nextActionDueAt, closedAt: opp.closedAt,
    };

    return {
      opportunity: {
        ...opp,
        opportunityValue,
        quickbooksAmount,
        effectiveProbability: effectiveProbability(row),
        weightedValue: weightedValue(row),
        valueDiffersFromQuickbooks: valueDiffersFromQuickbooks(row),
        workCategory: opp.workCategory ?? deriveWorkCategory(
          { docType: primaryDoc?.docType, docNumber: primaryDoc?.docNumber, text: extractSalesDocSignals(primaryDoc?.raw).text, linkedToExistingJob: extractSalesDocSignals(primaryDoc?.raw).linkedToExistingJob },
          { type: customer[0]?.type, companyName: customer[0]?.companyName, displayName: customer[0]?.displayName },
        ),
        daysPending: row.daysPending,
        relationship: relationshipForOpportunity({
          stage: opp.stage,
          docStatus: primaryDoc?.status ?? null,
          hasAppointment: appts.length > 0,
        }),
      },
      customer: customer[0] ?? null,
      serviceAddresses,
      salesDocuments,
      primaryDocumentId: primaryDoc?.id ?? null,
      tasks,
      appointments: appts,
      events,
      conflicts,
      // Phase A: jobs converted from this opportunity. The first is the primary
      // one the idempotent "Convert to Job" action returns.
      linkedJobs,
      primaryJob: linkedJobs[0] ?? null,
    };
  }),

  /** Update the CRM Opportunity Value and/or probability. Sets the value override. */
  updateValue: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        opportunityValue: z.number().min(0).optional(),
        probability: z.number().int().min(0).max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const set: Record<string, unknown> = {};
      if (input.opportunityValue != null) {
        set.amount = input.opportunityValue.toFixed(2);
        set.amountOverridden = true; // sync will no longer overwrite the CRM value
      }
      if (input.probability !== undefined) set.probability = input.probability;
      if (!Object.keys(set).length) return { ok: true };
      await db.update(opportunities).set(set).where(eq(opportunities.id, input.id));
      await insertEvent(db, input.id, "value_updated", "CRM opportunity value/probability updated.", {
        opportunityValue: input.opportunityValue,
        probability: input.probability,
      }, ctx.user.id);
      return { ok: true };
    }),

  /**
   * Create a MANUAL opportunity (walk-in / phone / commercial deal not sourced
   * from a QuickBooks estimate). Never touches QuickBooks; never creates or edits
   * the customer or property — it only references an existing customer (required)
   * and, optionally, one of that customer's existing properties. The card is
   * appended to the bottom of its stage column.
   */
  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        stage: z.enum(STAGE_ENUM).optional(),
        opportunityValue: z.number().min(0).optional(),
        probability: z.number().int().min(0).max(100).nullable().optional(),
        priority: z.enum(PRIORITY_ENUM).nullable().optional(),
        assignedToId: z.number().int().nullable().optional(),
        expectedCloseAt: z.date().nullable().optional(),
        nextAction: z.string().max(255).nullable().optional(),
        nextActionDueAt: z.date().nullable().optional(),
        propertyId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Customer must exist — we never conjure a contact from an opportunity.
      const customer = (await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      // A property reference, if given, must belong to this customer.
      const custProps = await db.select({ id: properties.id }).from(properties).where(eq(properties.customerId, input.customerId));
      const link = resolvePropertyLink(input.propertyId ?? null, custProps.map(p => p.id));
      if (link.kind === "invalid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Selected property does not belong to this customer" });
      }

      const stage = input.stage ?? "new";
      const now = new Date();
      const id = await db.transaction(async tx => {
        // Append rank = max(sortOrder)+1 within the target stage (bottom of column).
        const [{ maxOrder = null } = { maxOrder: null }] = await tx
          .select({ maxOrder: sql<number | null>`MAX(${opportunities.sortOrder})` })
          .from(opportunities)
          .where(eq(opportunities.stage, stage));
        const sortOrder = appendSortOrder(maxOrder == null ? [] : [Number(maxOrder)]);

        const values = buildCreateValues(
          {
            customerId: input.customerId,
            title: input.title,
            stage,
            amount: input.opportunityValue,
            probability: input.probability,
            priority: input.priority,
            assignedToId: input.assignedToId,
            expectedCloseAt: input.expectedCloseAt,
            nextAction: input.nextAction,
            nextActionDueAt: input.nextActionDueAt,
            propertyId: input.propertyId,
          },
          { sortOrder, propertyId: link.propertyId },
          now,
        );
        const [inserted] = await tx.insert(opportunities).values(values);
        const newId = Number((inserted as { insertId?: number }).insertId);
        await insertEvent(tx, newId, "created", "Opportunity created manually.", { source: "manual" }, ctx.user.id);
        return newId;
      });

      return { ok: true, id };
    }),

  /**
   * Edit the manually-owned card fields NOT covered by the dedicated mutations
   * (updateValue = amount/probability, assignSalesperson = owner, setStage/
   * markWon/markLost = stage). Partial: only provided keys are written. A
   * `propertyId` is validated to belong to the opportunity's customer.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        priority: z.enum(PRIORITY_ENUM).nullable().optional(),
        expectedCloseAt: z.date().nullable().optional(),
        nextAction: z.string().max(255).nullable().optional(),
        nextActionDueAt: z.date().nullable().optional(),
        propertyId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const opp = (await db.select({ customerId: opportunities.customerId }).from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });

      const set: Record<string, unknown> = {};
      const changed: string[] = [];
      if (input.title !== undefined) { set.title = input.title.trim(); changed.push("title"); }
      if (input.priority !== undefined) { set.priority = input.priority; changed.push("priority"); }
      if (input.expectedCloseAt !== undefined) { set.expectedCloseAt = input.expectedCloseAt; changed.push("expectedCloseAt"); }
      if (input.nextAction !== undefined) { set.nextAction = input.nextAction; changed.push("nextAction"); }
      if (input.nextActionDueAt !== undefined) { set.nextActionDueAt = input.nextActionDueAt; changed.push("nextActionDueAt"); }
      if (input.propertyId !== undefined) {
        if (input.propertyId === null) {
          set.propertyId = null;
        } else {
          const custProps = await db.select({ id: properties.id }).from(properties).where(eq(properties.customerId, opp.customerId));
          const link = resolvePropertyLink(input.propertyId, custProps.map(p => p.id));
          if (link.kind === "invalid") throw new TRPCError({ code: "BAD_REQUEST", message: "Selected property does not belong to this customer" });
          set.propertyId = link.propertyId;
        }
        changed.push("propertyId");
      }
      if (!changed.length) return { ok: true, changed: [] as string[] };

      await db.update(opportunities).set(set).where(eq(opportunities.id, input.id));
      await insertEvent(db, input.id, "updated", `Updated: ${changed.join(", ")}.`, { fields: changed }, ctx.user.id);
      return { ok: true, changed };
    }),

  /**
   * Move the pipeline stage manually (Kanban drag). Transactional + auditable.
   * Sets the stage override so the QBO sync respects the human decision. Optional
   * `expectedStage` enables optimistic-concurrency: if the card already moved,
   * the mutation returns CONFLICT instead of stomping the other edit. Optional
   * `toSortOrder` places the card at a row in the destination column (default:
   * appended to the bottom). Dragging onto the same column is a no-op — use
   * `reorder` to re-rank within a column.
   */
  setStage: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        stage: z.enum(STAGE_ENUM),
        expectedStage: z.enum(STAGE_ENUM).optional(),
        toSortOrder: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await performStageMove(db, {
        id: input.id,
        toStage: input.stage,
        expectedStage: input.expectedStage,
        toSortOrder: input.toSortOrder,
        actorId: ctx.user.id,
      });
      // Follow-up cancellation is a downstream side effect — OUTSIDE the atomic tx.
      if (result.moved && result.closing) await cancelOpenFollowups(input.id, `stage set to ${input.stage}`, db);
      return { ok: true, moved: result.moved };
    }),

  /** Mark Won with an optional close reason. Transactional + auditable; idempotent. */
  markWon: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), closeReason: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await performStageMove(db, {
        id: input.id,
        toStage: "won",
        closeReason: input.closeReason ?? null,
        allowSameStage: true,
        actorId: ctx.user.id,
      });
      await cancelOpenFollowups(input.id, "marked won", db);
      return { ok: true };
    }),

  /** Mark Lost with an optional loss reason. Transactional + auditable; idempotent. */
  markLost: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), lossReason: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await performStageMove(db, {
        id: input.id,
        toStage: "lost",
        lossReason: input.lossReason ?? null,
        allowSameStage: true,
        actorId: ctx.user.id,
      });
      await cancelOpenFollowups(input.id, "marked lost", db);
      return { ok: true };
    }),

  /**
   * Re-rank the cards within ONE stage column after a drag-reorder. The client
   * sends the full top-to-bottom order of that column; we densely renumber
   * `sortOrder` 0..N-1 in a single transaction, writing only the rows whose rank
   * actually changed (bounded). If the column changed since the client loaded it
   * (a card entered/left/was removed), the whole operation returns CONFLICT and
   * writes nothing — the client refetches. Pure cosmetic ordering, so no audit
   * event is emitted (it is not a material change to any deal).
   */
  reorder: protectedProcedure
    .input(
      z.object({
        stage: z.enum(STAGE_ENUM),
        orderedIds: z.array(z.number().int().positive()).min(1).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const updated = await db.transaction(async tx => {
        const cards: BoardCard[] = (await tx
          .select({ id: opportunities.id, stage: opportunities.stage, sortOrder: opportunities.sortOrder })
          .from(opportunities)
          .where(eq(opportunities.stage, input.stage))) as BoardCard[];

        const plan = planReorder(input.orderedIds, cards);
        if (plan.kind === "invalid") throw new TRPCError({ code: "BAD_REQUEST", message: plan.reason });
        if (plan.kind === "stale") throw new TRPCError({ code: "CONFLICT", message: plan.reason });

        for (const u of plan.updates) {
          // Guard on stage so a card that slipped out of this column mid-tx is not renumbered.
          const upd = await tx
            .update(opportunities)
            .set({ sortOrder: u.sortOrder })
            .where(and(eq(opportunities.id, u.id), eq(opportunities.stage, input.stage)));
          if (Number((upd as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 0) {
            throw new TRPCError({ code: "CONFLICT", message: "The board changed while reordering. Refresh and try again." });
          }
        }
        return plan.updates.length;
      });

      return { ok: true, updated };
    }),

  /**
   * Convert an Opportunity into an operational Job (Phase A). Idempotent: the
   * standard path returns the existing primary converted job instead of making
   * a duplicate. Never touches QuickBooks and never silently creates a property
   * — if the customer has multiple non-primary properties it returns
   * `property_selection_required` and the UI prompts the user to choose.
   */
  convertToJob: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), propertyId: z.number().int().positive().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const port: ConvertJobPort = {
        getOpportunity: async id => {
          const o = (await db
            .select({ id: opportunities.id, customerId: opportunities.customerId, title: opportunities.title, projectReference: opportunities.projectReference })
            .from(opportunities)
            .where(eq(opportunities.id, id))
            .limit(1))[0];
          return o ?? null;
        },
        customerExists: async customerId =>
          !!(await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1))[0],
        getExistingConvertedJob: async opportunityId => {
          const j = (await db
            .select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status, propertyId: jobs.propertyId })
            .from(jobs)
            .where(eq(jobs.opportunityId, opportunityId))
            .orderBy(jobs.id)
            .limit(1))[0];
          return j ?? null;
        },
        getCustomerProperties: async customerId =>
          (await db
            .select({ id: properties.id, label: properties.label, addressLine1: properties.addressLine1, city: properties.city, state: properties.state, zip: properties.zip, isPrimary: properties.isPrimary })
            .from(properties)
            .where(eq(properties.customerId, customerId)))
            .map(p => ({ ...p, isPrimary: !!p.isPrimary })),
        createJob: async j => {
          const values: InsertJob = {
            jobNumber: "",
            customerId: j.customerId,
            opportunityId: j.opportunityId,
            propertyId: j.propertyId,
            title: j.title,
            internalNotes: j.internalNotes,
            status: "new",
          };
          const result = await db.insert(jobs).values(values);
          const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
          const jobNumber = makeJobNumber(id);
          await db.update(jobs).set({ jobNumber }).where(eq(jobs.id, id));
          return { id, jobNumber };
        },
        recordEvent: async (opportunityId, jobId, userId) => {
          await insertEvent(db, opportunityId, "converted_to_job", `Converted to Job #${jobId}.`, { jobId, convertedByUserId: userId }, userId);
        },
      };

      try {
        return await convertOpportunityToJob(port, { opportunityId: input.id, propertyId: input.propertyId ?? null, userId: ctx.user.id });
      } catch (e) {
        if (e instanceof ConvertError) throw new TRPCError({ code: "NOT_FOUND", message: e.message });
        throw e;
      }
    }),

  /** Assign a salesperson (teamMembers.id) or clear the assignment. */
  assignSalesperson: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), assignedToId: z.number().int().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(opportunities).set({ assignedToId: input.assignedToId }).where(eq(opportunities.id, input.id));
      await insertEvent(db, input.id, "assigned", "Salesperson assignment updated.", { assignedToId: input.assignedToId }, ctx.user.id);
      return { ok: true };
    }),

  /** Push the opportunity's next action out by N days (Follow Up Later). */
  followUpLater: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), days: z.number().int().min(1).max(90).default(3) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const dueAt = new Date(Date.now() + input.days * DAY_MS);
      await db
        .update(opportunities)
        .set({ nextAction: `Follow up (${input.days}d)`, nextActionDueAt: dueAt })
        .where(eq(opportunities.id, input.id));
      await insertEvent(db, input.id, "follow_up_later", `Follow-up scheduled for ${dueAt.toDateString()}.`, undefined, ctx.user.id);
      return { ok: true, dueAt };
    }),

  /**
   * Create a follow-up task. "text" tasks are created "gated" until SMS
   * compliance (SMS_FOLLOWUPS_ENABLED) is enabled, so no SMS goes out early.
   */
  createTask: protectedProcedure
    .input(
      z.object({
        opportunityId: z.number().int().positive(),
        type: z.enum(["call", "email", "text"]),
        title: z.string().min(1).max(255),
        body: z.string().max(2000).optional(),
        dueAt: z.date(),
        assignedToId: z.number().int().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const opp = (await db.select({ customerId: opportunities.customerId }).from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1))[0];
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      const status = input.type === "text" && !smsFollowupsEnabled() ? "gated" : "open";
      const [inserted] = await db.insert(opportunityTasks).values({
        opportunityId: input.opportunityId,
        customerId: opp.customerId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        dueAt: input.dueAt,
        status,
        assignedToId: input.assignedToId ?? null,
      });
      await insertEvent(db, input.opportunityId, "task_created", `Task created: ${input.title}`, { type: input.type, status }, ctx.user.id);
      return { ok: true, id: Number((inserted as { insertId?: number }).insertId), gated: status === "gated" };
    }),

  /** Mark a follow-up task done. */
  completeTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(opportunityTasks).set({ status: "done", completedAt: new Date() }).where(eq(opportunityTasks.id, input.taskId));
      return { ok: true };
    }),

  /** Snooze a follow-up task by N days (default 1). */
  snoozeTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive(), days: z.number().int().min(1).max(30).default(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const task = (await db.select().from(opportunityTasks).where(eq(opportunityTasks.id, input.taskId)).limit(1))[0];
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      const base = task.dueAt ? new Date(task.dueAt) : new Date();
      const dueAt = new Date(base.getTime() + input.days * DAY_MS);
      await db.update(opportunityTasks).set({ dueAt, status: "open" }).where(eq(opportunityTasks.id, input.taskId));
      return { ok: true, dueAt };
    }),

  /** Open QBO customer sync conflicts, optionally scoped to one customer. */
  customerConflicts: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive().optional() }).default({}))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const cond = input.customerId
        ? and(eq(customerSyncConflicts.status, "open"), eq(customerSyncConflicts.customerId, input.customerId))
        : eq(customerSyncConflicts.status, "open");
      return db.select().from(customerSyncConflicts).where(cond).orderBy(desc(customerSyncConflicts.createdAt));
    }),

  /**
   * Resolve a sync conflict (auditable). "use_qbo" optionally applies the QBO
   * value to the whitelisted customer field; otherwise the CRM value is kept.
   */
  resolveCustomerConflict: protectedProcedure
    .input(
      z.object({
        conflictId: z.number().int().positive(),
        resolution: z.enum(["keep_crm", "use_qbo", "merged"]),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conflict = (await db.select().from(customerSyncConflicts).where(eq(customerSyncConflicts.id, input.conflictId)).limit(1))[0];
      if (!conflict) throw new TRPCError({ code: "NOT_FOUND", message: "Conflict not found" });

      const APPLICABLE = new Set([
        "firstName", "lastName", "companyName", "email", "phone", "altPhone",
        "billingLine1", "billingLine2", "billingCity", "billingState", "billingZip",
      ]);
      if (input.resolution === "use_qbo" && APPLICABLE.has(conflict.fieldName)) {
        await db
          .update(customers)
          .set({ [conflict.fieldName]: conflict.qboValue } as Record<string, unknown>)
          .where(eq(customers.id, conflict.customerId));
      }
      await db
        .update(customerSyncConflicts)
        .set({ status: "resolved", resolution: input.resolution, notes: input.notes ?? null, resolvedById: ctx.user.id, resolvedAt: new Date() })
        .where(eq(customerSyncConflicts.id, input.conflictId));

      // Clear the customer flag when no open conflicts remain.
      const remaining = await db
        .select({ id: customerSyncConflicts.id })
        .from(customerSyncConflicts)
        .where(and(eq(customerSyncConflicts.customerId, conflict.customerId), eq(customerSyncConflicts.status, "open")))
        .limit(1);
      if (!remaining[0]) await db.update(customers).set({ hasQboConflicts: false }).where(eq(customers.id, conflict.customerId));
      return { ok: true };
    }),
});

export type OpportunityListItem = ReturnType<typeof toListItem>;
export type { ProjectedRow };
