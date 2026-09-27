/**
 * §3d's last bullet + §4's fact firewall (docs/market-intel-spec.md):
 * "Pricing / offer / warranty term / program figure / new service claim ->
 * owner decision item... nothing publishes until the facts-file value
 * exists... a one-field form that, when filled, releases the change through
 * the normal lane." §7's minimum test target: "An owner-decision item never
 * publishes while its facts value is null."
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoIntelItems, type SeoIntelItemRow } from "../../../../drizzle/schema";
import { logAudit } from "../auditLog";

/** Pure — the entire firewall gate, in one place. A non-facts-blocked item is always releasable (nothing to gate). */
export function canReleaseOwnerDecisionItem(item: Pick<SeoIntelItemRow, "factsBlocked" | "ownerDecisionValue">): boolean {
  if (!item.factsBlocked) return true;
  return !!item.ownerDecisionValue?.trim();
}

export class OwnerDecisionValueRequiredError extends Error {
  constructor() {
    super("A value is required to release this item through its lane.");
    this.name = "OwnerDecisionValueRequiredError";
  }
}

/**
 * Owner supplies the missing figure. This ONLY records the value and marks
 * the item "accepted" — it does not itself re-run execution (the item still
 * routes through whichever lane function (approveBatchToPR/proposeTopic/
 * openPagePR) the report/CRM flow calls next, exactly like any other
 * accepted item; see server/routers/marketIntel.ts's acceptItem mutation).
 * Throws (never silently no-ops) if the value is blank — the item stays
 * facts-blocked.
 */
export async function submitOwnerDecisionValue(itemId: number, value: string, actorId: number | null): Promise<SeoIntelItemRow> {
  if (!value.trim()) throw new OwnerDecisionValueRequiredError();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  await db.update(seoIntelItems).set({ ownerDecisionValue: value.trim(), status: "accepted" }).where(eq(seoIntelItems.id, itemId));
  await logAudit({ actorId, action: "market_intel_owner_decision_released", batchId: null, pagePath: null, before: null, after: { itemId, ownerDecisionValueSet: true }, lintResult: null });
  const [row] = await db.select().from(seoIntelItems).where(eq(seoIntelItems.id, itemId)).limit(1);
  return row;
}
