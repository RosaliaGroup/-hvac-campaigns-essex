/**
 * §4 guardrails (docs/market-intel-spec.md): daily execution caps, warm-up
 * gating, the shared circuit breaker, the GSC-freshness skip, and 90-day
 * suggestion suppression. Reuses server/services/seo/warmupGate.ts and
 * circuitBreaker.ts wholesale (same lanes, same state table) rather than
 * building a parallel gate — the spec's circuit breaker is explicitly
 * "shared with autopublish".
 */
import crypto from "crypto";
import { and, eq, gte, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoIntelItems } from "../../../../drizzle/schema";
import { readSyncStatus } from "../sync";
import { isWarmedUp, type AutopublishLane } from "../warmupGate";
import { checkCircuitBreakerConditions } from "../circuitBreaker";

export const DAILY_CAPS = {
  totalItems: 10,
  metaChanges: 20,
  newPosts: 1,
  newPages: 1,
  refreshes: 3,
} as const;

export type ExecutionKind = "meta_change" | "new_post" | "new_page" | "refresh_post";

export type ExecutionCounts = { total: number; metaChanges: number; newPosts: number; newPages: number; refreshes: number };

export function emptyExecutionCounts(): ExecutionCounts {
  return { total: 0, metaChanges: 0, newPosts: 0, newPages: 0, refreshes: 0 };
}

/** Pure — would executing one more `kind` item exceed today's caps? */
export function withinDailyCaps(counts: ExecutionCounts, kind: ExecutionKind): boolean {
  if (counts.total >= DAILY_CAPS.totalItems) return false;
  switch (kind) {
    case "meta_change":
      return counts.metaChanges < DAILY_CAPS.metaChanges;
    case "new_post":
      return counts.newPosts < DAILY_CAPS.newPosts;
    case "new_page":
      return counts.newPages < DAILY_CAPS.newPages;
    case "refresh_post":
      return counts.refreshes < DAILY_CAPS.refreshes;
  }
}

export function recordExecution(counts: ExecutionCounts, kind: ExecutionKind): ExecutionCounts {
  const next = { ...counts, total: counts.total + 1 };
  switch (kind) {
    case "meta_change": next.metaChanges++; break;
    case "new_post": next.newPosts++; break;
    case "new_page": next.newPages++; break;
    case "refresh_post": next.refreshes++; break;
  }
  return next;
}

/** §4: "If GSC sync failed in the last 24h, the job executes nothing and reports why." */
export async function isGscFreshEnough(now: Date = new Date()): Promise<{ fresh: boolean; reason: string | null }> {
  const status = await readSyncStatus();
  if (!status.lastSuccessAt) return { fresh: false, reason: "Search Console has never synced successfully." };
  const ageMs = now.getTime() - new Date(status.lastSuccessAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    return { fresh: false, reason: `Last successful GSC sync was ${(ageMs / (60 * 60 * 1000)).toFixed(1)}h ago (>24h).` };
  }
  if (status.lastRunStatus === "error") {
    return { fresh: false, reason: `Most recent GSC sync attempt failed: ${status.lastError ?? "unknown error"}.` };
  }
  return { fresh: true, reason: null };
}

/** §4 warm-up: "the intel job may only execute automatically once the underlying lane is warmed up... Before that, it stages and the report says 'staged — approve to run'." */
export async function laneReadyForAutoExecution(lane: AutopublishLane): Promise<boolean> {
  return isWarmedUp(lane);
}

export { checkCircuitBreakerConditions };

/* ── Market-intel's OWN circuit breaker (§4: "2 reverts in 7 days, or 1
 * wrong/off_brand, pauses execution") — distinct thresholds from (and
 * evaluated IN ADDITION TO) the shared autopublish breaker above, which
 * gates the underlying lanes themselves. Both must be clear for the intel
 * job to execute anything. */

export type MarketIntelCircuitSignals = { revertsInLast7Days: number; wrongOrOffBrandInLast90Days: number };
export type MarketIntelCircuitResult = { shouldPause: boolean; reason: string | null };

export function evaluateMarketIntelCircuit(signals: MarketIntelCircuitSignals): MarketIntelCircuitResult {
  if (signals.revertsInLast7Days >= 2) {
    return { shouldPause: true, reason: `${signals.revertsInLast7Days} market-intel items were reverted in the last 7 days.` };
  }
  if (signals.wrongOrOffBrandInLast90Days >= 1) {
    return { shouldPause: true, reason: "A market-intel item was dismissed as wrong/off_brand." };
  }
  return { shouldPause: false, reason: null };
}

export async function checkMarketIntelCircuit(now: Date = new Date()): Promise<MarketIntelCircuitResult> {
  const db = await getDb();
  if (!db) return { shouldPause: false, reason: null };
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since90 = new Date(now.getTime() - SUPPRESSION_DAYS * 24 * 60 * 60 * 1000);

  // The spec's own seoIntelItems.status enum (§1: open|accepted|dismissed|expired)
  // has no dedicated "reverted" value — server/services/seo/intel/revert.ts moves a
  // reverted item to "expired" (no longer live), so that's the proxy used here.
  const [reverted, wrongOrOffBrand] = await Promise.all([
    db.select().from(seoIntelItems).where(and(eq(seoIntelItems.status, "expired"), gte(seoIntelItems.updatedAt, since7))),
    db
      .select()
      .from(seoIntelItems)
      .where(
        and(
          eq(seoIntelItems.status, "dismissed"),
          or(eq(seoIntelItems.dismissReason, "wrong"), eq(seoIntelItems.dismissReason, "off_brand")),
          gte(seoIntelItems.updatedAt, since90),
        ),
      ),
  ]);

  return evaluateMarketIntelCircuit({ revertsInLast7Days: reverted.length, wrongOrOffBrandInLast90Days: wrongOrOffBrand.length });
}

/** Stable identity for a suggestion, independent of report/day — powers 90-day suppression. */
export function suggestionKeyFor(kind: string, title: string, targetQueue: string | null): string {
  return crypto.createHash("sha256").update(`${kind}\n${title.trim().toLowerCase()}\n${targetQueue ?? ""}`).digest("hex").slice(0, 32);
}

const SUPPRESSION_DAYS = 90;

/** §3d/§7: "a dismissed-as-wrong item is not re-suggested within 90 days." Checked before an item is created; suppressed suggestions are simply not re-added to the new report. */
export async function isSuppressed(suggestionKey: string, now: Date = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const since = new Date(now.getTime() - SUPPRESSION_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(seoIntelItems)
    .where(
      and(
        eq(seoIntelItems.suggestionKey, suggestionKey),
        eq(seoIntelItems.status, "dismissed"),
        or(eq(seoIntelItems.dismissReason, "wrong"), eq(seoIntelItems.dismissReason, "off_brand")),
        gte(seoIntelItems.updatedAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
