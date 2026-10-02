/**
 * Autopublish circuit breaker (docs/seo-automation-addendum-autopublish.md
 * §A5). Auto-pauses the content lane (and notifies) on any of: a veto in the
 * last 7 days; a revert in the last 14 days; site-wide clicks down >25%
 * week-over-week; Netlify preview fails twice in a row; the critic pass
 * blocks 3 consecutive drafts. Resume requires an admin note, logged.
 *
 * evaluateCircuitBreakerSignals() is the pure decision function — cheaply
 * unit-testable without a DB. checkCircuitBreakerConditions() is the thin I/O
 * wrapper real callers (the nightly/weekly jobs, before drafting or merging)
 * use.
 *
 * CLICKS SIGNAL: a true 7-day vs prior-7-day comparison of Google Search Console
 * site-wide clicks (live query, dimension=date; the window ends `GSC_DATA_LAG_DAYS`
 * before today because GSC data lags). It needs a baseline of at least
 * MIN_BASELINE_CLICKS clicks (below that the signal is "insufficient_baseline"
 * and cannot pause anything — a handful of clicks swings by tens of percent),
 * and it is NOT evaluated for 48h after a title/meta batch merges (the merge
 * itself moves clicks). It used to reuse seoPages' 90-day-vs-prior-90-day sums
 * as a stand-in; that fired on a real but slow 90-day decline and said "down 28%"
 * with no window in the message. EVERY evaluation logs its inputs.
 */
import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { inArray } from "drizzle-orm";
import { seoApprovalBatches } from "../../../drizzle/schema";
import { getSearchConsoleAccessToken, getSeoSiteUrl, querySearchAnalytics } from "../../integrations/searchConsole";
import { META_BRANCH_PREFIX } from "./batchBranches";
import { listAuditLog, logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { getNetlifyCheckState } from "./github";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const CLICKS_DOWN_THRESHOLD = 0.25;
export const CLICKS_WINDOW_DAYS = 7;
/** Baseline (prior 7 days) must have at least this many clicks for the clicks signal to count. */
export const MIN_BASELINE_CLICKS = 50;
/** After a title/meta batch merges, clicks are not evaluated for this long. */
export const TITLE_BATCH_EXCLUSION_MS = 48 * 60 * 60 * 1000;
/** Google Search Console data lags ~2-3 days (same constant as sync.ts). */
export const GSC_DATA_LAG_DAYS = 3;

export type CircuitBreakerResult = { shouldPause: boolean; reason: string | null };

export type CircuitBreakerSignals = {
  vetoInLast7Days: boolean;
  revertOpenedInLast14Days: boolean;
  /** Fraction down, e.g. 0.3 = 30% down. Null = no/insufficient data. */
  clicksDownPct: number | null;
  /** Most-recent-first Netlify check states for the last auto-lane batches. */
  lastTwoAutoLaneNetlifyStates: Array<"success" | "failure" | "pending" | "unknown">;
  /** Most-recent-first: did the critic pass block this content draft? */
  last3ContentDraftsCriticBlocked: boolean[];
};

/** Pure — no I/O. The actual pause/no-pause logic, given already-fetched signals. */
export function evaluateCircuitBreakerSignals(signals: CircuitBreakerSignals): CircuitBreakerResult {
  if (signals.vetoInLast7Days) {
    return { shouldPause: true, reason: "A veto was recorded in the last 7 days." };
  }
  if (signals.revertOpenedInLast14Days) {
    return { shouldPause: true, reason: "A revert was opened in the last 14 days." };
  }
  if (signals.clicksDownPct !== null && signals.clicksDownPct > CLICKS_DOWN_THRESHOLD) {
    return {
      shouldPause: true,
      reason: `Site-wide clicks are down ${(signals.clicksDownPct * 100).toFixed(0)}% (last 7 days vs the prior 7 days).`,
    };
  }
  if (signals.lastTwoAutoLaneNetlifyStates.length === 2 && signals.lastTwoAutoLaneNetlifyStates.every((s) => s === "failure")) {
    return { shouldPause: true, reason: "The Netlify preview failed for the last two auto-lane batches in a row." };
  }
  if (signals.last3ContentDraftsCriticBlocked.length === 3 && signals.last3ContentDraftsCriticBlocked.every(Boolean)) {
    return { shouldPause: true, reason: "The critic pass blocked 3 consecutive content drafts." };
  }
  return { shouldPause: false, reason: null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type ClickWindow = { start: string; end: string };

/** Pure: the two back-to-back 7-day windows, ending GSC_DATA_LAG_DAYS before `now`. */
export function computeClickWindows(now: Date): { current: ClickWindow; previous: ClickWindow } {
  const end = new Date(now.getTime() - GSC_DATA_LAG_DAYS * DAY_MS);
  const curStart = new Date(end.getTime() - (CLICKS_WINDOW_DAYS - 1) * DAY_MS);
  const prevEnd = new Date(curStart.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (CLICKS_WINDOW_DAYS - 1) * DAY_MS);
  return { current: { start: isoDay(curStart), end: isoDay(end) }, previous: { start: isoDay(prevStart), end: isoDay(prevEnd) } };
}

export type ClicksStatus = "evaluated" | "insufficient_baseline" | "excluded_title_batch_merge" | "unavailable";

export type ClicksInputs = {
  status: ClicksStatus;
  currentWindow: ClickWindow;
  previousWindow: ClickWindow;
  currentClicks: number | null;
  baselineClicks: number | null;
  minBaselineClicks: number;
  /** A title/meta batch merged within the last 48h (clicks not evaluated). */
  titleBatchMerge: { batchId: number; mergedDetectedAt: string } | null;
  downPct: number | null;
  error?: string;
};

/** Pure: turn the raw numbers into a status + fraction-down (null unless evaluated). */
export function evaluateClicksDown(i: {
  currentClicks: number | null;
  baselineClicks: number | null;
  titleBatchMerge: ClicksInputs["titleBatchMerge"];
  minBaselineClicks?: number;
}): { status: ClicksStatus; downPct: number | null } {
  const min = i.minBaselineClicks ?? MIN_BASELINE_CLICKS;
  if (i.titleBatchMerge) return { status: "excluded_title_batch_merge", downPct: null };
  if (i.currentClicks === null || i.baselineClicks === null) return { status: "unavailable", downPct: null };
  if (i.baselineClicks < min) return { status: "insufficient_baseline", downPct: null };
  const down = (i.baselineClicks - i.currentClicks) / i.baselineClicks;
  return { status: "evaluated", downPct: down > 0 ? down : 0 };
}

/** A title/meta batch whose merge was detected in the last 48h, or null. */
async function recentTitleBatchMerge(now: number): Promise<ClicksInputs["titleBatchMerge"]> {
  const merges = await listAuditLog({ action: "merged_detected", since: new Date(now - TITLE_BATCH_EXCLUSION_MS) });
  const ids = Array.from(new Set(merges.map((m) => m.batchId).filter((id): id is number => typeof id === "number")));
  if (ids.length === 0) return null;
  const db = await getDb();
  if (!db) return null;
  const batches = await db.select().from(seoApprovalBatches).where(inArray(seoApprovalBatches.id, ids));
  const titleIds = new Set(batches.filter((b) => b.branch.startsWith(META_BRANCH_PREFIX)).map((b) => b.id));
  const hit = merges.filter((m) => typeof m.batchId === "number" && titleIds.has(m.batchId)).sort((x, y) => new Date(y.ts).getTime() - new Date(x.ts).getTime())[0];
  return hit ? { batchId: hit.batchId as number, mergedDetectedAt: new Date(hit.ts).toISOString() } : null;
}

/** Live GSC: site-wide clicks for the current vs previous 7-day window. Never throws — failure => "unavailable" (no pause). */
async function fetchClicksInputs(now: number): Promise<ClicksInputs> {
  const w = computeClickWindows(new Date(now));
  const base: ClicksInputs = { status: "unavailable", currentWindow: w.current, previousWindow: w.previous, currentClicks: null, baselineClicks: null, minBaselineClicks: MIN_BASELINE_CLICKS, titleBatchMerge: null, downPct: null };
  try {
    const titleBatchMerge = await recentTitleBatchMerge(now);
    if (titleBatchMerge) return { ...base, titleBatchMerge, ...evaluateClicksDown({ currentClicks: null, baselineClicks: null, titleBatchMerge }) };
    const accessToken = await getSearchConsoleAccessToken();
    const rows = await querySearchAnalytics({ accessToken, siteUrl: getSeoSiteUrl(), startDate: w.previous.start, endDate: w.current.end, dimensions: ["date"], rowLimit: 100 });
    let cur = 0, prev = 0;
    for (const r of rows) {
      const day = r.keys[0] ?? "";
      if (day >= w.current.start && day <= w.current.end) cur += r.clicks;
      else if (day >= w.previous.start && day <= w.previous.end) prev += r.clicks;
    }
    return { ...base, currentClicks: cur, baselineClicks: prev, titleBatchMerge: null, ...evaluateClicksDown({ currentClicks: cur, baselineClicks: prev, titleBatchMerge: null }) };
  } catch (err) {
    return { ...base, error: (err as Error).message.slice(0, 200) };
  }
}

/** Last two auto-lane batches' Netlify check states — auto-lane batches are labeled "auto-YYYYMMDD" by the jobs that create them. */
async function lastTwoAutoLaneNetlifyStates(): Promise<CircuitBreakerSignals["lastTwoAutoLaneNetlifyStates"]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(seoApprovalBatches).orderBy(desc(seoApprovalBatches.createdAt)).limit(50);
  const autoLane = rows.filter((r) => r.label.startsWith("auto-") && r.commitSha).slice(0, 2);
  const states = await Promise.all(autoLane.map((r) => getNetlifyCheckState(r.commitSha as string)));
  return states;
}

/** Last 3 content-lane draft_generated audit rows' critic verdicts, most-recent-first. */
async function last3ContentCriticBlocked(): Promise<boolean[]> {
  const rows = await listAuditLog({ action: "draft_generated", limit: 50 });
  const contentRows = rows
    .filter((r) => (r.after as { lane?: string } | null)?.lane === "content")
    .slice(0, 3);
  return contentRows.map((r) => !!(r.after as { criticBlocked?: boolean } | null)?.criticBlocked);
}

/** Fetch real signals, evaluate, and persist a pause if newly triggered. */
export async function checkCircuitBreakerConditions(): Promise<CircuitBreakerResult> {
  const state = await getAutopublishState();
  if (state.circuitBreakerPaused) {
    console.log("[SEO][breaker] evaluation " + JSON.stringify({ at: new Date().toISOString(), alreadyPaused: true, reason: state.circuitBreakerReason }));
    return { shouldPause: true, reason: state.circuitBreakerReason };
  }

  const now = Date.now();
  const [vetoes, reverts, clicks, netlifyStates, criticBlocked] = await Promise.all([
    listAuditLog({ action: "vetoed", since: new Date(now - SEVEN_DAYS_MS) }),
    listAuditLog({ action: "revert_opened", since: new Date(now - FOURTEEN_DAYS_MS) }),
    fetchClicksInputs(now),
    lastTwoAutoLaneNetlifyStates(),
    last3ContentCriticBlocked(),
  ]);

  const signals: CircuitBreakerSignals = {
    vetoInLast7Days: vetoes.length > 0,
    revertOpenedInLast14Days: reverts.length > 0,
    clicksDownPct: clicks.downPct,
    lastTwoAutoLaneNetlifyStates: netlifyStates,
    last3ContentDraftsCriticBlocked: criticBlocked,
  };
  const result = evaluateCircuitBreakerSignals(signals);
  const inputs = { at: new Date(now).toISOString(), signals, clicks, result };
  console.log("[SEO][breaker] evaluation " + JSON.stringify(inputs));

  if (result.shouldPause) {
    await pauseCircuitBreaker(result.reason ?? "Unknown trigger", null, inputs);
  }
  return result;
}

export async function pauseCircuitBreaker(reason: string, actorId: number | null, inputs?: unknown): Promise<void> {
  await updateAutopublishState({ circuitBreakerPaused: true, circuitBreakerReason: reason, circuitBreakerPausedAt: new Date() });
  await logAudit({ actorId, action: "circuit_breaker_paused", batchId: null, pagePath: null, before: null, after: inputs === undefined ? { reason } : { reason, inputs }, lintResult: null });
}

export class CircuitBreakerNoteRequiredError extends Error {
  constructor() {
    super("Resuming autopublish requires a note explaining why it's safe to resume.");
    this.name = "CircuitBreakerNoteRequiredError";
  }
}

/** Admin "Resume auto-publish" (spec: "requires an admin click with a note, logged"). */
export async function resumeCircuitBreaker(note: string, actorId: number | null): Promise<void> {
  if (!note.trim()) throw new CircuitBreakerNoteRequiredError();
  await updateAutopublishState({ circuitBreakerPaused: false, circuitBreakerReason: null, circuitBreakerPausedAt: null });
  await logAudit({ actorId, action: "circuit_breaker_resumed", batchId: null, pagePath: null, before: null, after: { note }, lintResult: null });
}
