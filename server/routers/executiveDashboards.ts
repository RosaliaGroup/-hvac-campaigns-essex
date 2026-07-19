/**
 * Executive Dashboards router — read-only aggregations powering the four
 * executive dashboards (Sales, Marketing, Operations, Finance).
 *
 * This router OWNS no data. It composes existing systems of record:
 *   - Won revenue / pipeline / close rate → `opportunities`
 *   - Recognized revenue / estimates      → `quickbooksSalesDocuments`
 *   - Technician revenue / throughput     → `jobs` + `jobLineItems`
 * Marketing KPIs (campaign revenue, cost-per-lead/appointment) are composed on
 * the client from the existing `attribution`, `googleAds` and `metaAds` routers
 * — they are not duplicated here.
 *
 * KPIs with NO system of record are returned as explicit `{ status: "coming_soon" }`
 * shapes rather than fabricated numbers:
 *   - Callbacks           — no callback/rework flag exists on `jobs`
 *   - Maintenance Agreements — no service-agreement / recurring-contract model exists
 *   - Gross Profit        — no COGS/labor-cost captured (parts cost only, insufficient)
 *
 * Every procedure is `adminProcedure` (executive data is admins-only) and never
 * writes. Money columns are MySQL DECIMAL → arrive as strings → coerced with num().
 */
import { z } from "zod";
import { and, eq, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  opportunities,
  quickbooksSalesDocuments,
  jobs,
  jobLineItems,
  teamMembers,
  customers,
} from "../../drizzle/schema";
import {
  reportingMode,
  isReportingLifecycleEnabled,
  terminalJobCondition,
  buildReportingComparison,
} from "../services/reportingLifecycle";

// ── shared types ──────────────────────────────────────────────────────────
/** A KPI that has no system of record yet. Rendered as a "Coming Soon" tile. */
type ComingSoon = { status: "coming_soon"; reason: string };
const comingSoon = (reason: string): ComingSoon => ({ status: "coming_soon", reason });

/** Coerce a possibly-null MySQL decimal/string/number to a finite number. */
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const OPEN_STAGES = ["new", "proposal_sent", "pending"] as const;
const CLOSED_STAGES = ["won", "lost"] as const;

/**
 * Weighted pipeline value: explicit per-row probability, else the stage default.
 * Mirrors the canonical weighting in opportunities.ts (kept in sync deliberately;
 * there is no shared pipeline-config table — the defaults live in code).
 */
const weightedExpr = sql<string>`${opportunities.amount} * (COALESCE(${opportunities.probability}, CASE ${opportunities.stage} WHEN 'new' THEN 10 WHEN 'proposal_sent' THEN 30 WHEN 'pending' THEN 50 WHEN 'won' THEN 100 ELSE 0 END)) / 100`;

/** Billable revenue on a job = sum of its line-item totals (the source of truth). */
const jobRevenueSubquery = sql<string>`COALESCE((SELECT SUM(${jobLineItems.total}) FROM ${jobLineItems} WHERE ${jobLineItems.jobId} = ${jobs.id}), 0)`;

/**
 * Single source of truth for QuickBooks sales-document WHERE criteria, shared by
 * both the KPI tiles and their drill-downs so the two ALWAYS reconcile.
 *
 *  - Invoices ("recognized revenue") are scoped by issue date (txnDate).
 *  - Estimates ("Estimates Outstanding") are a date-agnostic SNAPSHOT of currently
 *    open (pending/accepted) estimates — dateFrom/dateTo are intentionally ignored,
 *    so the tile count and the drill-down row count match under identical filters.
 *
 * Exported for unit tests (see executiveDashboards.test.ts).
 */
export function salesDocConditions(scope: {
  docType: "estimate" | "invoice";
  customerId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}): SQL[] {
  const conds: SQL[] = [
    eq(quickbooksSalesDocuments.docType, scope.docType),
    eq(quickbooksSalesDocuments.voided, false),
  ];
  if (scope.docType === "estimate") {
    conds.push(inArray(quickbooksSalesDocuments.status, ["pending", "accepted"]));
    // NOTE: no txnDate bound — estimates are a snapshot (see doc comment above).
  } else {
    if (scope.dateFrom) conds.push(gte(quickbooksSalesDocuments.txnDate, scope.dateFrom));
    if (scope.dateTo) conds.push(lte(quickbooksSalesDocuments.txnDate, scope.dateTo));
  }
  if (scope.customerId) conds.push(eq(quickbooksSalesDocuments.customerId, scope.customerId));
  return conds;
}

// ── filter input ──────────────────────────────────────────────────────────
const filtersInput = z
  .object({
    /** Inclusive lower bound on the dashboard's primary date field. */
    dateFrom: z.date().optional(),
    /** Inclusive upper bound on the dashboard's primary date field. */
    dateTo: z.date().optional(),
    /** teamMembers.id — applies to Operations (job assignee). */
    technicianId: z.number().int().positive().optional(),
    /** customers.id — applies to all dashboards. */
    customerId: z.number().int().positive().optional(),
  })
  .optional();
type Filters = z.infer<typeof filtersInput>;

const drilldownInput = z.object({
  metric: z.enum([
    "booked_revenue",
    "pipeline",
    "close_rate",
    "recognized_revenue",
    "estimates",
    "technician_revenue",
    "jobs_completed",
  ]),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  technicianId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  offset: z.number().int().min(0).default(0),
});

// ── condition builders ───────────────────────────────────────────────────
function oppRange(f: Filters, dateCol: typeof opportunities.closedAt) {
  const c = [] as ReturnType<typeof gte>[];
  if (f?.dateFrom) c.push(gte(dateCol, f.dateFrom));
  if (f?.dateTo) c.push(lte(dateCol, f.dateTo));
  if (f?.customerId) c.push(eq(opportunities.customerId, f.customerId));
  return c;
}

// ── monthly bucketing helpers ──────────────────────────────────────────────
const monthKey = (col: unknown) => sql<string>`DATE_FORMAT(${col}, '%Y-%m')`;

/** Last 12 calendar-month keys ending at `now`, oldest→newest (YYYY-MM). */
function last12Months(now: Date): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

// ────────────────────────────────────────────────────────────────────────────
export const executiveDashboardsRouter = router({
  /**
   * Options for the global filter bar: technicians (team members), a capped
   * customer list, and the marketing channel enum. Powers the Select controls.
   */
  filterOptions: adminProcedure
    .input(z.object({ customerSearch: z.string().max(255).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { technicians: [], customers: [], channels: [] as string[] };

      const techs = await db
        .select({ id: teamMembers.id, name: teamMembers.name })
        .from(teamMembers)
        .where(inArray(teamMembers.status, ["active", "invited"]))
        .orderBy(teamMembers.name)
        .limit(500);

      const custWhere = input?.customerSearch
        ? sql`${customers.displayName} LIKE ${"%" + input.customerSearch + "%"}`
        : undefined;
      const custRows = await db
        .select({ id: customers.id, name: customers.displayName })
        .from(customers)
        .where(custWhere)
        .orderBy(customers.displayName)
        .limit(500);

      return {
        technicians: techs,
        customers: custRows,
        // The honest-unknown channel set used by the attribution engine.
        channels: ["organic", "paid", "direct", "referral", "social", "email", "unknown"],
      };
    }),

  /** SALES: booked revenue, close rate, weighted pipeline, (agreements → soon). */
  sales: adminProcedure.input(filtersInput).query(async ({ input }) => {
    const db = await getDb();
    const empty = {
      bookedRevenue: 0,
      wonCount: 0,
      lostCount: 0,
      closeRate: 0,
      averageTicket: 0,
      openPipeline: 0,
      weightedPipeline: 0,
      pipelineByStage: [] as { stage: string; count: number; value: number; weighted: number }[],
      revenueTrend: [] as { month: string; revenue: number }[],
      newMaintenanceAgreements: comingSoon(
        "No maintenance-agreement system of record exists yet. Sold-agreement counts will appear once the Agreements module is built.",
      ),
    };
    if (!db) return empty;

    // Won revenue + counts within range (by closedAt).
    const wonRows = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(${opportunities.amount}), 0)`,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(opportunities)
      .where(and(eq(opportunities.stage, "won"), ...oppRange(input, opportunities.closedAt)));
    const bookedRevenue = num(wonRows[0]?.revenue);
    const wonCount = num(wonRows[0]?.cnt);

    const lostRows = await db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(opportunities)
      .where(and(eq(opportunities.stage, "lost"), ...oppRange(input, opportunities.closedAt)));
    const lostCount = num(lostRows[0]?.cnt);

    // Pipeline snapshot (open stages; customer filter honored, no date bound).
    const stageRows = await db
      .select({
        stage: opportunities.stage,
        cnt: sql<number>`COUNT(*)`,
        value: sql<string>`COALESCE(SUM(${opportunities.amount}), 0)`,
        weighted: sql<string>`COALESCE(SUM(${weightedExpr}), 0)`,
      })
      .from(opportunities)
      .where(input?.customerId ? eq(opportunities.customerId, input.customerId) : undefined)
      .groupBy(opportunities.stage);

    const pipelineByStage = stageRows.map(r => ({
      stage: String(r.stage),
      count: num(r.cnt),
      value: num(r.value),
      weighted: num(r.weighted),
    }));
    const openPipeline = pipelineByStage
      .filter(s => (OPEN_STAGES as readonly string[]).includes(s.stage))
      .reduce((a, s) => a + s.value, 0);
    const weightedPipeline = pipelineByStage
      .filter(s => (OPEN_STAGES as readonly string[]).includes(s.stage))
      .reduce((a, s) => a + s.weighted, 0);

    // 12-month won-revenue trend.
    const trendRows = await db
      .select({
        month: monthKey(opportunities.closedAt),
        revenue: sql<string>`COALESCE(SUM(${opportunities.amount}), 0)`,
      })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.stage, "won"),
          input?.customerId ? eq(opportunities.customerId, input.customerId) : undefined,
        ),
      )
      .groupBy(monthKey(opportunities.closedAt));
    const trendMap = new Map(trendRows.map(r => [String(r.month), num(r.revenue)]));
    const revenueTrend = last12Months(new Date()).map(m => ({ month: m, revenue: trendMap.get(m) ?? 0 }));

    const closeRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : 0;
    const averageTicket = wonCount > 0 ? bookedRevenue / wonCount : 0;

    return {
      bookedRevenue,
      wonCount,
      lostCount,
      closeRate,
      averageTicket,
      openPipeline,
      weightedPipeline,
      pipelineByStage,
      revenueTrend,
      newMaintenanceAgreements: empty.newMaintenanceAgreements,
    };
  }),

  /** FINANCE: recognized (invoiced) revenue, estimates, forecast, (GP/recurring → soon). */
  finance: adminProcedure.input(filtersInput).query(async ({ input }) => {
    const db = await getDb();
    const empty = {
      recognizedRevenue: 0,
      invoiceCount: 0,
      hasInvoiceData: false,
      estimatesOutstanding: 0,
      estimateCount: 0,
      weightedForecast: 0,
      revenueTrend: [] as { month: string; invoiced: number }[],
      grossProfit: comingSoon(
        "Gross profit needs cost of goods sold (labor cost + materials). The Jobs module captures billable amounts only — no labor cost — so a true margin cannot be computed yet.",
      ),
      recurringRevenue: comingSoon(
        "No recurring maintenance-agreement contracts are modeled yet. MRR/ARR will populate once the Agreements module exists.",
      ),
    };
    if (!db) return empty;

    // Date-scoped invoices (recognized revenue) and the un-dated invoice base (12-month trend).
    const invRange = salesDocConditions({ docType: "invoice", customerId: input?.customerId, dateFrom: input?.dateFrom, dateTo: input?.dateTo });
    const invBase = salesDocConditions({ docType: "invoice", customerId: input?.customerId });

    const invRows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${quickbooksSalesDocuments.totalAmount}), 0)`,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(quickbooksSalesDocuments)
      .where(and(...invRange));
    const recognizedRevenue = num(invRows[0]?.total);
    const invoiceCount = num(invRows[0]?.cnt);

    // Is there ANY invoice row at all? (invoice sync is env-gated; may be empty.)
    const anyInv = await db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(quickbooksSalesDocuments)
      .where(eq(quickbooksSalesDocuments.docType, "invoice"));
    const hasInvoiceData = num(anyInv[0]?.cnt) > 0;

    // Outstanding estimates (pending/accepted) — forward book of work. Snapshot: no date bound.
    const estWhere = salesDocConditions({ docType: "estimate", customerId: input?.customerId });
    const estRows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${quickbooksSalesDocuments.totalAmount}), 0)`,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(quickbooksSalesDocuments)
      .where(and(...estWhere));

    // Weighted forecast = weighted open pipeline (forward-looking revenue).
    const fcRows = await db
      .select({ weighted: sql<string>`COALESCE(SUM(${weightedExpr}), 0)` })
      .from(opportunities)
      .where(
        and(
          inArray(opportunities.stage, [...OPEN_STAGES]),
          input?.customerId ? eq(opportunities.customerId, input.customerId) : undefined,
        ),
      );

    const trendRows = await db
      .select({
        month: monthKey(quickbooksSalesDocuments.txnDate),
        invoiced: sql<string>`COALESCE(SUM(${quickbooksSalesDocuments.totalAmount}), 0)`,
      })
      .from(quickbooksSalesDocuments)
      .where(and(...invBase))
      .groupBy(monthKey(quickbooksSalesDocuments.txnDate));
    const trendMap = new Map(trendRows.map(r => [String(r.month), num(r.invoiced)]));
    const revenueTrend = last12Months(new Date()).map(m => ({ month: m, invoiced: trendMap.get(m) ?? 0 }));

    return {
      recognizedRevenue,
      invoiceCount,
      hasInvoiceData,
      estimatesOutstanding: num(estRows[0]?.total),
      estimateCount: num(estRows[0]?.cnt),
      weightedForecast: num(fcRows[0]?.weighted),
      revenueTrend,
      grossProfit: empty.grossProfit,
      recurringRevenue: empty.recurringRevenue,
    };
  }),

  /** OPERATIONS: technician revenue, jobs completed, throughput, (callbacks/agreements → soon). */
  operations: adminProcedure.input(filtersInput).query(async ({ input }) => {
    const db = await getDb();
    const empty = {
      technicians: [] as { id: number | null; name: string; revenue: number; jobCount: number }[],
      totalTechnicianRevenue: 0,
      jobsCompleted: 0,
      throughputTrend: [] as { month: string; completed: number }[],
      callbackRate: comingSoon(
        "No callback / rework / return-visit flag exists on jobs. Callback tracking requires a new field on the Jobs record.",
      ),
      activeAgreements: comingSoon(
        "No maintenance-agreement system of record exists yet. Active-contract counts and due visits will appear once the Agreements module is built.",
      ),
    };
    if (!db) return empty;

    // Job-state / revenue-phase reporting: flag-gated switch between the legacy
    // office-status set and the canonical lifecycle set (see reportingLifecycle).
    const mode = reportingMode();
    const jobWhere = [terminalJobCondition(mode)];
    if (input?.customerId) jobWhere.push(eq(jobs.customerId, input.customerId));
    if (input?.technicianId) jobWhere.push(eq(jobs.assignedToId, input.technicianId));
    if (input?.dateFrom) jobWhere.push(gte(jobs.completedAt, input.dateFrom));
    if (input?.dateTo) jobWhere.push(lte(jobs.completedAt, input.dateTo));

    // Revenue + job count grouped by primary technician (jobs.assignedToId).
    const techRows = await db
      .select({
        techId: jobs.assignedToId,
        techName: teamMembers.name,
        revenue: sql<string>`COALESCE(SUM(${jobRevenueSubquery}), 0)`,
        jobCount: sql<number>`COUNT(*)`,
      })
      .from(jobs)
      .leftJoin(teamMembers, eq(jobs.assignedToId, teamMembers.id))
      .where(and(...jobWhere))
      .groupBy(jobs.assignedToId, teamMembers.name);

    const technicians = techRows
      .map(r => ({
        id: r.techId ?? null,
        name: r.techName ?? "Unassigned",
        revenue: num(r.revenue),
        jobCount: num(r.jobCount),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    const totalTechnicianRevenue = technicians.reduce((a, t) => a + t.revenue, 0);
    const jobsCompleted = technicians.reduce((a, t) => a + t.jobCount, 0);

    const trendRows = await db
      .select({ month: monthKey(jobs.completedAt), completed: sql<number>`COUNT(*)` })
      .from(jobs)
      .where(
        and(
          terminalJobCondition(mode),
          input?.customerId ? eq(jobs.customerId, input.customerId) : undefined,
          input?.technicianId ? eq(jobs.assignedToId, input.technicianId) : undefined,
        ),
      )
      .groupBy(monthKey(jobs.completedAt));
    const trendMap = new Map(trendRows.map(r => [String(r.month), num(r.completed)]));
    const throughputTrend = last12Months(new Date()).map(m => ({ month: m, completed: trendMap.get(m) ?? 0 }));

    return {
      technicians,
      totalTechnicianRevenue,
      jobsCompleted,
      throughputTrend,
      callbackRate: empty.callbackRate,
      activeAgreements: empty.activeAgreements,
    };
  }),

  /**
   * Row-level underlying data for any KPI tile — powers the drill-down table and
   * the CSV export. Returns a uniform { columns, rows, total } shape so the client
   * renders and exports every metric the same way.
   */
  drilldown: adminProcedure.input(drilldownInput).query(async ({ input }) => {
    const db = await getDb();
    const f: Filters = {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      technicianId: input.technicianId,
      customerId: input.customerId,
    };
    type Column = { key: string; label: string; type: "text" | "number" | "money" | "date" };
    const emptyResult = (columns: Column[]) => ({ columns, rows: [] as Record<string, unknown>[], total: 0 });

    switch (input.metric) {
      case "booked_revenue":
      case "close_rate":
      case "pipeline": {
        const columns: Column[] = [
          { key: "id", label: "Opp #", type: "number" },
          { key: "title", label: "Title", type: "text" },
          { key: "customerName", label: "Customer", type: "text" },
          { key: "stage", label: "Stage", type: "text" },
          { key: "amount", label: "Value", type: "money" },
          { key: "weighted", label: "Weighted", type: "money" },
          { key: "closedAt", label: "Closed", type: "date" },
        ];
        if (!db) return emptyResult(columns);
        const conds =
          input.metric === "pipeline"
            ? [inArray(opportunities.stage, [...OPEN_STAGES])]
            : input.metric === "booked_revenue"
              ? [eq(opportunities.stage, "won"), ...oppRange(f, opportunities.closedAt)]
              : [inArray(opportunities.stage, [...CLOSED_STAGES]), ...oppRange(f, opportunities.closedAt)];
        if (input.metric === "pipeline" && f.customerId) conds.push(eq(opportunities.customerId, f.customerId));
        const base = db
          .select({
            id: opportunities.id,
            title: opportunities.title,
            customerName: customers.displayName,
            stage: opportunities.stage,
            amount: opportunities.amount,
            weighted: weightedExpr,
            closedAt: opportunities.closedAt,
          })
          .from(opportunities)
          .leftJoin(customers, eq(opportunities.customerId, customers.id))
          .where(and(...conds));
        const rows = await base.limit(input.limit).offset(input.offset);
        const totalRows = await db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(opportunities)
          .where(and(...conds));
        return {
          columns,
          rows: rows.map(r => ({ ...r, amount: num(r.amount), weighted: num(r.weighted) })),
          total: num(totalRows[0]?.cnt),
        };
      }

      case "recognized_revenue":
      case "estimates": {
        const isInvoice = input.metric === "recognized_revenue";
        const columns: Column[] = [
          { key: "docNumber", label: "Doc #", type: "text" },
          { key: "customerName", label: "Customer", type: "text" },
          { key: "status", label: "Status", type: "text" },
          { key: "totalAmount", label: "Amount", type: "money" },
          { key: "txnDate", label: "Date", type: "date" },
        ];
        if (!db) return emptyResult(columns);
        // Same builder as the KPI tiles → estimates drill-down reconciles to the tile
        // (snapshot, date-agnostic); invoices stay date-scoped.
        const conds = salesDocConditions({
          docType: isInvoice ? "invoice" : "estimate",
          customerId: f.customerId,
          dateFrom: f.dateFrom,
          dateTo: f.dateTo,
        });
        const rows = await db
          .select({
            docNumber: quickbooksSalesDocuments.docNumber,
            customerName: customers.displayName,
            status: quickbooksSalesDocuments.status,
            totalAmount: quickbooksSalesDocuments.totalAmount,
            txnDate: quickbooksSalesDocuments.txnDate,
          })
          .from(quickbooksSalesDocuments)
          .leftJoin(customers, eq(quickbooksSalesDocuments.customerId, customers.id))
          .where(and(...conds))
          .limit(input.limit)
          .offset(input.offset);
        const totalRows = await db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(quickbooksSalesDocuments)
          .where(and(...conds));
        return {
          columns,
          rows: rows.map(r => ({ ...r, totalAmount: num(r.totalAmount) })),
          total: num(totalRows[0]?.cnt),
        };
      }

      case "technician_revenue":
      case "jobs_completed": {
        const columns: Column[] = [
          { key: "jobNumber", label: "Job #", type: "text" },
          { key: "title", label: "Title", type: "text" },
          { key: "customerName", label: "Customer", type: "text" },
          { key: "technician", label: "Technician", type: "text" },
          { key: "status", label: "Status", type: "text" },
          { key: "revenue", label: "Revenue", type: "money" },
          { key: "completedAt", label: "Completed", type: "date" },
        ];
        if (!db) return emptyResult(columns);
        const conds = [terminalJobCondition(reportingMode())];
        if (f.customerId) conds.push(eq(jobs.customerId, f.customerId));
        if (f.technicianId) conds.push(eq(jobs.assignedToId, f.technicianId));
        if (f.dateFrom) conds.push(gte(jobs.completedAt, f.dateFrom));
        if (f.dateTo) conds.push(lte(jobs.completedAt, f.dateTo));
        const rows = await db
          .select({
            jobNumber: jobs.jobNumber,
            title: jobs.title,
            customerName: customers.displayName,
            technician: teamMembers.name,
            status: jobs.status,
            revenue: jobRevenueSubquery,
            completedAt: jobs.completedAt,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .leftJoin(teamMembers, eq(jobs.assignedToId, teamMembers.id))
          .where(and(...conds))
          .limit(input.limit)
          .offset(input.offset);
        const totalRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(jobs).where(and(...conds));
        return {
          columns,
          rows: rows.map(r => ({ ...r, technician: r.technician ?? "Unassigned", revenue: num(r.revenue) })),
          total: num(totalRows[0]?.cnt),
        };
      }

      default:
        return emptyResult([]);
    }
  }),

  /**
   * Admin-only, read-only comparison of legacy (jobs.status) vs canonical
   * (jobs.lifecycleState) membership for every job-state / revenue-phase metric.
   * Available REGARDLESS of the feature flag so it can validate a cutover before
   * enabling it. Returns per-metric counts, deltas, affected job-ID sets,
   * null-lifecycle jobs, and reconciliation classifiers. Executes only SELECTs —
   * it never mutates a job. No customer PII (names/phones/addresses) is returned.
   */
  reportingComparison: adminProcedure.input(filtersInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return {
        mode: reportingMode(),
        flagEnabled: isReportingLifecycleEnabled(),
        filters: {},
        totalJobsConsidered: 0,
        metrics: [],
      };
    }
    return buildReportingComparison(db, {
      customerId: input?.customerId,
      technicianId: input?.technicianId,
      dateFrom: input?.dateFrom,
      dateTo: input?.dateTo,
    });
  }),
});
