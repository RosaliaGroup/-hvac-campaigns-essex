/**
 * AI SEO optimization job runner (PR #23).
 *
 * Wraps generateOptimization with two operational guarantees the raw service
 * does not provide on its own:
 *
 *   1. Duplicate active-job protection — a page can only have ONE optimization
 *      job in flight at a time. A second request for the same page while the
 *      first is still running is rejected with DuplicateJobError instead of
 *      racing two generations against the same draft row.
 *
 *   2. Bounded-concurrency bulk actions — runBulkOptimization fans a batch of
 *      pages out through a fixed-size worker pool so a "Optimize Selected" over
 *      50 pages never opens 50 parallel provider calls (or DB connections).
 *
 * Everything here is DRAFTS ONLY: it delegates to generateOptimization, which
 * writes seoAiDrafts + the seoPages.status workflow column and never publishes.
 */
import type { AiOptimizationDraft, SeoAction } from "@shared/seo";
import { generateOptimization } from "../optimizations";

/* ── Active-job registry (in-process) ────────────────────────────────────── */

type ActiveJob = { action: SeoAction; startedAt: number };

/** pageId → the job currently running for it. One job per page, max. */
const activeJobs = new Map<number, ActiveJob>();

/** Thrown when a second optimization is requested for a page already running one. */
export class DuplicateJobError extends Error {
  readonly pageId: number;
  constructor(pageId: number) {
    super(`An optimization job is already running for page ${pageId}.`);
    this.name = "DuplicateJobError";
    this.pageId = pageId;
  }
}

/** True if an optimization job is currently in flight for this page. */
export function isJobActive(pageId: number): boolean {
  return activeJobs.has(pageId);
}

/** Number of optimization jobs currently in flight (across all pages). */
export function activeJobCount(): number {
  return activeJobs.size;
}

/** Test seam — clear the registry between tests. */
export function _resetJobs(): void {
  activeJobs.clear();
}

/* ── Single job ──────────────────────────────────────────────────────────── */

/**
 * Run one optimization job for a page (used by generate + regenerate). Registers
 * the page as active BEFORE any async work so a concurrent request is rejected,
 * and always de-registers in `finally` so a provider failure cannot wedge the
 * page in a permanently-"busy" state. Re-throws provider/DB errors to the caller
 * (generateOptimization sets the "optimizing" status only after a successful
 * generation, so a failed job leaves the page's prior status untouched).
 */
export async function runOptimizationJob(
  pageId: number,
  action: SeoAction,
): Promise<AiOptimizationDraft | null> {
  if (activeJobs.has(pageId)) throw new DuplicateJobError(pageId);
  activeJobs.set(pageId, { action, startedAt: Date.now() });
  try {
    return await generateOptimization(pageId, action);
  } finally {
    activeJobs.delete(pageId);
  }
}

/* ── Bounded-concurrency bulk ────────────────────────────────────────────── */

/**
 * Map `items` through `fn` with at most `limit` running at once. A fixed pool of
 * workers pulls from a shared cursor; results are written back in input order.
 * Never rejects for a single item — the caller's `fn` decides how to represent
 * failure (runBulkOptimization captures it as a per-item result).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}

export type BulkJobResult =
  | { pageId: number; ok: true; draft: AiOptimizationDraft | null }
  | { pageId: number; ok: false; error: string };

/** Default parallelism for bulk optimization — conservative to protect the AI/DB. */
export const DEFAULT_BULK_CONCURRENCY = 3;

/**
 * Optimize a batch of pages with bounded concurrency. Each page runs through
 * runOptimizationJob (so duplicate-active protection still applies per page),
 * and a failure on one page is captured as `{ ok: false }` without aborting the
 * rest of the batch. Duplicate ids are collapsed so a page is optimized once.
 */
export async function runBulkOptimization(
  ids: number[],
  action: SeoAction,
  concurrency: number = DEFAULT_BULK_CONCURRENCY,
): Promise<BulkJobResult[]> {
  const uniqueIds = Array.from(new Set(ids));
  return mapWithConcurrency(uniqueIds, concurrency, async (pageId): Promise<BulkJobResult> => {
    try {
      const draft = await runOptimizationJob(pageId, action);
      return { pageId, ok: true, draft };
    } catch (err) {
      return { pageId, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
