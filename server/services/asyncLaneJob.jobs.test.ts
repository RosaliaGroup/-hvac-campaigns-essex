import { describe, it, expect, beforeEach, vi } from "vitest";
import { startJob, getJob, listRunningJobs, startLaneJob, getLaneJobStatus, _resetLaneJobs } from "./asyncLaneJob";

beforeEach(() => {
  _resetLaneJobs();
  vi.useRealTimers();
});

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("startJob / getJob — keyed jobs with progress", () => {
  it("returns a job id immediately without awaiting fn", () => {
    const d = deferred();
    const { jobId, started } = startJob({ kind: "optimize", key: "optimize:1", fn: () => d.promise });
    expect(started).toBe(true);
    expect(getJob(jobId)).toMatchObject({ kind: "optimize", key: "optimize:1", status: "running", finishedAt: null, progress: null });
    d.resolve();
  });

  it("settles to done with the result", async () => {
    const { jobId } = startJob({ kind: "k", key: "k", fn: async () => ({ n: 3 }) });
    await vi.waitFor(() => expect(getJob(jobId)?.status).toBe("done"));
    expect(getJob(jobId)).toMatchObject({ result: { n: 3 }, error: null });
    expect(getJob(jobId)?.finishedAt).not.toBeNull();
  });

  it("settles to error with the message — including a synchronous throw inside fn", async () => {
    const a = startJob({ kind: "k", key: "a", fn: async () => { throw new Error("async boom"); } });
    const b = startJob({ kind: "k", key: "b", fn: (() => { throw new Error("sync boom"); }) as () => Promise<void> });
    await vi.waitFor(() => expect(getJob(a.jobId)?.status).toBe("error"));
    await vi.waitFor(() => expect(getJob(b.jobId)?.status).toBe("error"));
    expect(getJob(a.jobId)?.error).toBe("async boom");
    expect(getJob(b.jobId)?.error).toBe("sync boom");
  });

  it("dedupes on key: a second start while running hands back the RUNNING job and never runs its fn", async () => {
    const d = deferred();
    const first = startJob({ kind: "optimize", key: "optimize:7", fn: () => d.promise });
    const fn2 = vi.fn(async () => "never");
    const second = startJob({ kind: "optimize", key: "optimize:7", fn: fn2 });
    expect(second).toEqual({ jobId: first.jobId, started: false });
    expect(fn2).not.toHaveBeenCalled();
    d.resolve();
    await vi.waitFor(() => expect(getJob(first.jobId)?.status).toBe("done"));
  });

  it("allows a fresh job for the same key once the previous settled, with a new id", async () => {
    const first = startJob({ kind: "k", key: "same", fn: async () => 1 });
    await vi.waitFor(() => expect(getJob(first.jobId)?.status).toBe("done"));
    const second = startJob({ kind: "k", key: "same", fn: async () => 2 });
    expect(second.started).toBe(true);
    expect(second.jobId).not.toBe(first.jobId);
    // The finished job stays readable by its own id.
    expect(getJob(first.jobId)?.result).toBe(1);
  });

  it("keeps different keys independent", () => {
    const d = deferred();
    const a = startJob({ kind: "optimize", key: "optimize:1", fn: () => d.promise });
    const b = startJob({ kind: "optimize", key: "optimize:2", fn: () => d.promise });
    expect(a.started && b.started).toBe(true);
    expect(a.jobId).not.toBe(b.jobId);
    d.resolve();
  });

  it("reports progress via setTotal/tick, clamped to total", async () => {
    const gate = deferred();
    const { jobId } = startJob({
      kind: "bulkOptimize",
      key: "bulk",
      fn: async (ctx) => {
        ctx.setTotal(3);
        ctx.tick();
        ctx.tick(1);
        await gate.promise;
        ctx.tick(10); // overshoot must clamp
      },
    });
    await vi.waitFor(() => expect(getJob(jobId)?.progress).toEqual({ done: 2, total: 3 }));
    gate.resolve();
    await vi.waitFor(() => expect(getJob(jobId)?.status).toBe("done"));
    expect(getJob(jobId)?.progress).toEqual({ done: 3, total: 3 });
  });

  it("returns a copy — mutating a snapshot cannot corrupt the registry", () => {
    const d = deferred();
    const { jobId } = startJob({ kind: "k", key: "k", fn: async (ctx) => { ctx.setTotal(5); await d.promise; } });
    const snap = getJob(jobId)!;
    snap.status = "done";
    if (snap.progress) snap.progress.done = 99;
    expect(getJob(jobId)?.status).toBe("running");
    d.resolve();
  });

  it("getJob is null for an id the server never issued (what a restart looks like to a poller)", () => {
    expect(getJob("job_from_before_the_restart")).toBeNull();
  });

  it("listRunningJobs returns only running, non-lane jobs, filterable by kind", async () => {
    const d = deferred();
    startJob({ kind: "optimize", key: "optimize:1", fn: () => d.promise });
    startJob({ kind: "bulkOptimize", key: "bulk:1", fn: () => d.promise });
    startLaneJob("content", () => d.promise);
    const done = startJob({ kind: "optimize", key: "optimize:done", fn: async () => 1 });
    await vi.waitFor(() => expect(getJob(done.jobId)?.status).toBe("done"));

    expect(listRunningJobs().map((j) => j.key).sort()).toEqual(["bulk:1", "optimize:1"]);
    expect(listRunningJobs("optimize").map((j) => j.key)).toEqual(["optimize:1"]);
    d.resolve();
  });

  it("prunes finished non-lane jobs after the TTL but never a lane's last result", async () => {
    vi.useFakeTimers();
    const job = startJob({ kind: "optimize", key: "optimize:1", fn: async () => "x" });
    startLaneJob("content", async () => "lane-result");
    await vi.advanceTimersByTimeAsync(10);
    expect(getJob(job.jobId)?.status).toBe("done");
    expect(getLaneJobStatus("content").status).toBe("done");

    await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    startJob({ kind: "optimize", key: "optimize:2", fn: async () => "y" }); // prune runs on start
    expect(getJob(job.jobId)).toBeNull();
    expect(getLaneJobStatus("content")).toMatchObject({ status: "done", result: "lane-result" });
  });

  it("lanes and keyed jobs share one registry but never collide on keys", () => {
    const d = deferred();
    startLaneJob("meta", () => d.promise);
    const other = startJob({ kind: "optimize", key: "meta", fn: () => d.promise }); // same bare name as a lane
    expect(other.started).toBe(true);
    d.resolve();
  });
});
