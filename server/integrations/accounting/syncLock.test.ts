import { describe, it, expect } from "vitest";
import { SyncLock, withSyncLock } from "./syncLock";

describe("SyncLock — mutual exclusion", () => {
  it("grants once and refuses a concurrent acquire", () => {
    const lock = new SyncLock();
    expect(lock.tryAcquire("backfill-A")).toBe(true);
    expect(lock.tryAcquire("backfill-B")).toBe(false);
    lock.release("backfill-A");
    expect(lock.tryAcquire("backfill-B")).toBe(true);
  });

  it("only the holder can release (stale-takeover safety)", () => {
    const lock = new SyncLock();
    lock.tryAcquire("A");
    lock.release("B"); // not the holder — no-op
    expect(lock.tryAcquire("C")).toBe(false);
  });

  it("takes over a stale lock after staleAfterMs", () => {
    let t = 0;
    const lock = new SyncLock(1000, () => t);
    expect(lock.tryAcquire("A")).toBe(true);
    t = 999;
    expect(lock.tryAcquire("B")).toBe(false); // not stale yet
    t = 1000;
    expect(lock.tryAcquire("B")).toBe(true); // A is stale → B takes over
  });
});

describe("withSyncLock — no duplicate / no wedge", () => {
  it("prevents concurrent backfills: the second call runs onBusy, not fn", async () => {
    const lock = new SyncLock();
    let processed = 0;
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });

    const first = withSyncLock(lock, "run-1", async () => { await gate; processed++; return "ran"; }, () => "busy");
    // While run-1 holds the lock, a second backfill must be refused without processing.
    const second = await withSyncLock(lock, "run-2", async () => { processed++; return "ran"; }, () => "busy");
    expect(second).toBe("busy");
    expect(processed).toBe(0); // no duplicate processing yet

    release();
    expect(await first).toBe("ran");
    expect(processed).toBe(1); // exactly one run processed
  });

  it("releases the lock even when the run throws (a hung/aborted run cannot wedge it)", async () => {
    const lock = new SyncLock();
    await expect(
      withSyncLock(lock, "run-1", async () => { throw new Error("timed out"); }, () => "busy"),
    ).rejects.toThrow("timed out");
    // Lock must be free for the next run.
    expect(lock.state().heldBy).toBeNull();
    expect(lock.tryAcquire("run-2")).toBe(true);
  });
});
