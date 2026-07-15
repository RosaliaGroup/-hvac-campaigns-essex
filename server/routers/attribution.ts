import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { leadCaptures, opportunities, seoPages } from "../../drizzle/schema";
import {
  buildRevenueAttribution,
  type LeadTouch,
  type WonOpportunity,
  type PageTraffic,
} from "@shared/attributionReport";
import type { Channel } from "@shared/attribution";

/**
 * Revenue-attribution router — READ ONLY.
 *
 * A thin transport layer: it loads lead-capture, won-opportunity, and Search
 * Console page rows, maps them to plain shapes, and hands them to the pure
 * @shared/attributionReport engine. It performs NO writes and never calls
 * QuickBooks or Google. All attribution correctness (tiers, temporal guards,
 * the honest "unattributed" bucket) lives in the shared engine so it is unit
 * tested without a database.
 */
export const attributionRouter = router({
  /**
   * Full revenue-by-page + revenue-by-source report. `confirmedRevenue` is the
   * only figure backed by an explicit lead→deal link; `inferredRevenue` is a
   * low-confidence heuristic (opt in via inferenceWindowDays), and
   * `unattributedRevenue` is always reported explicitly.
   */
  getReport: protectedProcedure
    .input(
      z
        .object({
          /** Days after a lead within which a QBO win may be *inferred* to it. 0 = confirmed only. */
          inferenceWindowDays: z.number().int().min(0).max(1095).optional(),
          weeklyLeadGoal: z.number().int().min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const captureRows = await db
        .select({
          id: leadCaptures.id,
          customerId: leadCaptures.customerId,
          channel: leadCaptures.channel,
          landingPath: leadCaptures.firstTouchLandingPath,
          captureType: leadCaptures.captureType,
          createdAt: leadCaptures.createdAt,
        })
        .from(leadCaptures);

      const wonRows = await db
        .select({
          id: opportunities.id,
          customerId: opportunities.customerId,
          sourceLeadCaptureId: opportunities.sourceLeadCaptureId,
          amount: opportunities.amount,
          closedAt: opportunities.closedAt,
          createdAt: opportunities.createdAt,
        })
        .from(opportunities)
        .where(eq(opportunities.stage, "won"));

      const pageRows = await db
        .select({ page: seoPages.page, clicks: seoPages.clicks, impressions: seoPages.impressions })
        .from(seoPages);

      const leads: LeadTouch[] = captureRows.map(r => ({
        id: r.id,
        customerId: r.customerId ?? null,
        channel: (r.channel ?? "unknown") as Channel,
        landingPath: r.landingPath ?? null,
        captureType: r.captureType ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt).getTime() : 0,
      }));

      const wonOpps: WonOpportunity[] = wonRows.map(r => ({
        id: r.id,
        customerId: r.customerId ?? null,
        sourceLeadCaptureId: r.sourceLeadCaptureId ?? null,
        amount: Number(r.amount ?? 0),
        wonAt: new Date((r.closedAt ?? r.createdAt) as Date).getTime(),
      }));

      const pageTraffic: PageTraffic[] = pageRows.map(r => ({
        page: r.page,
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      }));

      return buildRevenueAttribution(leads, wonOpps, pageTraffic, {
        inferenceWindowDays: input?.inferenceWindowDays ?? 0, // default: confirmed-only, the honest headline
        weeklyLeadGoal: input?.weeklyLeadGoal,
        nowMs: Date.now(),
      });
    }),
});
