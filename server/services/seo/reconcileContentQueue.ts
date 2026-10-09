import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { seoApprovalBatches, seoContentQueue } from "../../../drizzle/schema";
import { getFileContent, isGithubConfigured } from "./github";

/**
 * Reconcile stale content topics after their PR batch was merged.
 * Never marks a topic published based solely on a merged batch: the exact
 * expected blog slug must also be present in the main branch's blog registry.
 * This confirms repository publication, not a live HTTP 200 on the website.
 */
export async function reconcileMergedContentTopics(): Promise<{ checked: number; published: number; held: number }> {
  const result = { checked: 0, published: 0, held: 0 };
  if (!isGithubConfigured()) return result;
  const db = await getDb();
  if (!db) return result;

  const rows = await db.select({
    id: seoContentQueue.id,
    status: seoContentQueue.status,
    contentBatchId: seoContentQueue.contentBatchId,
    batchStatus: seoApprovalBatches.status,
    pages: seoApprovalBatches.pages,
  }).from(seoContentQueue)
    .leftJoin(seoApprovalBatches, eq(seoContentQueue.contentBatchId, seoApprovalBatches.id))
    .where(eq(seoContentQueue.status, "pr_open"));

  if (!rows.length) return result;
  // Fetch once; a missing/failed GitHub response must not change DB statuses.
  const { content } = await getFileContent("client/src/data/blogPosts.ts", "main");
  const slugs = new Set(Array.from(content.matchAll(/["']slug["']\s*:\s*["']([^"']+)["']/g), m => m[1]));
  for (const row of rows) {
    result.checked++;
    const pages = Array.isArray(row.pages) ? row.pages : [];
    const expectedSlugs = pages
      .filter((p): p is string => typeof p === "string" && p.startsWith("/blog/"))
      .map(p => p.slice("/blog/".length));
    if (row.batchStatus !== "merged" || !expectedSlugs.length || !expectedSlugs.every(slug => slugs.has(slug))) {
      result.held++;
      continue;
    }
    await db.update(seoContentQueue).set({ status: "published" })
      .where(eq(seoContentQueue.id, row.id));
    result.published++;
  }
  return result;
}
