import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveTeamMemberId } from "../../shared/fieldApp";
import { getDb } from "../db";
import { seoIntelReports, seoIntelItems } from "../../drizzle/schema";
import { runMarketIntelReport } from "../services/seo/intel/report";
import { dismissItem, revertItem, revertAllFromReport, ItemNotFoundError } from "../services/seo/intel/revert";
import { submitOwnerDecisionValue, OwnerDecisionValueRequiredError } from "../services/seo/intel/ownerDecision";
import { openPagePR } from "../services/seo/intel/pagePr";
import { GithubNotConfiguredError } from "../services/seo/github";
import { startLaneJob, getLaneJobStatus } from "../services/asyncLaneJob";

function toTRPCError(err: unknown): never {
  if (err instanceof ItemNotFoundError) throw new TRPCError({ code: "NOT_FOUND", message: err.message });
  if (err instanceof OwnerDecisionValueRequiredError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  if (err instanceof GithubNotConfiguredError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
  if (err instanceof Error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: String(err) });
}

const DISMISS_REASON = z.enum(["wrong", "not_now", "off_brand", "already_done"]);

/**
 * Market Intel router (docs/market-intel-spec.md). Thin transport layer —
 * all business logic lives in server/services/seo/intel/*. `protectedProcedure`
 * matches the SEO Intelligence router's own access level (server/routers/seo.ts).
 */
/** Keep historical decisions intact while showing each suggestion only once. */
function uniqueReportItems<T extends { suggestionKey: string | null; status: string; id: number }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = item.suggestionKey || `legacy:${item.id}`;
    const current = seen.get(key);
    // Prefer a decision over an open duplicate; otherwise retain latest row.
    if (!current || (current.status === "open" && item.status !== "open")) seen.set(key, item);
  }
  return Array.from(seen.values());
}

export const marketIntelRouter = router({
  listReports: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(seoIntelReports).orderBy(desc(seoIntelReports.date)).limit(60);
  }),

  getReport: protectedProcedure.input(z.object({ reportId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [report] = await db.select().from(seoIntelReports).where(eq(seoIntelReports.id, input.reportId)).limit(1);
    if (!report) return null;
    const items = await db.select().from(seoIntelItems).where(eq(seoIntelItems.reportId, input.reportId)).orderBy(desc(seoIntelItems.id));
    return { report, items: uniqueReportItems(items) };
  }),

  getLatestReport: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [report] = await db.select().from(seoIntelReports).orderBy(desc(seoIntelReports.date)).limit(1);
    if (!report) return null;
    const items = await db.select().from(seoIntelItems).where(eq(seoIntelItems.reportId, report.id)).orderBy(desc(seoIntelItems.id));
    return { report, items: uniqueReportItems(items) };
  }),

  /**
   * "Run now" button (§1). Fire-and-forget (see server/services/asyncLaneJob.ts):
   * the report can run past the proxy's request timeout (competitor fetches +
   * model calls), so this enqueues it and returns immediately — the client
   * polls getJobStatus. A click while a report is already running is a no-op
   * (`started: false`) instead of racing a duplicate report for the same day
   * (2026-09-28 incident: a retried click produced two identical daily
   * reports before this fix).
   */
  runNow: protectedProcedure.mutation(async () => {
    const { started } = startLaneJob("marketIntel", () => runMarketIntelReport({ windowKind: "daily" }));
    return { started, status: getLaneJobStatus("marketIntel") };
  }),

  /** Poll target for runNow's progress. */
  getJobStatus: protectedProcedure.query(() => getLaneJobStatus("marketIntel")),

  dismissItem: protectedProcedure.input(z.object({ itemId: z.number(), reason: DISMISS_REASON })).mutation(async ({ input, ctx }) => {
    try {
      return await dismissItem(input.itemId, input.reason, resolveTeamMemberId(ctx.user));
    } catch (err) {
      toTRPCError(err);
    }
  }),

  /** One-click Revert (§3d/§7). */
  revertItem: protectedProcedure.input(z.object({ itemId: z.number(), reason: DISMISS_REASON })).mutation(async ({ input, ctx }) => {
    try {
      return await revertItem(input.itemId, input.reason, resolveTeamMemberId(ctx.user));
    } catch (err) {
      toTRPCError(err);
    }
  }),

  /** "Revert all from this report" (§3d/§7). */
  revertAllFromReport: protectedProcedure.input(z.object({ reportId: z.number() })).mutation(async ({ input, ctx }) => {
    try {
      return await revertAllFromReport(input.reportId, resolveTeamMemberId(ctx.user));
    } catch (err) {
      toTRPCError(err);
    }
  }),

  /** Owner supplies the missing figure for a facts-blocked item (§3d "Ready — needs your number"). */
  submitOwnerDecisionValue: protectedProcedure.input(z.object({ itemId: z.number(), value: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    try {
      return await submitOwnerDecisionValue(input.itemId, input.value, resolveTeamMemberId(ctx.user));
    } catch (err) {
      toTRPCError(err);
    }
  }),

  /**
   * Manual "Propose page PR" trigger for a `new_page`/backlog item — the
   * daily job never calls openPagePR automatically (see adjustments.ts's
   * header for why); this is the explicit owner-click path.
   */
  proposePagePr: protectedProcedure
    .input(z.object({ itemId: z.number(), slug: z.string().min(1), title: z.string().min(1), metaDescription: z.string().min(1), targetQuery: z.string().min(1), outline: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await openPagePR(
          { slug: input.slug, title: input.title, metaDescription: input.metaDescription, targetQuery: input.targetQuery, outline: input.outline, proposedAt: new Date().toISOString().slice(0, 10) },
          resolveTeamMemberId(ctx.user),
        );
        const db = await getDb();
        if (db) {
          await db.update(seoIntelItems).set({ status: "accepted", executedBatchId: result.batchId, executedPrId: String(result.prNumber), targetQueue: "page_pr_backlog" }).where(eq(seoIntelItems.id, input.itemId));
        }
        return result;
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
