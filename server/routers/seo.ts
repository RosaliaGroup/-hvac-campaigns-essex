import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SEO_ACTION, SEO_STATUS } from "@shared/seo";
import { SEO_PAGE_TAGS } from "../../drizzle/schema";
import { resolveTeamMemberId } from "../../shared/fieldApp";
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
import { getAiOptimizationProvider, isMockProvider } from "../services/seo/ai/optimizationProvider";
import { AiDraftLintFailedError } from "../services/seo/ai/anthropicProvider";
import { findLockedPages } from "../seo/lockedPages";
import { lintPageMeta } from "../../shared/seoLinter";
import {
  buildBatchDiff,
  approveBatchToPR,
  revertBatch,
  refreshBatchStatus,
  assertReindexAllowed,
  LockedPagesError,
  LintBlockedError,
  BatchTooLargeError,
  PendingBatchError,
  MockProviderError,
} from "../services/seo/bulkApprove";
import { isGithubConfigured, GithubNotConfiguredError } from "../services/seo/github";
import { listTags, addTag, removeTag, TagNoteRequiredError } from "../services/seo/tags";
import { listAuditLog, auditLogToCsv } from "../services/seo/auditLog";
import { discardAllDrafts, regenerateUnlockedDrafts, expireStaleDrafts } from "../services/seo/draftManagement";
import { getDb } from "../db";
import { seoApprovalBatches, seoPages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/** Map the bulk-approve service's typed errors to the right tRPC/HTTP status. */
function toTRPCError(err: unknown): never {
  if (err instanceof LockedPagesError) {
    throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: err.message, cause: err.locked });
  }
  if (err instanceof LintBlockedError) {
    throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: err.message, cause: err.blocked });
  }
  if (err instanceof BatchTooLargeError) {
    throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: err.message });
  }
  if (err instanceof GithubNotConfiguredError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
  }
  if (err instanceof MockProviderError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
  }
  if (err instanceof AiDraftLintFailedError) {
    throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: err.message, cause: err.findings });
  }
  if (err instanceof TagNoteRequiredError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  }
  if (err instanceof Error) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: String(err) });
}

/** True if this page can't be reindexed right now (title/meta sitting in an open PR). */
async function isReindexBlocked(pageId: number): Promise<boolean> {
  try {
    await assertReindexAllowed(pageId);
    return false;
  } catch (err) {
    if (err instanceof PendingBatchError) return true;
    throw err;
  }
}

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
      if (input.action === "request_reindex") await assertReindexAllowed(input.id).catch(toTRPCError);
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
        if (err instanceof AiDraftLintFailedError) toTRPCError(err);
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
      if (input.action === "request_reindex") await assertReindexAllowed(input.id).catch(toTRPCError);
      try {
        const draft = await runOptimizationJob(input.id, input.action);
        return { draft };
      } catch (err) {
        if (err instanceof DuplicateJobError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        if (err instanceof AiDraftLintFailedError) toTRPCError(err);
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
      let ids = input.ids;
      let blockedByPendingBatch: number[] = [];
      if (input.action === "request_reindex") {
        const checks = await Promise.all(
          ids.map(async (id) => [id, await isReindexBlocked(id)] as const),
        );
        blockedByPendingBatch = checks.filter(([, blocked]) => blocked).map(([id]) => id);
        ids = checks.filter(([, blocked]) => !blocked).map(([id]) => id);
      }
      const results = await runBulkOptimization(
        ids,
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
        skippedPendingBatch: blockedByPendingBatch,
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

  /**
   * Move one or more pages to a workflow status (Phase 6). Admin-only.
   * "waiting_for_indexing" is gated the same as the request_reindex action —
   * a page can't be requested for reindex while its title/meta is sitting in
   * an unmerged bulk-approve PR (spec §11 acceptance test).
   */
  setWorkflowStatus: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1), status: z.enum(SEO_STATUS) }))
    .mutation(async ({ input }) => {
      let ids = input.ids;
      if (input.status === "waiting_for_indexing") {
        const checks = await Promise.all(ids.map(async (id) => [id, await isReindexBlocked(id)] as const));
        ids = checks.filter(([, blocked]) => !blocked).map(([id]) => id);
      }
      const updated = await setWorkflowStatus(ids, input.status);
      return { updated };
    }),

  /* ── SEO bulk-approve workflow (docs/seo-bulk-approve-spec.md) ─────────── */

  /** Whether the server-side GitHub PAT is configured — drives the UI's "not configured" state. */
  githubConfigured: protectedProcedure.query(() => ({ configured: isGithubConfigured() })),

  /**
   * Which AI optimization provider is actually drafting content, and whether
   * it's the built-in placeholder (MockAiOptimizationProvider — fabricated
   * copy, not researched or verified). The CRM disables "Approve to PR" while
   * this is true: batching fabricated titles/descriptions into a real PR
   * would be indistinguishable from real drafts once merged.
   */
  aiProviderStatus: protectedProcedure.query(() => {
    const model = getAiOptimizationProvider().model;
    return { model, isMock: isMockProvider(model) };
  }),

  /** Lock status for a set of page paths — for greying out rows in the table. */
  getLockStatus: protectedProcedure
    .input(z.object({ paths: z.array(z.string()).min(1) }))
    .query(async ({ input }) => {
      const locked = await findLockedPages(input.paths);
      return Object.fromEntries(locked.entries());
    }),

  /** Claims-linter result for one page's CURRENT draft (or its live title/meta if no draft). */
  lintPage: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const draft = await getDraft(input.id);
      const db = await getDb();
      if (!db) return { findings: [], passes: true };
      const [page] = await db.select().from(seoPages).where(eq(seoPages.id, input.id)).limit(1);
      if (!page) return { findings: [], passes: true };
      return lintPageMeta({
        pagePath: page.page,
        title: draft.title ?? page.title,
        metaDescription: draft.metaDescription ?? page.metaDescription,
      });
    }),

  /** Build the diff table for a candidate batch (approval modal, before confirm). Admin-only. */
  buildBatchDiff: adminProcedure
    .input(z.object({ pageIds: z.array(z.number().int().positive()).min(1).max(20) }))
    .mutation(async ({ input }) => {
      try {
        return { rows: await buildBatchDiff(input.pageIds) };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /** Approve a batch → commit + PR. Admin-only. Never writes to main. */
  approveBatchToPR: adminProcedure
    .input(z.object({ pageIds: z.array(z.number().int().positive()).min(1).max(20), label: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await approveBatchToPR({ pageIds: input.pageIds, label: input.label, actorId: resolveTeamMemberId(ctx.user) });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /** List approval batches (for the batch history / PR-status panel). */
  listBatches: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(seoApprovalBatches).orderBy(seoApprovalBatches.createdAt);
  }),

  /** Revert a merged batch — opens a new PR. Admin-only. */
  revertBatch: adminProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await revertBatch(input.batchId, resolveTeamMemberId(ctx.user));
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /** Poll this batch's PR (merged/closed?) and sync the DB. No webhook — admin-triggered. */
  refreshBatchStatus: adminProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      try {
        return await refreshBatchStatus(input.batchId);
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /** Tags for one page (row menu). */
  getTags: protectedProcedure.input(z.object({ pagePath: z.string() })).query(async ({ input }) => listTags(input.pagePath)),

  addTag: adminProcedure
    .input(z.object({ pagePath: z.string(), tag: z.enum(SEO_PAGE_TAGS), note: z.string().nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      await addTag({ pagePath: input.pagePath, tag: input.tag, note: input.note ?? null, actorId: resolveTeamMemberId(ctx.user) });
      return { ok: true };
    }),

  /** Removing "claims-review" requires a note (enforced in the service, not just here). */
  removeTag: adminProcedure
    .input(z.object({ pagePath: z.string(), tag: z.enum(SEO_PAGE_TAGS), note: z.string().nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await removeTag({ pagePath: input.pagePath, tag: input.tag, note: input.note ?? null, actorId: resolveTeamMemberId(ctx.user) });
        return { ok: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /** Audit log side panel. */
  getAuditLog: protectedProcedure
    .input(
      z.object({
        batchId: z.number().int().positive().optional(),
        pagePath: z.string().optional(),
        limit: z.number().int().min(1).max(2000).optional(),
      }).optional(),
    )
    .query(async ({ input }) => listAuditLog(input ?? {})),

  /** CSV export of the audit log (same filters as getAuditLog). */
  exportAuditLogCsv: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive().optional(), pagePath: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await listAuditLog(input ?? {});
      return { csv: auditLogToCsv(rows) };
    }),

  /** "Discard all drafts" — resets every drafted page back to needs_review. Admin-only. */
  discardAllDrafts: adminProcedure.mutation(async ({ ctx }) => discardAllDrafts(resolveTeamMemberId(ctx.user))),

  /** "Regenerate drafts (unlocked only)" — skips anything on the exclusion list. Admin-only. */
  regenerateUnlockedDrafts: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1), concurrency: z.number().int().min(1).max(16).optional() }))
    .mutation(async ({ input }) => regenerateUnlockedDrafts(input.ids, input.concurrency)),

  /** Manual trigger for the 30-day soft-expiry sweep (spec §8) — not wired to a cron yet. Admin-only. */
  expireStaleDrafts: adminProcedure.mutation(async () => expireStaleDrafts()),
});
