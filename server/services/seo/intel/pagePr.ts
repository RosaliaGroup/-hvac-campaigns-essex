/**
 * openPagePR() — the "page-PR lane" (docs/market-intel-spec.md §3d "New site
 * page", §4). This lane did NOT exist anywhere in the codebase before this
 * feature (confirmed: no `openPagePR` reference anywhere except the spec
 * itself) — the other two named entry points, `approveBatchToPR` (meta lane,
 * server/services/seo/bulkApprove.ts) and the content lane's
 * `approveContentToPR` (server/services/seo/contentPipeline.ts — the spec
 * calls it "publishPost"; that literal name doesn't exist in the codebase,
 * this is the function that actually fulfills that role), both already
 * existed and are reused as-is.
 *
 * Scope decision (reported in the PR): this lane commits to a new, minimal
 * `client/src/data/pageProposals.ts` DATA registry (slug/title/meta/outline),
 * NOT a full rendered React page + route — the spec's own "PR-3 page
 * templates" don't exist yet anywhere in this codebase (growth-system-spec.md
 * §6 and others reference "PR-3 pages once live" as a still-future project).
 * Building a real page-template system is out of scope for this feature; what
 * IS delivered is a genuine, working write path (branch, commit, PR, DB
 * batch row, revert) other code can extend once PR-3 lands.
 *
 * Auto-merge scope decision: unlike the meta/content lanes, this file never
 * sets `seoApprovalBatches.holdUntil` — a page-PR batch is ALWAYS a normal,
 * human-merged PR in this first pass. Wiring a real 48-hour hold + auto-merge
 * for a brand-new third lane would mean extending warmupGate.ts's
 * meta/content-only AutopublishLane type and its DB-backed warm-up counters
 * (a schema change touching state other in-flight branches also read) —
 * deliberately deferred given "pages are structural" already argues for
 * extra caution before automating their merge at all.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoApprovalBatches, type SeoApprovalBatchRow } from "../../../../drizzle/schema";
import { isGithubConfigured, GithubNotConfiguredError, ensureBranch, getFileContent, putFileContent, openOrGetPR } from "../github";
import { logAudit } from "../auditLog";
import { yyyymmdd } from "../bulkApprove";
import type { PageProposal } from "../../../../client/src/data/pageProposals";

const PAGE_PROPOSALS_PATH = "client/src/data/pageProposals.ts";
const ARRAY_MARKER = "export const PAGE_PROPOSALS: PageProposal[] = [";

/** Pure — insert one proposal into the registry's source text. */
export function insertPageProposalIntoSource(source: string, proposal: PageProposal): string {
  const idx = source.indexOf(ARRAY_MARKER);
  if (idx === -1) throw new Error(`${PAGE_PROPOSALS_PATH} is missing the expected PAGE_PROPOSALS array marker.`);
  const insertAt = idx + ARRAY_MARKER.length;
  const literal = `\n  ${JSON.stringify(proposal)},`;
  return source.slice(0, insertAt) + literal + source.slice(insertAt);
}

/** Pure — remove the proposal with this slug (Revert). No-op (returns source unchanged) if the slug isn't present. */
export function removePageProposalFromSource(source: string, slug: string): string {
  const re = new RegExp(`\\n\\s*\\{[^{}]*"slug"\\s*:\\s*"${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^{}]*\\},?`, "s");
  return source.replace(re, "");
}

export type OpenPagePrResult = { batchId: number; prUrl: string; prNumber: number };

/**
 * Draft + open a PR proposing a new site page. Never merges. `actorId` null
 * for a system-triggered (market-intel job) call.
 */
export async function openPagePR(proposal: PageProposal, actorId: number | null): Promise<OpenPagePrResult> {
  if (!isGithubConfigured()) throw new GithubNotConfiguredError();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");

  const branch = `pr-page-${proposal.slug}-${yyyymmdd()}`;
  await ensureBranch(branch);
  const { content: currentSource, sha } = await getFileContent(PAGE_PROPOSALS_PATH, branch);
  const updatedSource = insertPageProposalIntoSource(currentSource, proposal);
  const commitMessage = `content(page-proposal): ${proposal.title}\n\nProposed by the market-intel job for query "${proposal.targetQuery}" (docs/market-intel-spec.md §3d).`;
  const commitSha = await putFileContent(PAGE_PROPOSALS_PATH, branch, updatedSource, commitMessage, sha);

  const prBody = [
    `## New page proposal: ${proposal.title}`,
    "",
    `**Slug:** \`${proposal.slug}\`  **Target query:** ${proposal.targetQuery}`,
    "",
    `> ${proposal.outline}`,
    "",
    "This is a DATA-ONLY proposal (client/src/data/pageProposals.ts) — no route or rendered page ships with this PR. A human builds the actual page from the PR-3 template system once approved.",
    "",
    "### Before merging",
    "- [ ] Query intent and outline are accurate",
    "- [ ] No claims outside verifiedFacts.ts",
    "- [ ] Worth building as a real page",
  ].join("\n");
  const pr = await openOrGetPR(branch, `Page proposal — ${proposal.title}`, prBody);

  const inserted = await db.insert(seoApprovalBatches).values({
    label: `page-pr: ${proposal.title}`,
    pages: [`/${proposal.slug}`],
    diff: [{ pagePath: `/${proposal.slug}`, pageId: 0, before: { title: null, description: null }, after: { title: proposal.title, description: proposal.metaDescription }, hasBodyChanges: true, lint: { findings: [], passes: true } }],
    actorId,
    branch,
    commitSha,
    prUrl: pr.url,
    prNumber: pr.number,
    status: "pr_open",
    // holdUntil intentionally left null — see file header ("always human-merged in this first pass").
  });
  const batchId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  await logAudit({ actorId, action: "pr_opened", batchId, pagePath: `/${proposal.slug}`, before: null, after: { prUrl: pr.url, prNumber: pr.number, lane: "page" }, lintResult: null });

  return { batchId, prUrl: pr.url, prNumber: pr.number };
}

/** Revert a page-PR batch: if still open, closes it; if merged, opens a follow-up PR removing the proposal entry. */
export async function revertPagePRBatch(batchId: number, actorId: number | null): Promise<{ batch: SeoApprovalBatchRow; prUrl: string | null; prNumber: number | null }> {
  if (!isGithubConfigured()) throw new GithubNotConfiguredError();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [batch] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!batch) throw new Error(`Batch ${batchId} not found.`);

  const diff = batch.diff as Array<{ pagePath: string }>;
  const slug = diff[0]?.pagePath.replace(/^\//, "") ?? "";

  if (batch.status === "pr_open") {
    const { closePR } = await import("../github");
    if (batch.prNumber) await closePR(batch.prNumber);
    await db.update(seoApprovalBatches).set({ status: "failed" }).where(eq(seoApprovalBatches.id, batchId));
    await logAudit({ actorId, action: "vetoed", batchId, pagePath: diff[0]?.pagePath ?? null, before: { status: "pr_open" }, after: { status: "failed", reason: "market-intel revert" }, lintResult: null });
    const [updated] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
    return { batch: updated, prUrl: null, prNumber: null };
  }

  // Merged — open a follow-up PR removing the entry from the registry.
  const revertBranch = `revert-${batch.branch}-${Date.now()}`;
  await ensureBranch(revertBranch);
  const { content: currentSource, sha } = await getFileContent(PAGE_PROPOSALS_PATH, revertBranch);
  const updatedSource = removePageProposalFromSource(currentSource, slug);
  const commitSha = await putFileContent(PAGE_PROPOSALS_PATH, revertBranch, updatedSource, `revert: page proposal ${slug}\n\nReverts batch ${batch.id} (${batch.prUrl}).`, sha);
  const pr = await openOrGetPR(revertBranch, `revert: page proposal ${slug}`, `Reverts batch #${batch.id} (${batch.prUrl}).`);

  const insertedRevert = await db.insert(seoApprovalBatches).values({
    label: `revert: ${batch.label}`, pages: batch.pages, diff: batch.diff, actorId,
    branch: revertBranch, commitSha, prUrl: pr.url, prNumber: pr.number, status: "pr_open", revertsBatchId: batch.id,
  });
  const revertBatchId = Number((insertedRevert as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);
  await logAudit({ actorId, action: "revert_opened", batchId: revertBatchId, pagePath: diff[0]?.pagePath ?? null, before: { revertsBatchId: batch.id }, after: { prUrl: pr.url, prNumber: pr.number }, lintResult: null });

  const [revertRow] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, revertBatchId)).limit(1);
  return { batch: revertRow, prUrl: pr.url, prNumber: pr.number };
}
