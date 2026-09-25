/**
 * SEO bulk-approve orchestration (docs/seo-bulk-approve-spec.md §5, §6).
 *
 * approveBatchToPR(): the ONLY write path from the CRM to the live site's
 * title/meta. Validates (locked pages → reject, linter BLOCK → reject),
 * computes the diff, and writes it as ONE commit on a `pr-seo-meta-*` branch
 * via a real GitHub PR — never main, never a deploy hook, never auto-merged.
 *
 * revertBatch(): opens a second PR that restores the pre-batch overrides for
 * a `merged` batch. Computed from the stored diff, not from re-reading git
 * history — this repo only ever writes one file from this flow, so "revert"
 * is exactly "put back what `diff[].before` says was there."
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { seoPages, seoApprovalBatches, type SeoApprovalBatchRow } from "../../../drizzle/schema";
import { findLockedPages } from "../../seo/lockedPages";
import { lintPageMeta, type LintResult } from "../../../shared/seoLinter";
import { getDraft, approveDraft } from "./optimizations";
import { getAiOptimizationProvider, isMockProvider } from "./ai/optimizationProvider";
import {
  isGithubConfigured,
  GithubNotConfiguredError,
  ensureBranch,
  getOverridesFile,
  commitOverridesFile,
  openOrGetPR,
  getPRStatus,
} from "./github";
import { logAudit } from "./auditLog";

export const MAX_BATCH_SIZE = 20;

export type BatchDiffRow = {
  pagePath: string;
  pageId: number;
  before: { title: string | null; description: string | null };
  after: { title: string; description: string };
  hasBodyChanges: boolean;
  lint: LintResult;
};

export class LockedPagesError extends Error {
  constructor(public readonly locked: Array<{ pagePath: string; message: string }>) {
    super(`${locked.length} page(s) in this batch are locked for manual review.`);
    this.name = "LockedPagesError";
  }
}

export class LintBlockedError extends Error {
  constructor(public readonly blocked: Array<{ pagePath: string; findings: LintResult["findings"] }>) {
    super(`${blocked.length} page(s) in this batch fail the claims linter.`);
    this.name = "LintBlockedError";
  }
}

export class BatchTooLargeError extends Error {
  constructor(size: number) {
    super(`Batch has ${size} pages — the cap is ${MAX_BATCH_SIZE}.`);
    this.name = "BatchTooLargeError";
  }
}

/** Server-side twin of the UI's "drafts are mock" gate — not just UI-hidden (spec §0 principle). */
export class MockProviderError extends Error {
  constructor(public readonly model: string) {
    super(`AI drafts are placeholder mock content (provider "${model}") — approve-to-PR is disabled until a real AI provider is configured.`);
    this.name = "MockProviderError";
  }
}

function branchForToday(): string {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `pr-seo-meta-${yyyymmdd}`;
}

/**
 * Build the diff table for a candidate batch WITHOUT writing anything —
 * used by the approval modal (spec §5 step 2) to show the reviewer exactly
 * what will change before they type the batch label and confirm. Rejects
 * (throws) on locked pages or a BLOCK-level lint finding; the caller is
 * expected to catch these and show them inline rather than let the modal
 * open with an invalid batch.
 */
export async function buildBatchDiff(pageIds: number[]): Promise<BatchDiffRow[]> {
  if (pageIds.length === 0) throw new Error("Batch is empty.");
  if (pageIds.length > MAX_BATCH_SIZE) throw new BatchTooLargeError(pageIds.length);

  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");

  const rows: BatchDiffRow[] = [];
  const existingTitles: string[] = [];
  const existingMetas: string[] = [];

  // First pass: gather current page + draft state and prime the duplicate-check pool.
  // "before" reads from TODAY's batch branch (falling back to main, then the
  // page's own values) so the preview matches what approveBatchToPR will
  // actually diff against if a same-day earlier batch already touched this page.
  const todayBranch = branchForToday();
  const pending: Array<{ pageId: number; pagePath: string; draft: Awaited<ReturnType<typeof getDraft>>; before: { title: string | null; description: string | null } }> = [];
  for (const pageId of pageIds) {
    const [page] = await db.select().from(seoPages).where(eq(seoPages.id, pageId)).limit(1);
    if (!page) throw new Error(`Page id ${pageId} not found.`);
    const draft = await getDraft(pageId);
    const before = await currentOverrideOrPageValue(page.page, page.title, page.metaDescription, todayBranch);
    pending.push({ pageId, pagePath: page.page, draft, before });
    if (before.title) existingTitles.push(before.title);
    if (before.description) existingMetas.push(before.description);
  }

  const locked = await findLockedPages(pending.map((p) => p.pagePath));
  if (locked.size > 0) {
    throw new LockedPagesError(
      Array.from(locked.entries()).map(([pagePath, result]) => ({
        pagePath,
        message: result.locked ? result.message : "locked",
      })),
    );
  }

  const blocked: Array<{ pagePath: string; findings: LintResult["findings"] }> = [];
  for (const p of pending) {
    const title = p.draft.title ?? p.before.title ?? "";
    const description = p.draft.metaDescription ?? p.before.description ?? "";
    const lint = lintPageMeta(
      { pagePath: p.pagePath, title, metaDescription: description },
      {
        existingTitles: existingTitles.filter((t) => t !== p.before.title),
        existingMetas: existingMetas.filter((m) => m !== p.before.description),
      },
    );
    const hasBodyChanges = !!(p.draft.h1 || p.draft.faq?.length || p.draft.internalLinks?.length || p.draft.schema || p.draft.contentExpansion);
    if (!lint.passes) blocked.push({ pagePath: p.pagePath, findings: lint.findings.filter((f) => f.severity === "block") });
    rows.push({
      pagePath: p.pagePath,
      pageId: p.pageId,
      before: p.before,
      after: { title, description },
      hasBodyChanges,
      lint,
    });
  }

  if (blocked.length > 0) throw new LintBlockedError(blocked);

  return rows;
}

/**
 * The overrides value for `pagePath`, checked on `branch` first (today's batch
 * branch, so an earlier same-day unmerged batch's write is visible), then on
 * `main` (a previously-merged override), then falling back to the live page's
 * observed title/meta if neither file/entry exists.
 */
async function currentOverrideOrPageValue(
  pagePath: string,
  pageTitle: string | null,
  pageMeta: string | null,
  branch: string,
): Promise<{ title: string | null; description: string | null }> {
  if (isGithubConfigured()) {
    for (const candidate of branch === "main" ? ["main"] : [branch, "main"]) {
      try {
        const { content } = await getOverridesFile(candidate);
        const existing = content[pagePath];
        if (existing) return { title: existing.title, description: existing.description };
        break; // file exists on this branch but has no entry for this page — don't also check main.
      } catch {
        // This branch might not have the overrides file yet (first-ever batch
        // on it, or the token is scoped narrowly) — try the next candidate.
      }
    }
  }
  return { title: pageTitle, description: pageMeta };
}

export type ApproveBatchInput = {
  pageIds: number[];
  label: string;
  actorId: number | null;
};

export type ApproveBatchResult = {
  batch: SeoApprovalBatchRow;
  prUrl: string;
  prNumber: number;
};

/** Approve a validated batch, write the commit, open/append the PR, record everything. */
export async function approveBatchToPR(input: ApproveBatchInput): Promise<ApproveBatchResult> {
  if (!isGithubConfigured()) throw new GithubNotConfiguredError();
  const providerModel = getAiOptimizationProvider().model;
  if (isMockProvider(providerModel)) throw new MockProviderError(providerModel);
  if (!input.label.trim()) throw new Error("Batch label is required.");

  const diffRows = await buildBatchDiff(input.pageIds);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");

  const branch = branchForToday();
  await ensureBranch(branch);
  const { content: currentOverrides, sha } = await getOverridesFile(branch);

  const nextOverrides = { ...currentOverrides };
  for (const row of diffRows) {
    nextOverrides[row.pagePath] = { title: row.after.title, description: row.after.description };
  }

  const commitMessage = `seo(meta): ${input.label} — ${diffRows.length} pages\n\n${diffRows.map((r) => `- ${r.pagePath}`).join("\n")}`;
  const commitSha = await commitOverridesFile(branch, nextOverrides, commitMessage, sha);

  const prBody = renderDiffMarkdown(input.label, diffRows);
  const pr = await openOrGetPR(branch, `SEO meta batch — ${todayIso()}`, prBody);

  const inserted = await db.insert(seoApprovalBatches).values({
    label: input.label,
    pages: diffRows.map((r) => r.pagePath),
    diff: diffRows,
    actorId: input.actorId,
    branch,
    commitSha,
    prUrl: pr.url,
    prNumber: pr.number,
    status: "pr_open",
  });
  const batchId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  const [batchRow] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);

  for (const row of diffRows) {
    await approveDraft(row.pageId);
    await logAudit({
      actorId: input.actorId,
      action: "approved_to_pr",
      batchId,
      pagePath: row.pagePath,
      before: row.before,
      after: row.after,
      lintResult: row.lint,
    });
  }
  await logAudit({ actorId: input.actorId, action: "pr_opened", batchId, pagePath: null, before: null, after: { prUrl: pr.url, prNumber: pr.number }, lintResult: null });

  return { batch: batchRow, prUrl: pr.url, prNumber: pr.number };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function renderDiffMarkdown(label: string, rows: BatchDiffRow[]): string {
  const header = `## SEO meta batch: ${label}\n\n${rows.length} page(s). Title/meta description only — no body, schema, canonical, robots, or internal-link changes ship via this flow.\n\n`;
  const table = [
    "| Page | Old Title → New Title | Old Meta → New Meta |",
    "|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.pagePath} | ${escapeMd(r.before.title ?? "—")} → ${escapeMd(r.after.title)} | ${escapeMd(r.before.description ?? "—")} → ${escapeMd(r.after.description)} |`,
    ),
  ].join("\n");
  const bodyNote = rows.some((r) => r.hasBodyChanges)
    ? "\n\n⚠️ Some drafts in this batch also contained body/H1/FAQ/schema changes — **only title/meta was applied**; review those individually via the single-page Optimize flow.\n"
    : "";
  const checklist = "\n\n### Before merging\n- [ ] Titles/descriptions read naturally and match the page content\n- [ ] No claims-linter findings were overridden\n- [ ] Ready to go live\n";
  return header + table + bodyNote + checklist;
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/* ── Revert ──────────────────────────────────────────────────────────────── */

export type RevertResult = { batch: SeoApprovalBatchRow; prUrl: string; prNumber: number };

/** Open a PR that restores the pre-batch overrides for a `merged` batch. */
export async function revertBatch(batchId: number, actorId: number | null): Promise<RevertResult> {
  if (!isGithubConfigured()) throw new GithubNotConfiguredError();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");

  const [original] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!original) throw new Error(`Batch ${batchId} not found.`);
  if (original.status !== "merged") throw new Error(`Batch ${batchId} is "${original.status}", not "merged" — only a merged batch can be reverted.`);

  const allBatches = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.revertsBatchId, batchId));
  const existingRevert = allBatches.find((b) => b.status === "pr_open" || b.status === "merged");
  if (existingRevert) {
    throw new Error(`Batch ${batchId} already has a ${existingRevert.status} revert (batch ${existingRevert.id}, ${existingRevert.prUrl}).`);
  }

  const diffRows = original.diff as BatchDiffRow[];
  const branch = `revert-${original.branch}-${Date.now()}`;
  await ensureBranch(branch);
  const { content: currentOverrides, sha } = await getOverridesFile(branch);

  const nextOverrides = { ...currentOverrides };
  for (const row of diffRows) {
    if (row.before.title && row.before.description) {
      nextOverrides[row.pagePath] = { title: row.before.title, description: row.before.description };
    } else {
      delete nextOverrides[row.pagePath];
    }
  }

  const commitMessage = `revert: ${original.label} (batch ${original.id})\n\nReverts commit ${original.commitSha}.\n\n${diffRows.map((r) => `- ${r.pagePath}`).join("\n")}`;
  const commitSha = await commitOverridesFile(branch, nextOverrides, commitMessage, sha);

  const prBody = `## Revert: ${original.label}\n\nReverts batch #${original.id} (${original.prUrl}), commit \`${original.commitSha}\`.\n\n` + renderDiffMarkdown(`revert of ${original.label}`, diffRows.map((r) => ({ ...r, before: r.after, after: { title: r.before.title ?? "", description: r.before.description ?? "" } })));
  const pr = await openOrGetPR(branch, `revert: ${original.label}`, prBody);

  const insertedRevert = await db.insert(seoApprovalBatches).values({
    label: `revert: ${original.label}`,
    pages: original.pages,
    diff: diffRows,
    actorId,
    branch,
    commitSha,
    prUrl: pr.url,
    prNumber: pr.number,
    status: "pr_open",
    revertsBatchId: original.id,
  });
  const revertBatchId = Number((insertedRevert as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  const [revertRow] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, revertBatchId)).limit(1);

  await logAudit({ actorId, action: "revert_opened", batchId: revertRow.id, pagePath: null, before: { revertsBatchId: original.id }, after: { prUrl: pr.url, prNumber: pr.number }, lintResult: null });

  return { batch: revertRow, prUrl: pr.url, prNumber: pr.number };
}

/** True if `pagePath` is part of any batch still in `pr_open` — gates "Request Reindex" (spec §11). */
export async function isInPendingBatch(pagePath: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const openBatches = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.status, "pr_open"));
  return openBatches.some((b) => (b.pages as string[]).includes(pagePath));
}

export class PendingBatchError extends Error {
  constructor(pagePath: string) {
    super(`${pagePath} is in an open bulk-approve batch (PR not yet merged) — Request Reindex is disabled until it merges or the batch is reverted.`);
    this.name = "PendingBatchError";
  }
}

/**
 * Gate for "Request Reindex" (spec §11 acceptance test): a page whose
 * title/meta is sitting in an unmerged PR shouldn't be reindexed yet — Google
 * would crawl whatever's LIVE right now, not the pending change, and a
 * confusing double-reindex would follow once the PR does merge. Throws
 * PendingBatchError if blocked; callers filter it out of a bulk run or
 * reject a single-page request with it.
 */
export async function assertReindexAllowed(pageId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [page] = await db.select().from(seoPages).where(eq(seoPages.id, pageId)).limit(1);
  if (!page) return;
  if (await isInPendingBatch(page.page)) throw new PendingBatchError(page.page);
}

/* ── Merge detection (poll — spec §5 step 6, §6) ────────────────────────────
 * No webhook is wired up (would need a public endpoint + signature
 * verification, a separate decision). This is admin-triggered from the batch
 * history panel ("Refresh status") instead — same information, pulled on
 * demand rather than pushed.
 */

export type RefreshBatchResult = { batch: SeoApprovalBatchRow; changed: boolean };

/**
 * Poll this batch's PR and sync pr_open -> merged/failed into the DB. Merging
 * a REVERT batch cascades: the original batch it reverts flips to `reverted`
 * (spec §6, "Status -> reverted after merge").
 */
export async function refreshBatchStatus(batchId: number): Promise<RefreshBatchResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [batch] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!batch) throw new Error(`Batch ${batchId} not found.`);
  if (batch.status !== "pr_open" || !batch.prNumber || !isGithubConfigured()) {
    return { batch, changed: false };
  }

  const pr = await getPRStatus(batch.prNumber);

  if (pr.merged) {
    await db
      .update(seoApprovalBatches)
      .set({ status: "merged", commitSha: pr.mergeCommitSha ?? batch.commitSha })
      .where(eq(seoApprovalBatches.id, batchId));
    await logAudit({
      actorId: null, action: "merged_detected", batchId, pagePath: null,
      before: { status: "pr_open" }, after: { status: "merged" }, lintResult: null,
    });
    if (batch.revertsBatchId) {
      await db.update(seoApprovalBatches).set({ status: "reverted" }).where(eq(seoApprovalBatches.id, batch.revertsBatchId));
      await logAudit({
        actorId: null, action: "merged_detected", batchId: batch.revertsBatchId, pagePath: null,
        before: { status: "merged" }, after: { status: "reverted" }, lintResult: null,
      });
    }
    const [updated] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
    return { batch: updated, changed: true };
  }

  if (pr.state === "closed") {
    await db.update(seoApprovalBatches).set({ status: "failed" }).where(eq(seoApprovalBatches.id, batchId));
    const [updated] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
    return { batch: updated, changed: true };
  }

  return { batch, changed: false };
}
