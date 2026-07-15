import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getGbpProvider } from "../services/gbp/provider";
import { runGbpSync, readGbpSyncStatus } from "../services/gbp/sync";

/**
 * Google Business Profile (Local SEO) router — ADMIN ONLY, READ ONLY.
 *
 * A thin transport layer over the cache-backed GbpProvider (see
 * server/services/gbp/provider.ts). It holds NO data and NO business logic — the
 * shapes and derivations live in @shared/gbp, and the numbers come from the MySQL
 * cache the daily `runGbpSync` populates from the Business Profile APIs.
 *
 * Every procedure is `adminProcedure` so only admins can read Local SEO data.
 * There is deliberately NO mutation of Business Profile (no reply/publish/upload)
 * — the only mutation is `sync`, which just refreshes the read cache from Google.
 */
export const gbpRouter = router({
  /** Top KPI figures for the dashboard cards (rating, reviews, engagement totals). */
  overview: adminProcedure.query(async () => {
    return getGbpProvider().getOverview();
  }),

  /** Recent reviews (newest first). */
  reviews: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(async ({ input }) => {
      return getGbpProvider().listReviews(input?.limit ?? 25);
    }),

  /** Daily performance time series (calls / directions / clicks / views + rating trend). */
  insights: adminProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).optional() }).optional())
    .query(async ({ input }) => {
      return getGbpProvider().getInsights(input?.days ?? 30);
    }),

  /** Recent local posts + photo-performance rows for the media section. */
  posts: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      const provider = getGbpProvider();
      const [posts, photos] = await Promise.all([
        provider.listPosts(input?.limit ?? 20),
        provider.listPhotos(24),
      ]);
      return { posts, photos };
    }),

  /** Last-sync metadata for the dashboard's freshness/warning banner. */
  getSyncStatus: adminProcedure.query(async () => {
    return readGbpSyncStatus();
  }),

  /**
   * Refresh the cache from Google (the "Sync from Google" button). Same work as
   * POST /api/gbp/sync; admin-only since it hits Google's quota. Never throws —
   * returns a typed result the UI can surface.
   */
  sync: adminProcedure.mutation(async () => {
    return runGbpSync({ trigger: "manual" });
  }),
});
