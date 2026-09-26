/**
 * §3d/§7 Revert + "Revert all from this report" (docs/market-intel-spec.md).
 * Dispatches to whichever lane actually executed the item:
 *   - meta lane batch  -> server/services/seo/bulkApprove.ts's revertBatch()
 *                          (byte-exact title/meta restore — already
 *                          fixture-tested there; see PR description).
 *   - page-PR batch    -> ./pagePr.ts's revertPagePRBatch() (closes an open
 *                          PR, or opens a removal PR if already merged).
 *   - content-queue-only items (never reached a batch — see adjustments.ts's
 *     file header) have nothing to revert beyond the seoIntelItems row itself;
 *     the queued topic is left for the owner to remove from the content queue
 *     by hand if desired (no safe "delete" verb exists on that table today).
 * A dismiss (never executed) just records the reason — no lane call at all.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoIntelItems, type SeoIntelItemRow } from "../../../../drizzle/schema";
import { revertBatch } from "../bulkApprove";
import { revertPagePRBatch } from "./pagePr";
import { logAudit } from "../auditLog";
import type { SeoIntelDismissReason } from "../../../../shared/marketIntelTypes";

export class ItemNotFoundError extends Error {
  constructor(id: number) {
    super(`Market-intel item ${id} not found.`);
    this.name = "ItemNotFoundError";
  }
}

/** Dismiss an item that was never executed (§3d: "Dismiss/Revert requires a one-word reason"). */
export async function dismissItem(itemId: number, reason: SeoIntelDismissReason, actorId: number | null): Promise<SeoIntelItemRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [item] = await db.select().from(seoIntelItems).where(eq(seoIntelItems.id, itemId)).limit(1);
  if (!item) throw new ItemNotFoundError(itemId);
  await db.update(seoIntelItems).set({ status: "dismissed", dismissReason: reason }).where(eq(seoIntelItems.id, itemId));
  await logAudit({ actorId, action: "market_intel_item_reverted", batchId: item.executedBatchId, pagePath: null, before: { status: item.status }, after: { status: "dismissed", dismissReason: reason }, lintResult: null });
  const [updated] = await db.select().from(seoIntelItems).where(eq(seoIntelItems.id, itemId)).limit(1);
  return updated;
}

/** Revert one item (§3d "Revert" — one click). Idempotent-ish: an item with no executedBatchId just gets dismissed. */
export async function revertItem(itemId: number, reason: SeoIntelDismissReason, actorId: number | null): Promise<SeoIntelItemRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [item] = await db.select().from(seoIntelItems).where(eq(seoIntelItems.id, itemId)).limit(1);
  if (!item) throw new ItemNotFoundError(itemId);

  if (item.executedBatchId) {
    if (item.targetQueue === "meta_lane") {
      await revertBatch(item.executedBatchId, actorId);
    } else if (item.targetQueue === "page_pr_backlog" || item.targetQueue === "page_pr") {
      await revertPagePRBatch(item.executedBatchId, actorId);
    }
    // content_queue-executed items: nothing further to revert (see file header).
  }

  await db.update(seoIntelItems).set({ status: "expired", dismissReason: reason }).where(eq(seoIntelItems.id, itemId));
  await logAudit({ actorId, action: "market_intel_item_reverted", batchId: item.executedBatchId, pagePath: null, before: { status: item.status }, after: { status: "expired", dismissReason: reason }, lintResult: null });
  const [updated] = await db.select().from(seoIntelItems).where(eq(seoIntelItems.id, itemId)).limit(1);
  return updated;
}

/**
 * "Revert all from this report" (§3d/§7): reverts every EXECUTED (accepted,
 * has an executedBatchId) item from the report, in REVERSE order (most
 * recent first — §7's fixture requirement).
 */
export async function revertAllFromReport(reportId: number, actorId: number | null): Promise<{ reverted: number; failures: Array<{ itemId: number; error: string }> }> {
  const db = await getDb();
  if (!db) return { reverted: 0, failures: [] };
  const items = await db
    .select()
    .from(seoIntelItems)
    .where(and(eq(seoIntelItems.reportId, reportId), eq(seoIntelItems.status, "accepted")))
    .orderBy(desc(seoIntelItems.id));

  let reverted = 0;
  const failures: Array<{ itemId: number; error: string }> = [];
  for (const item of items) {
    try {
      await revertItem(item.id, "not_now", actorId);
      reverted++;
    } catch (err) {
      failures.push({ itemId: item.id, error: (err as Error).message });
    }
  }
  return { reverted, failures };
}
