import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { GA4_RANGES, DEFAULT_GA4_RANGE } from "@shared/ga4";
import { getGa4Provider } from "../services/ga4/provider";
import { readGa4SyncStatus, runGa4Sync } from "../services/ga4/sync";

/**
 * GA4 Analytics router — the Marketing → Analytics dashboard.
 *
 * A thin, ADMIN-ONLY, READ-ONLY transport over the cache-backed
 * Ga4AnalyticsProvider (server/services/ga4/provider.ts). It holds no data and
 * no business logic — shapes/labels/classification live in @shared/ga4 and the
 * numbers come from the MySQL cache that runGa4Sync populates from the Google
 * Analytics Data API. Every query is `adminProcedure`, so viewers and members
 * get FORBIDDEN; the only mutation is an admin-triggered manual sync.
 *
 * Isolated from SEO (0044/0045), Revenue Attribution (0046) and Google Ads —
 * it reads only ga4DailyMetrics / ga4SyncHistory.
 */
const rangeInput = z
  .object({ range: z.enum(GA4_RANGES).default(DEFAULT_GA4_RANGE) })
  .default({ range: DEFAULT_GA4_RANGE });

const limitedRangeInput = z
  .object({
    range: z.enum(GA4_RANGES).default(DEFAULT_GA4_RANGE),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .default({ range: DEFAULT_GA4_RANGE, limit: 20 });

export const analyticsRouter = router({
  /** KPI totals + deltas + Organic/Paid/Other split for the dashboard cards. */
  overview: adminProcedure.input(rangeInput).query(async ({ input }) => {
    return getGa4Provider().getOverview(input.range);
  }),

  /** Daily sessions / users / pageViews timeseries. */
  traffic: adminProcedure.input(rangeInput).query(async ({ input }) => {
    return getGa4Provider().getTraffic(input.range);
  }),

  /** Top campaigns by sessions (source / medium / campaign). */
  campaigns: adminProcedure.input(limitedRangeInput).query(async ({ input }) => {
    return getGa4Provider().getCampaigns(input.range, input.limit);
  }),

  /** Top landing pages by sessions. */
  landingPages: adminProcedure.input(limitedRangeInput).query(async ({ input }) => {
    return getGa4Provider().getLandingPages(input.range, input.limit);
  }),

  /** Daily conversions timeseries. */
  conversions: adminProcedure.input(rangeInput).query(async ({ input }) => {
    return getGa4Provider().getConversions(input.range);
  }),

  /** Top pages by pageViews. */
  topPages: adminProcedure.input(limitedRangeInput).query(async ({ input }) => {
    return getGa4Provider().getTopPages(input.range, input.limit);
  }),

  /** Last-sync metadata for the freshness / staleness banner. */
  syncStatus: adminProcedure.query(async () => {
    return readGa4SyncStatus();
  }),

  /**
   * Trigger a GA4 sync from inside the app (the "Sync from GA4" button).
   * Admin-only since it hits Google's quota. Never throws — returns a typed
   * result the UI can surface.
   */
  sync: adminProcedure.mutation(async () => {
    return runGa4Sync({ trigger: "manual" });
  }),
});
