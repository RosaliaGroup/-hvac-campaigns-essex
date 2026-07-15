import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { and, eq } from "drizzle-orm";
import {
  leadCaptures,
  opportunities,
  seoPages,
  customers,
  appointments,
  quickbooksSalesDocuments,
} from "../../drizzle/schema";
import {
  buildRevenueAttribution,
  type LeadTouch,
  type WonOpportunity,
  type PageTraffic,
} from "@shared/attributionReport";
import { suggestMatches, type MatchCapture, type MatchOpportunity, type MatchCustomer } from "@shared/attributionMatch";
import type { Channel } from "@shared/attribution";

/**
 * Revenue-attribution router.
 *
 * Reads are member-level (protectedProcedure); every WRITE and the admin match
 * workflow are admin-only (adminProcedure). The router only ever SELECTs from
 * QuickBooks-mirror tables (quickbooksSalesDocuments) and seoPages — it never
 * writes them. The single table this feature mutates is `opportunities`, and
 * only its `sourceLeadCaptureId` column, via the explicit link/unlink actions.
 *
 * Correctness lives in the pure @shared engines (attributionReport,
 * attributionMatch); this file is a thin DB adapter. Reporting is CONFIRMED-ONLY
 * by default — inferred attribution is opt-in per request (inferenceWindowDays).
 */

const ms = (d: Date | string | null | undefined): number => (d ? new Date(d as Date).getTime() : 0);

/** Load and map every row the report/funnel/matching needs. Pure selects. */
async function loadData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [captureRows, oppRows, pageRows, customerRows, apptRows, salesDocRows] = await Promise.all([
    db
      .select({
        id: leadCaptures.id,
        customerId: leadCaptures.customerId,
        email: leadCaptures.email,
        phone: leadCaptures.phone,
        channel: leadCaptures.channel,
        landingPath: leadCaptures.firstTouchLandingPath,
        captureType: leadCaptures.captureType,
        createdAt: leadCaptures.createdAt,
      })
      .from(leadCaptures),
    db
      .select({
        id: opportunities.id,
        customerId: opportunities.customerId,
        sourceLeadCaptureId: opportunities.sourceLeadCaptureId,
        amount: opportunities.amount,
        stage: opportunities.stage,
        title: opportunities.title,
        closedAt: opportunities.closedAt,
        createdAt: opportunities.createdAt,
      })
      .from(opportunities),
    db.select({ page: seoPages.page, clicks: seoPages.clicks, impressions: seoPages.impressions }).from(seoPages),
    db
      .select({
        id: customers.id,
        convertedFromCaptureId: customers.convertedFromCaptureId,
        email: customers.email,
        phone: customers.phone,
      })
      .from(customers),
    db.select({ customerId: appointments.customerId }).from(appointments),
    db
      .select({
        customerId: quickbooksSalesDocuments.customerId,
        docType: quickbooksSalesDocuments.docType,
        totalAmount: quickbooksSalesDocuments.totalAmount,
      })
      .from(quickbooksSalesDocuments),
  ]);

  const leads: LeadTouch[] = captureRows.map(r => ({
    id: r.id,
    customerId: r.customerId ?? null,
    channel: (r.channel ?? "unknown") as Channel,
    landingPath: r.landingPath ?? null,
    captureType: r.captureType ?? null,
    createdAt: ms(r.createdAt),
  }));

  const allOpps = oppRows.map(r => ({
    id: r.id,
    customerId: r.customerId ?? null,
    sourceLeadCaptureId: r.sourceLeadCaptureId ?? null,
    amount: Number(r.amount ?? 0),
    stage: r.stage,
    title: r.title,
    wonAt: ms(r.closedAt ?? r.createdAt),
  }));

  const wonOpps: WonOpportunity[] = allOpps
    .filter(o => o.stage === "won")
    .map(o => ({ id: o.id, customerId: o.customerId, sourceLeadCaptureId: o.sourceLeadCaptureId, amount: o.amount, wonAt: o.wonAt }));

  const pageTraffic: PageTraffic[] = pageRows.map(r => ({ page: r.page, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 }));

  return { leads, allOpps, wonOpps, pageTraffic, customerRows, apptRows, salesDocRows, captureRows };
}

const reportInput = z
  .object({
    inferenceWindowDays: z.number().int().min(0).max(1095).optional(),
    weeklyLeadGoal: z.number().int().min(1).optional(),
  })
  .optional();

async function buildReport(input?: { inferenceWindowDays?: number; weeklyLeadGoal?: number }) {
  const { leads, wonOpps, pageTraffic } = await loadData();
  return buildRevenueAttribution(leads, wonOpps, pageTraffic, {
    inferenceWindowDays: input?.inferenceWindowDays ?? 0, // confirmed-only headline by default
    weeklyLeadGoal: input?.weeklyLeadGoal,
    nowMs: Date.now(),
  });
}

/** Cohort funnel: customers who submitted a lead of `channel` (default organic). */
function buildCohortFunnel(
  data: Awaited<ReturnType<typeof loadData>>,
  channel: Channel | "all",
) {
  const cohortCaptures = data.leads.filter(l => channel === "all" || l.channel === channel);
  const cohortCustomerIds = new Set<number>();
  for (const l of cohortCaptures) if (l.customerId != null) cohortCustomerIds.add(l.customerId);

  const inCohort = (cid: number | null | undefined) => cid != null && cohortCustomerIds.has(cid);

  const appointmentsCount = new Set(data.apptRows.filter(a => inCohort(a.customerId)).map(a => a.customerId)).size;
  const estimatesCount = data.salesDocRows.filter(d => d.docType === "estimate" && inCohort(d.customerId)).length;
  const wonJobs = data.wonOpps.filter(o => inCohort(o.customerId)).length;
  const invoicedRevenue = data.salesDocRows
    .filter(d => d.docType === "invoice" && inCohort(d.customerId))
    .reduce((s, d) => s + Number(d.totalAmount ?? 0), 0);

  return {
    channel,
    basis:
      "Cohort = customers who submitted a lead of this channel. Counts reflect that cohort's downstream activity, NOT per-deal confirmed attribution.",
    leads: cohortCaptures.length,
    customers: cohortCustomerIds.size,
    appointments: appointmentsCount,
    estimates: estimatesCount,
    wonJobs,
    invoicedRevenue,
  };
}

export const attributionRouter = router({
  /** Headline KPIs for the dashboard cards. Confirmed-only revenue by default. */
  getOverview: protectedProcedure.input(reportInput).query(async ({ input }) => {
    const data = await loadData();
    const report = buildRevenueAttribution(data.leads, data.wonOpps, data.pageTraffic, {
      inferenceWindowDays: input?.inferenceWindowDays ?? 0,
      weeklyLeadGoal: input?.weeklyLeadGoal,
      nowMs: Date.now(),
    });
    const organic = report.byChannel.find(b => b.key === "organic") ?? { leads: 0, qualifiedLeads: 0 };
    const funnel = buildCohortFunnel(data, "organic");
    const unattributedLeads = report.byChannel.find(b => b.key === "unknown")?.leads ?? 0;

    return {
      organicLeads: organic.leads,
      qualifiedOrganicLeads: organic.qualifiedLeads,
      appointments: funnel.appointments,
      estimates: funnel.estimates,
      wonJobs: funnel.wonJobs,
      invoicedRevenue: funnel.invoicedRevenue,
      unattributedLeads,
      confirmedAttributedRevenue: report.totals.confirmedRevenue,
      inferredRevenue: report.totals.inferredRevenue,
      unattributedRevenue: report.totals.unattributedRevenue,
      weekly: report.weekly,
      meta: report.meta,
    };
  }),

  /** Revenue-by-landing-page (organic clicks joined by normalized path). */
  getByLandingPage: protectedProcedure.input(reportInput).query(async ({ input }) => {
    const report = await buildReport(input);
    return { rows: report.byPage, meta: report.meta };
  }),

  /** Revenue-by-source (marketing channel). */
  getBySource: protectedProcedure.input(reportInput).query(async ({ input }) => {
    const report = await buildReport(input);
    return { rows: report.byChannel, meta: report.meta };
  }),

  /** Cohort funnel: leads → appointments → estimates → won → invoiced revenue. */
  getFunnel: protectedProcedure
    .input(z.object({ channel: z.enum(["organic", "paid", "direct", "referral", "social", "email", "unknown", "all"]).optional() }).optional())
    .query(async ({ input }) => {
      const data = await loadData();
      return buildCohortFunnel(data, (input?.channel ?? "organic") as Channel | "all");
    }),

  /** Won revenue that could not be honestly attributed + leads with unknown channel. */
  getUnattributed: protectedProcedure.input(reportInput).query(async ({ input }) => {
    const report = await buildReport(input);
    const unattributedOpps = report.attributions.filter(a => a.tier === "unattributed");
    const unknownChannel = report.byChannel.find(b => b.key === "unknown");
    return {
      revenue: report.unattributed.revenue,
      wonCount: report.unattributed.wonCount,
      opportunityIds: unattributedOpps.map(a => a.opportunityId),
      unknownChannelLeads: unknownChannel?.leads ?? 0,
      note: "These are NOT credited to any page or source. Use the admin match workflow to establish real links.",
    };
  }),

  /** ADMIN: conservative suggested opportunity → lead links (identifiers + timing). */
  getSuggestedMatches: adminProcedure
    .input(z.object({ windowDays: z.number().int().min(1).max(1095).optional() }).optional())
    .query(async ({ input }) => {
      const data = await loadData();
      const captures: MatchCapture[] = data.captureRows.map(r => ({
        id: r.id,
        customerId: r.customerId ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        createdAt: ms(r.createdAt),
        channel: (r.channel ?? "unknown") as Channel,
        landingPath: r.landingPath ?? null,
        captureType: r.captureType ?? null,
      }));
      const opps: MatchOpportunity[] = data.allOpps.map(o => ({
        id: o.id,
        customerId: o.customerId,
        sourceLeadCaptureId: o.sourceLeadCaptureId,
        amount: o.amount,
        wonAt: o.wonAt,
        title: o.title,
      }));
      const custs: MatchCustomer[] = data.customerRows.map(c => ({
        id: c.id,
        convertedFromCaptureId: c.convertedFromCaptureId ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
      }));
      return suggestMatches(opps, captures, custs, { windowDays: input?.windowDays });
    }),

  /** ADMIN: explicitly link an opportunity to a lead capture (also used for correction). */
  linkOpportunityToLeadCapture: adminProcedure
    .input(z.object({ opportunityId: z.number().int(), leadCaptureId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [opp] = await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      const [cap] = await db.select({ id: leadCaptures.id }).from(leadCaptures).where(eq(leadCaptures.id, input.leadCaptureId)).limit(1);
      if (!cap) throw new TRPCError({ code: "NOT_FOUND", message: "Lead capture not found" });

      await db.update(opportunities).set({ sourceLeadCaptureId: input.leadCaptureId }).where(eq(opportunities.id, input.opportunityId));
      return { success: true, opportunityId: input.opportunityId, leadCaptureId: input.leadCaptureId };
    }),

  /** ADMIN: remove an opportunity's explicit attribution link (back to unknown). */
  unlinkOpportunityAttribution: adminProcedure
    .input(z.object({ opportunityId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [opp] = await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      await db.update(opportunities).set({ sourceLeadCaptureId: null }).where(eq(opportunities.id, input.opportunityId));
      return { success: true, opportunityId: input.opportunityId };
    }),

  /**
   * ADMIN: preview confirmed attribution WITHOUT writing anything. Exists so an
   * admin can see the effect of current links before/without any backfill. It
   * performs only SELECTs and always reports wrote:false.
   */
  recalculateDryRun: adminProcedure.query(async () => {
    const report = await buildReport({ inferenceWindowDays: 0 });
    return {
      dryRun: true,
      wrote: false,
      confirmedRevenue: report.totals.confirmedRevenue,
      confirmedWonCount: report.attributions.filter(a => a.tier === "confirmed").length,
      unattributedRevenue: report.totals.unattributedRevenue,
      note: "Preview only. No rows were written. Attribution links change only via linkOpportunityToLeadCapture / unlinkOpportunityAttribution.",
    };
  }),
});
