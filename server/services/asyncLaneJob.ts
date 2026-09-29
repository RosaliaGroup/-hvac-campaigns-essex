/**
 * Generic fire-and-forget job runner for the SEO/market-intel lanes' "Run now"
 * / "Draft next topic now" buttons.
 *
 * Root cause this fixes: runContentJobNow, runNightlyDraftJobNow, and
 * marketIntel.runNow used to `await` the whole draft/report generation
 * (an AI-model-backed job that can run well past the proxy's request timeout)
 * directly inside the tRPC mutation handler. The client saw an HTTP 504 long
 * before the job finished, even though the job itself kept running to
 * completion server-side — and a user who retried after the 504 could start a
 * SECOND concurrent job for the same underlying work, since none of these
 * endpoints had any duplicate-run protection (2026-09-28 incident: a retried
 * "Draft next topic now" click raced nextTopicToProcess() and drafted the same
 * content-queue topic twice; a retried market-intel "Run now" produced two
 * identical daily reports).
 *
 * The fix, same shape as jobs.ts's per-page `activeJobs` registry for
 * optimization jobs: track one job slot per lane, in-process. `startLaneJob`
 * registers the lane as running and kicks off `fn()` WITHOUT awaiting it, so
 * the mutation returns immediately; a second call while the lane is still
 * running is rejected (`started: false`) instead of racing a duplicate. The
 * client polls `getLaneJobStatus` to know when the job actually finishes.
 *
 * In-process only (lost on restart) — acceptable here: the underlying jobs are
 * themselves idempotent-ish "process one topic" / "one report for today"
 * operations a human can always just click again, and the state's only job is
 * driving a progress indicator + preventing accidental double-clicks within
 * one server lifetime, not surviving a deploy mid-job.
 */

export const LANES = ["content", "meta", "marketIntel"] as const;
export type LaneName = (typeof LANES)[number];

export type LaneJobStatus = {
  status: "idle" | "running" | "done" | "error";
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  result: unknown;
};

const IDLE: LaneJobStatus = { status: "idle", startedAt: null, finishedAt: null, error: null, result: null };

const state = new Map<LaneName, LaneJobStatus>();

/** Current status for a lane. Never throws; unknown/never-run lanes read as idle. */
export function getLaneJobStatus(lane: LaneName): LaneJobStatus {
  return state.get(lane) ?? IDLE;
}

/**
 * Start a lane job if none is already running for it. Returns immediately —
 * `fn` is NOT awaited. Returns `{ started: false }` (and does nothing else) if
 * the lane already has a job in flight, so a duplicate click/retry is a no-op
 * rather than a race.
 */
export function startLaneJob<T>(lane: LaneName, fn: () => Promise<T>): { started: boolean } {
  const current = getLaneJobStatus(lane);
  if (current.status === "running") return { started: false };

  const startedAt = Date.now();
  state.set(lane, { status: "running", startedAt, finishedAt: null, error: null, result: null });

  fn()
    .then((result) => {
      state.set(lane, { status: "done", startedAt, finishedAt: Date.now(), error: null, result });
    })
    .catch((err) => {
      state.set(lane, {
        status: "error",
        startedAt,
        finishedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
        result: null,
      });
    });

  return { started: true };
}

/** Test seam — clear all lane state between tests. */
export function _resetLaneJobs(): void {
  state.clear();
}
