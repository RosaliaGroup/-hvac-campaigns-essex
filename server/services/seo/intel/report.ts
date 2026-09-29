/**
 * Report assembly (docs/market-intel-spec.md §1, §5, §7). Runs every §2 data
 * collector, classifies via §3a-c, builds §3d item drafts, executes what the
 * §4 guardrails allow, and persists one seoIntelReports row + its
 * seoIntelItems. Never throws — degrades section-by-section (§2's own
 * "each degrades gracefully if unavailable").
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoIntelReports, seoIntelItems, type SeoIntelReportRow } from "../../../../drizzle/schema";
import { getSeoSiteUrl } from "../../../integrations/searchConsole";
import { snapshotTodaysQueries, collectSearchDemand } from "./searchDemand";
import { collectCompetitorDiffs } from "./competitorWatch";
import { collectSerpChecks } from "./serpChecks";
import { collectTrends } from "./trends";
import { detectDifferentiatorMatches, auditOurStaleClaims } from "./positioning";
import { buildItemDrafts, executeItem, emptyExecutionCounts, suggestionKeyFor, isSuppressed, laneReadyForAutoExecution, type ItemDraft } from "./adjustments";
import { checkCircuitBreakerConditions, checkMarketIntelCircuit, isGscFreshEnough } from "./guardrails";
import { logAudit } from "../auditLog";
import { sendDailyDigest } from "./email";
import type { MarketIntelSections } from "../../../../shared/marketIntelTypes";

function fmtDate(d: Date): string {
  // America/New_York calendar date (spec: "Runs 06:00 America/New_York daily").
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type RunReportOptions = { windowKind?: "daily" | "weekly"; now?: Date };

export type RunReportResult = { report: SeoIntelReportRow; items: number; executed: number; emailSent: boolean };

/** The single entry point the cron/"Run now" trigger calls. */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function runMarketIntelReport(opts: RunReportOptions = {}): Promise<RunReportResult | { skipped: true; reason: string }> {
  if (process.env.SEO_INTEL_ENABLED !== "true") {
    return { skipped: true, reason: "SEO_INTEL_ENABLED is not \"true\" — market-intel is off." };
  }

  const now = opts.now ?? new Date();
  const windowKind = opts.windowKind ?? "daily";
  const date = fmtDate(now);
  const db = await getDb();
  if (!db) return { skipped: true, reason: "Database unavailable." };

  const siteUrl = getSeoSiteUrl();

  // §4: GSC-sync-freshness gate — skip §3a entirely (not the whole report) if stale.
  const gsc = await isGscFreshEnough(now);

  let searchDemand: MarketIntelSections["searchDemand"] = {
    rising: [], unserved: [], decaying: [], cannibalization: [], seasonality: [], skipped: true, skippedReason: gsc.reason,
  };
  if (gsc.fresh) {
    try {
      await snapshotTodaysQueries(siteUrl, now);
      const collected = await collectSearchDemand(siteUrl, now);
      searchDemand = { ...collected, seasonality: [], skipped: false, skippedReason: null };
    } catch (err) {
      searchDemand = { rising: [], unserved: [], decaying: [], cannibalization: [], seasonality: [], skipped: true, skippedReason: `search-demand collection failed: ${(err as Error).message}` };
    }
  }

  const competitors = await collectCompetitorDiffs(now).catch((err) => ({ diffs: [], skippedDomains: [`collection failed: ${(err as Error).message}`] }));
  const serp = await collectSerpChecks();
  const trends = await collectTrends();
  const differentiatorMatches = detectDifferentiatorMatches(competitors.diffs);
  const staleClaims = auditOurStaleClaims();

  const drafts = buildItemDrafts({
    rising: searchDemand.rising, unserved: searchDemand.unserved, decaying: searchDemand.decaying,
    cannibalization: searchDemand.cannibalization, seasonality: searchDemand.seasonality,
    competitorDiffs: competitors.diffs, differentiatorMatches, staleClaims,
  });

  // §4: shared autopublish breaker (gates the underlying lanes) AND market-intel's own breaker (§4: 2 reverts/7d or 1 wrong/off_brand).
  const [sharedBreaker, ownBreaker, metaWarmedUp] = await Promise.all([
    checkCircuitBreakerConditions(),
    checkMarketIntelCircuit(now),
    laneReadyForAutoExecution("meta"),
  ]);
  const circuitClear = !sharedBreaker.shouldPause && !ownBreaker.shouldPause;
  const circuitReason = sharedBreaker.reason ?? ownBreaker.reason;

  // Persist the report row first (items need reportId).
  const sections: MarketIntelSections = {
    searchDemand, competitors: { diffs: competitors.diffs, skippedDomains: competitors.skippedDomains },
    positioning: { theirClaims: differentiatorMatches, ourStaleClaims: staleClaims },
    serp, trends,
    numbers: {
      clicks7d: 0, clicksPrior7d: 0, impressions7d: 0, impressionsPrior7d: 0,
      topRisingQueries: searchDemand.rising.slice(0, 3).map((r) => r.query),
    },
  };

  const inserted = await db
    .insert(seoIntelReports)
    .values({ date, windowKind, sections, itemCount: 0, circuitPaused: !circuitClear, gscStale: searchDemand.skipped })
    .onDuplicateKeyUpdate({ set: { sections, circuitPaused: !circuitClear, gscStale: searchDemand.skipped } });
  let reportId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);
  if (reportId === 0) {
    const [existing] = await db.select().from(seoIntelReports).where(eq(seoIntelReports.date, date)).limit(1);
    reportId = existing?.id ?? 0;
  }

  let counts = emptyExecutionCounts();
  let executed = 0;
  let accepted = 0;
  let itemsCreated = 0;

  for (const draft of drafts) {
    const key = suggestionKeyFor(draft.kind, draft.title, draft.targetQueue);
    if (await isSuppressed(key, now)) continue; // §7: dismissed-as-wrong/off_brand within 90 days — not re-suggested.

    const { result, counts: nextCounts } = await executeItem(draft as ItemDraft, { counts, metaWarmedUp, circuitClear, now });
    counts = nextCounts;

    const executedNow = result.status === "executed";
    if (executedNow) { executed++; accepted++; }

    await db.insert(seoIntelItems).values({
      reportId, kind: draft.kind as never,
      // Titles embed raw external data (GSC query strings, competitor page
      // text) with no upstream length cap — seen in production: a ~700-char
      // "query" that was really scraped bio text overflowed this varchar(255)
      // column (ER_DATA_TOO_LONG). Truncate defensively at the one insert
      // site rather than each of adjustments.ts's ~10 title-construction call
      // sites.
      title: draft.title.length > 255 ? `${draft.title.slice(0, 252)}…` : draft.title,
      evidence: draft.evidence as object,
      suggestion: draft.suggestion, targetQueue: draft.targetQueue, suggestionKey: key,
      status: executedNow ? "accepted" : "open",
      factsBlocked: draft.factsBlocked,
      executedBatchId: executedNow && "batchId" in result ? result.batchId : null,
      executedPrId: executedNow && "prNumber" in result && result.prNumber ? String(result.prNumber) : null,
    });
    itemsCreated++;
  }

  const summary = buildSummary({ itemCount: itemsCreated, executed, circuitClear, circuitReason, gscStale: searchDemand.skipped });

  await db
    .update(seoIntelReports)
    .set({ itemCount: itemsCreated, acceptedCount: accepted, executedCount: executed, summary })
    .where(eq(seoIntelReports.id, reportId));

  await logAudit({ actorId: null, action: "market_intel_report_generated", batchId: null, pagePath: null, before: null, after: { reportId, itemCount: itemsCreated, executed }, lintResult: null });

  const emailSent = await sendDailyDigest({ reportId, date, itemCount: itemsCreated, executed, summary, circuitClear });
  if (emailSent) await db.update(seoIntelReports).set({ emailSent: true }).where(eq(seoIntelReports.id, reportId));

  const [finalReport] = await db.select().from(seoIntelReports).where(eq(seoIntelReports.id, reportId)).limit(1);
  return { report: finalReport, items: itemsCreated, executed, emailSent };
}

function buildSummary(input: { itemCount: number; executed: number; circuitClear: boolean; circuitReason: string | null; gscStale: boolean }): string {
  if (!input.circuitClear) return `Paused: suggestions only (${input.circuitReason ?? "circuit breaker open"}).`;
  if (input.gscStale) return "Search Console data is stale — search-demand analysis skipped today; competitor/positioning sections still ran.";
  if (input.itemCount === 0) return "No material changes today.";
  return `${input.itemCount} suggestion${input.itemCount === 1 ? "" : "s"} today, ${input.executed} executed automatically through their lane; the rest are staged for review.`;
}
