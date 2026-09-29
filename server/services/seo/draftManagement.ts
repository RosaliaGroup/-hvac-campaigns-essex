/**
 * Draft management (docs/seo-bulk-approve-spec.md §8): discard-all, regenerate
 * unlocked-only, 30-day soft-expiry, and the stale-"optimizing" sweep. All
 * logged to seoAuditLog.
 */
import { eq, lt, and, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { seoAiDrafts, seoPages } from "../../../drizzle/schema";
import { isLocked } from "../../seo/lockedPages";
import { runBulkOptimization, DEFAULT_BULK_CONCURRENCY, type BulkJobResult } from "./ai/jobs";
import { logAudit } from "./auditLog";

const DRAFT_EXPIRY_DAYS = 30;
const STALE_OPTIMIZING_MINUTES = 30;

/**
 * Clear the 247-draft backlog (or however many exist): resets every
 * seoAiDrafts row's generated fields to null and status back to "draft", and
 * every affected seoPages row back to "needs_review". Nothing is deleted —
 * this is a content reset, not a row delete, so history/audit stays intact
 * and the page can be regenerated. Logs one draft_discarded row per page.
 *
 * `excludePageIds` skips specific pages entirely — e.g. pages that already
 * carry a real (non-mock) draft genuinely awaiting review, which a blanket
 * discard would otherwise wipe right alongside the stale placeholder backlog.
 */
export async function discardAllDrafts(actorId: number | null, excludePageIds: number[] = []): Promise<{ discarded: number }> {
  const db = await getDb();
  if (!db) return { discarded: 0 };

  const exclude = new Set(excludePageIds);
  const allDrafts = await db.select().from(seoAiDrafts);
  const drafts = allDrafts.filter((d) => !exclude.has(d.pageId));
  if (drafts.length === 0) return { discarded: 0 };

  const pageIds = drafts.map((d) => d.pageId);
  const pages = await db.select().from(seoPages);
  const pageById = new Map(pages.map((p) => [p.id, p]));

  for (const draft of drafts) {
    await db
      .update(seoAiDrafts)
      .set({
        generatedTitle: null,
        generatedMetaDescription: null,
        generatedH1: null,
        faq: [],
        internalLinks: [],
        schema: null,
        contentExpansion: null,
        status: "draft",
      })
      .where(eq(seoAiDrafts.pageId, draft.pageId));

    const page = pageById.get(draft.pageId);
    await logAudit({
      actorId,
      action: "draft_discarded",
      batchId: null,
      pagePath: page?.page ?? null,
      before: {
        title: draft.generatedTitle,
        metaDescription: draft.generatedMetaDescription,
        status: draft.status,
      },
      after: null,
      lintResult: null,
    });
  }

  // Only touch pages that actually had a draft — leave anything already
  // further along (e.g. a page an earlier PR already merged) untouched.
  for (const pageId of pageIds) {
    await db.update(seoPages).set({ status: "needs_review" }).where(eq(seoPages.id, pageId));
  }

  return { discarded: drafts.length };
}

/**
 * Regenerate drafts for every page NOT on the exclusion list (spec §8). Runs
 * through the same duplicate-job-protected, bounded-concurrency path as the
 * (now re-gated) "Optimize Selected" button. Locked pages are skipped and
 * reported separately rather than silently dropped.
 */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function regenerateUnlockedDrafts(
  pageIds: number[],
  concurrency: number = DEFAULT_BULK_CONCURRENCY,
  onProgress?: (done: number, total: number) => void,
): Promise<{ results: BulkJobResult[]; skippedLocked: string[] }> {
  const db = await getDb();
  if (!db) return { results: [], skippedLocked: [] };

  const pages = await db.select().from(seoPages);
  const pageById = new Map(pages.map((p) => [p.id, p]));

  const unlockedIds: number[] = [];
  const skippedLocked: string[] = [];
  for (const id of pageIds) {
    const page = pageById.get(id);
    if (!page) continue;
    const lock = await isLocked(page.page);
    if (lock.locked) skippedLocked.push(page.page);
    else unlockedIds.push(id);
  }

  const results = await runBulkOptimization(unlockedIds, "optimize_everything", concurrency, onProgress);
  return { results, skippedLocked };
}

/**
 * Soft-expire drafts older than 30 days that were never approved (spec §8).
 * "Soft-delete" here means the same content-reset discardAllDrafts() uses,
 * not a row delete — logged as draft_discarded with a distinct before-state
 * note so the audit trail can tell an expiry apart from a manual discard.
 * Intended to run on a schedule (see the "not wired to a cron" note in the
 * final report — this function is the logic, not the trigger).
 */
export async function expireStaleDrafts(now: Date = new Date()): Promise<{ expired: number }> {
  const db = await getDb();
  if (!db) return { expired: 0 };

  const cutoff = new Date(now.getTime() - DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const stale = await db
    .select()
    .from(seoAiDrafts)
    .where(and(lt(seoAiDrafts.updatedAt, cutoff), ne(seoAiDrafts.status, "approved")));

  if (stale.length === 0) return { expired: 0 };

  const pages = await db.select().from(seoPages);
  const pageById = new Map(pages.map((p) => [p.id, p]));

  for (const draft of stale) {
    await db
      .update(seoAiDrafts)
      .set({
        generatedTitle: null,
        generatedMetaDescription: null,
        generatedH1: null,
        faq: [],
        internalLinks: [],
        schema: null,
        contentExpansion: null,
        status: "draft",
      })
      .where(eq(seoAiDrafts.pageId, draft.pageId));

    await logAudit({
      actorId: null,
      action: "draft_discarded",
      batchId: null,
      pagePath: pageById.get(draft.pageId)?.page ?? null,
      before: { title: draft.generatedTitle, metaDescription: draft.generatedMetaDescription, reason: "30-day expiry" },
      after: null,
      lintResult: null,
    });
  }

  return { expired: stale.length };
}

/**
 * Reset pages stuck in "optimizing" for more than STALE_OPTIMIZING_MINUTES
 * back to "needs_review" — the same reset optimizations.ts's rejectDraft()
 * performs for a manual reject (workflow status only; the generated draft
 * content is NOT wiped, unlike discardAllDrafts/expireStaleDrafts above, so
 * a reviewer can still see what was generated). `seoPages.updatedAt` is
 * `onUpdateNow()`, so it reliably marks the moment a page last entered
 * "optimizing" — no need to touch seoAiDrafts to find staleness.
 *
 * generateOptimization() only ever sets status:"optimizing" AFTER a
 * successful generation (see its own comment) — this isn't recovering a
 * job that crashed mid-run; it's recovering a page whose completed draft
 * was never picked up for review (a stuck "Optimize Selected" batch, a
 * deploy that landed between generation and the review page loading it,
 * etc.). Logged as draft_discarded (closest existing audit action) with a
 * `reason` distinguishing an automated sweep from a human reject/expiry.
 */
export async function sweepStaleOptimizingPages(now: Date = new Date()): Promise<{ reset: number }> {
  const db = await getDb();
  if (!db) return { reset: 0 };

  const cutoff = new Date(now.getTime() - STALE_OPTIMIZING_MINUTES * 60 * 1000);
  const stale = await db
    .select()
    .from(seoPages)
    .where(and(eq(seoPages.status, "optimizing"), lt(seoPages.updatedAt, cutoff)));

  if (stale.length === 0) return { reset: 0 };

  for (const page of stale) {
    await db.insert(seoAiDrafts).values({ pageId: page.id, siteUrl: page.siteUrl, status: "draft" }).onDuplicateKeyUpdate({ set: { status: "draft" } });
    await db.update(seoPages).set({ status: "needs_review" }).where(eq(seoPages.id, page.id));

    await logAudit({
      actorId: null,
      action: "draft_discarded",
      batchId: null,
      pagePath: page.page,
      before: { status: "optimizing", reason: "stale-optimizing sweep", staleMinutes: Math.round((now.getTime() - page.updatedAt.getTime()) / 60_000) },
      after: null,
      lintResult: null,
    });
  }

  return { reset: stale.length };
}

/** In-process scheduler for sweepStaleOptimizingPages() — every 10 minutes, so nothing sits "optimizing" past ~40 min. */
export function startStaleOptimizingSweep(): void {
  const run = async () => {
    try {
      const { reset } = await sweepStaleOptimizingPages();
      if (reset > 0) console.log(`[SEO] reset ${reset} page(s) stuck in "optimizing" past ${STALE_OPTIMIZING_MINUTES}min back to needs_review`);
    } catch (e) {
      console.warn("[SEO] stale-optimizing sweep failed:", (e as Error).message);
    }
  };
  setTimeout(run, 20_000);
  setInterval(run, 10 * 60_000);
  console.log(`[SEO] stale-optimizing sweep scheduled (every 10min, threshold ${STALE_OPTIMIZING_MINUTES}min)`);
}
