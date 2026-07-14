import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { SEO_ACTION, SEO_STATUS } from "@shared/seo";
import { getSeoProvider } from "../services/seo/provider";

/**
 * SEO Intelligence router.
 *
 * A thin transport layer over the SEO data provider (see
 * server/services/seo/provider.ts). It holds NO data and NO business logic — the
 * shapes, scores, filters and action semantics live in @shared/seo, and the
 * numbers come from whichever provider `getSeoProvider()` returns (mock today,
 * Google Search Console / GA4 / Indexing API later). Swapping the provider is
 * the only change needed to go live; these procedures stay identical.
 */
export const seoRouter = router({
  /** Top KPI figures for the dashboard cards. */
  getOverview: protectedProcedure.query(async () => {
    return getSeoProvider().getOverview();
  }),

  /** All opportunity rows (client applies the work-queue filters). */
  getOpportunities: protectedProcedure.query(async () => {
    return getSeoProvider().listOpportunities();
  }),

  /** A single opportunity for the detail drawer. */
  getOpportunity: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getSeoProvider().getOpportunity(input.id);
    }),

  /**
   * Run an AI action against one or more pages (drawer buttons + bulk
   * "Optimize Selected" / "Request Reindex"). Placeholder: mutates provider
   * state and returns the updated rows. No real AI/Indexing API call yet.
   */
  runAction: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
        action: z.enum(SEO_ACTION),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await getSeoProvider().runAction(input.ids, input.action);
      return { updated };
    }),

  /** Move one or more pages to a workflow status (e.g. bulk "Mark Complete"). */
  setStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
        status: z.enum(SEO_STATUS),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await getSeoProvider().setStatus(input.ids, input.status);
      return { updated };
    }),
});
