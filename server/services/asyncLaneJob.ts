/**
 * Generic fire-and-forget job runner for the SEO/market-intel lanes' "Run now"
 * / "Draft next topic now" buttons AND for every other long-running SEO
 * mutation (single-page optimize, bulk optimize, regenerate drafts, Search
 * Console sync). One registry, two front doors: `startLaneJob`/`getLaneJobStatus`
 * (one slot per named lane) and `startJob`/`getJob` (keyed, with progress).
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
 * identical daily reports). The per-row Optimize / Optimize Selected /
 * Regenerate / Sync mutations had the identical shape and are moved onto the
 * same registry (2026-09-29).
 *
 * The fix, same shape as ai/jobs.ts's per-page `activeJobs` registry for
 * optimization jobs: track one job slot per key, in-process. `startJob`
 * registers the key as running and kicks off `fn()` WITHOUT awaiting it, so
 * the mutation returns immediately; a second call while the key is still
 * running is rejected (`started: false`, handing back the running job's id)
 * instead of racing a duplicate. The client polls for progress/completion.
 *
 * In-process only (lost on restart, not shared across replicas) — acceptable
 * here: the underlying jobs are themselves idempotent-ish "process one topic" /
 * "one report for today" / "draft these pages" operations a human can always
 * just click again, and the state's only job is driving a progress indicator +
 * preventing accidental double-clicks within one server lifetime, not
 * surviving a deploy mid-job. A poll for an id the server no longer knows
 * reads as "unknown" and the client says so instead of spinning forever.
 */

/* ── Keyed job registry ───────────────────────────────────────────────────
 *
 * Every job — lane or otherwise — lives in `jobs`, addressed by an opaque id.
 * `key` is the dedupe identity: while a job with that key is running, a second
 * `startJob` for the same key is a no-op that hands back the RUNNING job's id,
 * so a retried click after a 504 attaches to the original job instead of
 * racing a duplicate. Progress is optional: a job's `fn` receives a context to
 * report `done/total` and the client polls `getJob`.
 *
 * Retention: finished jobs stay readable for FINISHED_TTL_MS (so the poller
 * that started them can read the outcome), then are pruned. Lane jobs are
 * exempt from the TTL — their "last result" is what the lane status shows.
 */

export type JobProgress = { done: number; total: number };

export type JobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  key: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt: number | null;
  /** null until the job reports a total (or never, for jobs with no natural unit). */
  progress: JobProgress | null;
  error: string | null;
  result: T | null;
};

export type JobContext = {
  /** Declare how many units of work there are (call once the count is known). */
  setTotal(total: number): void;
  /** Mark `n` more units done (default 1). */
  tick(n?: number): void;
};

const LANE_KIND = "lane";
const FINISHED_TTL_MS = 60 * 60 * 1000;
const MAX_JOBS = 500;

const jobs = new Map<string, JobSnapshot>();
/** key → id of the most recent job started for that key (running or finished). */
const latestByKey = new Map<string, string>();
let seq = 0;

function newJobId(): string {
  seq += 1;
  return `job_${Date.now().toString(36)}_${seq.toString(36)}`;
}

function dropJob(job: JobSnapshot): void {
  jobs.delete(job.id);
  if (latestByKey.get(job.key) === job.id) latestByKey.delete(job.key);
}

function prune(now: number): void {
  for (const job of Array.from(jobs.values())) {
    if (job.status === "running" || job.kind === LANE_KIND) continue;
    if (job.finishedAt !== null && now - job.finishedAt > FINISHED_TTL_MS) dropJob(job);
  }
  if (jobs.size <= MAX_JOBS) return;
  const finished = Array.from(jobs.values())
    .filter((j) => j.status !== "running" && j.kind !== LANE_KIND)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  for (const j of finished) {
    if (jobs.size <= MAX_JOBS) break;
    dropJob(j);
  }
}

/**
 * Start a job unless one with the same `key` is already running. Returns
 * immediately — `fn` is NOT awaited. `started: false` means "attach to
 * `jobId`, it is the job already in flight".
 */
export function startJob<T>(spec: {
  kind: string;
  key: string;
  fn: (ctx: JobContext) => Promise<T>;
}): { jobId: string; started: boolean } {
  const existingId = latestByKey.get(spec.key);
  const existing = existingId ? jobs.get(existingId) : undefined;
  if (existing && existing.status === "running") return { jobId: existing.id, started: false };

  const now = Date.now();
  prune(now);

  const id = newJobId();
  const job: JobSnapshot = {
    id,
    kind: spec.kind,
    key: spec.key,
    status: "running",
    startedAt: now,
    finishedAt: null,
    progress: null,
    error: null,
    result: null,
  };
  jobs.set(id, job);
  latestByKey.set(spec.key, id);

  const ctx: JobContext = {
    setTotal(total) {
      job.progress = { done: job.progress?.done ?? 0, total: Math.max(0, total) };
    },
    tick(n = 1) {
      const total = job.progress?.total ?? 0;
      const done = (job.progress?.done ?? 0) + n;
      job.progress = { done: total > 0 ? Math.min(total, done) : done, total };
    },
  };

  // Promise.resolve().then(...) so a synchronous throw inside fn is captured as
  // a job error instead of escaping startJob (the mutation must never throw
  // after the job is registered).
  Promise.resolve()
    .then(() => spec.fn(ctx))
    .then((result) => {
      job.status = "done";
      job.finishedAt = Date.now();
      job.result = result;
    })
    .catch((err) => {
      job.status = "error";
      job.finishedAt = Date.now();
      job.error = err instanceof Error ? err.message : String(err);
    });

  return { jobId: id, started: true };
}

/** Snapshot of a job by id (a copy — callers can't mutate registry state). Null if unknown/pruned/lost to a restart. */
export function getJob(jobId: string): JobSnapshot | null {
  const job = jobs.get(jobId);
  return job ? { ...job, progress: job.progress ? { ...job.progress } : null } : null;
}

/** Currently-running non-lane jobs, optionally filtered by kind — lets a reloaded page re-attach to work still in flight. */
export function listRunningJobs(kind?: string): JobSnapshot[] {
  return Array.from(jobs.values())
    .filter((j) => j.status === "running" && j.kind !== LANE_KIND && (kind === undefined || j.kind === kind))
    .map((j) => getJob(j.id)!);
}

/* ── Lane front door (unchanged public API) ──────────────────────────────── */

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

const laneKey = (lane: LaneName) => `${LANE_KIND}:${lane}`;

/** Current status for a lane. Never throws; unknown/never-run lanes read as idle. */
export function getLaneJobStatus(lane: LaneName): LaneJobStatus {
  const id = latestByKey.get(laneKey(lane));
  const job = id ? jobs.get(id) : undefined;
  if (!job) return IDLE;
  return { status: job.status, startedAt: job.startedAt, finishedAt: job.finishedAt, error: job.error, result: job.result };
}

/**
 * Start a lane job if none is already running for it. Returns immediately —
 * `fn` is NOT awaited. Returns `{ started: false }` (and does nothing else) if
 * the lane already has a job in flight, so a duplicate click/retry is a no-op
 * rather than a race.
 */
export function startLaneJob<T>(lane: LaneName, fn: () => Promise<T>): { started: boolean } {
  const { started } = startJob({ kind: LANE_KIND, key: laneKey(lane), fn: () => fn() });
  return { started };
}

/** Test seam — clear all job state between tests. */
export function _resetLaneJobs(): void {
  jobs.clear();
  latestByKey.clear();
}
