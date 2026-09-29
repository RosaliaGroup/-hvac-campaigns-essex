import { describe, it, expect, beforeEach, vi } from "vitest";
import { startLaneJob, getLaneJobStatus, _resetLaneJobs } from "./asyncLaneJob";

beforeEach(() => {
  _resetLaneJobs();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("asyncLaneJob", () => {
  it("reads idle for a lane that has never run", () => {
    expect(getLaneJobStatus("content")).toEqual({ status: "idle", startedAt: null, finishedAt: null, error: null, result: null });
  });

  it("returns immediately without awaiting fn — the whole point of the fix", async () => {
    const d = deferred<string>();
    const { started } = startLaneJob("content", () => d.promise);
    expect(started).toBe(true);
    // fn hasn't resolved yet — status must already be "running", proving
    // startLaneJob did not await it.
    expect(getLaneJobStatus("content").status).toBe("running");
    d.resolve("ok");
    await d.promise;
  });

  it("transitions to done with the result once fn resolves", async () => {
    const { started } = startLaneJob("content", async () => "the-draft");
    expect(started).toBe(true);
    await vi.waitFor(() => expect(getLaneJobStatus("content").status).toBe("done"));
    const status = getLaneJobStatus("content");
    expect(status.result).toBe("the-draft");
    expect(status.error).toBeNull();
    expect(status.finishedAt).not.toBeNull();
  });

  it("transitions to error with the message once fn rejects, never throwing out of startLaneJob itself", async () => {
    expect(() => startLaneJob("meta", async () => { throw new Error("boom"); })).not.toThrow();
    await vi.waitFor(() => expect(getLaneJobStatus("meta").status).toBe("error"));
    expect(getLaneJobStatus("meta").error).toBe("boom");
  });

  it("rejects a second start while one is already running for the SAME lane (the 504-retry-duplicate fix)", async () => {
    const d = deferred<void>();
    const first = startLaneJob("marketIntel", () => d.promise);
    const second = startLaneJob("marketIntel", async () => { throw new Error("should never run"); });
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    // Status must still reflect the FIRST job, untouched by the rejected second call.
    expect(getLaneJobStatus("marketIntel").status).toBe("running");
    d.resolve();
    await d.promise;
  });

  it("allows a new run once the previous one for that lane finished", async () => {
    await new Promise<void>((resolve) => {
      startLaneJob("content", async () => resolve());
    });
    await vi.waitFor(() => expect(getLaneJobStatus("content").status).toBe("done"));
    const { started } = startLaneJob("content", async () => "second-run");
    expect(started).toBe(true);
  });

  it("keeps lanes independent — a running content job doesn't block meta or marketIntel", async () => {
    const d = deferred<void>();
    const contentStart = startLaneJob("content", () => d.promise);
    const metaStart = startLaneJob("meta", async () => "meta-done");
    expect(contentStart.started).toBe(true);
    expect(metaStart.started).toBe(true);
    d.resolve();
    await d.promise;
  });
});
