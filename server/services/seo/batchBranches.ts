/**
 * One PR per batch. Both autopublish lanes used to name their branch by DAY
 * (`pr-seo-meta-YYYYMMDD`, `pr-content-YYYYMMDD`), so a second batch or topic on
 * the same day silently APPENDED to the first one's branch and PR. These helpers
 * give every batch its own branch, and let a lane refuse to open a second PR
 * while one is still open: every meta PR rewrites the same overrides JSON and
 * every content PR inserts into the same blogPosts.ts anchor, so two concurrent
 * PRs would conflict once the first merges. Open one, let it merge, open the next.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { seoApprovalBatches, SEO_BATCH_STATUS, type SeoApprovalBatchRow } from "../../../drizzle/schema";

export const META_BRANCH_PREFIX = "pr-seo-meta-";
export const CONTENT_BRANCH_PREFIX = "pr-content-";

/**
 * `base` if no batch has used that branch yet, else `base-2`, `base-3`, … — the
 * first name no batch (any status) has ever used, so a merged-and-kept branch is
 * never reused with a stale base.
 */
export async function uniqueBranchFor(base: string): Promise<string> {
  const db = await getDb();
  if (!db) return base;
  const rows = await db.select().from(seoApprovalBatches).where(inArray(seoApprovalBatches.status, [...SEO_BATCH_STATUS]));
  const used = new Set(rows.map((r) => r.branch));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** A batch in this lane (by branch prefix) whose PR is still open, or null. */
export async function findOpenBatchWithPrefix(prefix: string): Promise<SeoApprovalBatchRow | null> {
  const db = await getDb();
  if (!db) return null;
  const open = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.status, "pr_open"));
  return open.find((b) => b.branch.startsWith(prefix)) ?? null;
}
