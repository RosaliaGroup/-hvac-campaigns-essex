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
 * KNOWN APPROXIMATION: "week-over-week" clicks has no dedicated time-series
 * table (seoPages only tracks a 90-day window vs. the previous 90-day
 * window — see its schema comment). Rather than block this whole feature on
 * building a new weekly-snapshot pipeline, this reuses that 90-day delta as
 * a documented stand-in. It will trip later and less precisely than a true
 * WoW comparison would. Flagged here and in the final build report.
 */
import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { seoPages, seoApprovalBatches } from "../../../drizzle/schema";
import { listAuditLog, logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { getNetlifyCheckState } from "./github";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const CLICKS_DOWN_THRESHOLD = 0.25;

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
      reason: `Site-wide clicks are down ${(signals.clicksDownPct * 100).toFixed(0)}% (90-day-window approximation of week-over-week).`,
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

async function siteWideClicksDownPct(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(seoPages);
  if (rows.length === 0) return null;
  let clicks = 0;
  let previousClicks = 0;
  for (const r of rows) {
    clicks += r.clicks;
    previousClicks += r.previousClicks;
  }
  if (previousClicks <= 0) return null;
  const delta = (previousClicks - clicks) / previousClicks;
  return delta > 0 ? delta : 0;
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
    return { shouldPause: true, reason: state.circuitBreakerReason };
  }

  const now = Date.now();
  const [vetoes, reverts, clicksDownPct, netlifyStates, criticBlocked] = await Promise.all([
    listAuditLog({ action: "vetoed", since: new Date(now - SEVEN_DAYS_MS) }),
    listAuditLog({ action: "revert_opened", since: new Date(now - FOURTEEN_DAYS_MS) }),
    siteWideClicksDownPct(),
    lastTwoAutoLaneNetlifyStates(),
    last3ContentCriticBlocked(),
  ]);

  const result = evaluateCircuitBreakerSignals({
    vetoInLast7Days: vetoes.length > 0,
    revertOpenedInLast14Days: reverts.length > 0,
    clicksDownPct,
    lastTwoAutoLaneNetlifyStates: netlifyStates,
    last3ContentDraftsCriticBlocked: criticBlocked,
  });

  if (result.shouldPause) {
    await pauseCircuitBreaker(result.reason ?? "Unknown trigger", null);
  }
  return result;
}

export async function pauseCircuitBreaker(reason: string, actorId: number | null): Promise<void> {
  await updateAutopublishState({ circuitBreakerPaused: true, circuitBreakerReason: reason, circuitBreakerPausedAt: new Date() });
  await logAudit({ actorId, action: "circuit_breaker_paused", batchId: null, pagePath: null, before: null, after: { reason }, lintResult: null });
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
