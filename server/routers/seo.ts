import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SEO_ACTION, SEO_STATUS } from "@shared/seo";
import { getSeoProvider } from "../services/seo/provider";
import { runSeoSync, readSyncStatus } from "../services/seo/sync";
import {
  getDraft,
  updateDraft,
  approveDraft,
  rejectDraft,
  setWorkflowStatus,
  getBusinessImpact,
  type DraftPatch,
} from "../services/seo/optimizations";
import {
  runOptimizationJob,
  runBulkOptimization,
  DuplicateJobError,
  DEFAULT_BULK_CONCURRENCY,
} from "../services/seo/ai/jobs";

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

  /** Last-sync metadata for the dashboard's freshness/warning banner. */
  getSyncStatus: protectedProcedure.query(async () => {
    return readSyncStatus();
  }),

  /**
   * Trigger a Search Console sync from inside the app (the "Sync from Google"
   * button). Same work as POST /api/seo/sync; admin-only since it hits Google's
   * quota. Never throws — returns a typed result the UI can surface.
   */
  sync: adminProcedure.mutation(async () => {
    return runSeoSync({ trigger: "manual" });
  }),

  /* ── AI SEO Optimization Engine (PR #23) ──────────────────────────────── */

  /** The stored AI draft for a page (empty draft if none generated yet). */
  getOptimization: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => getDraft(input.id)),

  /** Aggregate current-vs-projected CRM funnel (Phase 4). */
  getBusinessImpact: protectedProcedure.query(async () => getBusinessImpact()),

  /**
   * Run an AI action for one page: generate + STORE the draft (never publish).
   * Content actions move the page to "optimizing"; request_reindex only flags it
   * for reindexing. Guarded by duplicate-active-job protection — a second call
   * while a page's job is in flight is rejected (CONFLICT). Admin-only (mock
   * today; real AI quota tomorrow).
   */
  generateOptimization: adminProcedure
    .input(z.object({ id: z.number().int().positive(), action: z.enum(SEO_ACTION) }))
    .mutation(async ({ input }) => {
      try {
        const draft = await runOptimizationJob(input.id, input.action);
        if (input.action === "request_reindex") {
          await setWorkflowStatus([input.id], "waiting_for_indexing");
        }
        return { draft };
      } catch (err) {
        if (err instanceof DuplicateJobError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }
    }),

  /**
   * Re-run generation for a page whose draft already exists (the "Regenerate"
   * button). Same semantics + duplicate-active-job protection as
   * generateOptimization; a separate name keeps the UI intent and analytics
   * clear. Admin-only. Never publishes.
   */
  regenerateOptimization: adminProcedure
    .input(z.object({ id: z.number().int().positive(), action: z.enum(SEO_ACTION) }))
    .mutation(async ({ input }) => {
      try {
        const draft = await runOptimizationJob(input.id, input.action);
        return { draft };
      } catch (err) {
        if (err instanceof DuplicateJobError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }
    }),

  /**
   * Bulk-optimize a batch of pages with bounded concurrency (the "Optimize
   * Selected" bulk action). Each page runs through the same duplicate-protected
   * job; a failure on one page is returned per-item without aborting the batch.
   * Admin-only. Never publishes.
   */
  bulkGenerateOptimization: adminProcedure
    .input(
      z.object({
        ids: z.array(z.number().int().positive()).min(1),
        action: z.enum(SEO_ACTION),
        concurrency: z.number().int().min(1).max(16).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const results = await runBulkOptimization(
        input.ids,
        input.action,
        input.concurrency ?? DEFAULT_BULK_CONCURRENCY,
      );
      if (input.action === "request_reindex") {
        const ok = results.filter((r) => r.ok).map((r) => r.pageId);
        if (ok.length > 0) await setWorkflowStatus(ok, "waiting_for_indexing");
      }
      return {
        results,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      };
    }),

  /** Persist human edits to a draft — everything stays editable (Phase 7). */
  updateOptimizationDraft: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        patch: z.object({
          title: z.string().nullable().optional(),
          metaDescription: z.string().nullable().optional(),
          h1: z.string().nullable().optional(),
          faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
          internalLinks: z
            .array(z.object({ anchor: z.string(), targetPath: z.string(), rationale: z.string() }))
            .optional(),
          schema: z.record(z.string(), z.unknown()).nullable().optional(),
          contentExpansion: z.string().nullable().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const draft = await updateDraft(input.id, input.patch as DraftPatch);
      return { draft };
    }),

  /** Approve a draft for review (draft → approved; page → approved). No publish. */
  approveOptimization: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const draft = await approveDraft(input.id);
      return { draft };
    }),

  /**
   * Reject a generated draft: draft → "draft", page → "needs_review". The draft
   * content is preserved (nothing deleted or published) so it can be edited or
   * regenerated. Admin-only.
   */
  rejectOptimization: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const draft = await rejectDraft(input.id);
      return { draft };
    }),

  /** Move one or more pages to a workflow status (Phase 6). Admin-only. */
  setWorkflowStatus: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1), status: z.enum(SEO_STATUS) }))
    .mutation(async ({ input }) => {
      const updated = await setWorkflowStatus(input.ids, input.status);
      return { updated };
    }),
});
