import { beforeEach, describe, expect, it } from "vitest";
import {
  batchCacheKey,
  batchSignature,
  loadBatches,
  saveBatch,
  clearBatches,
  tryAcquireRun,
  releaseRun,
  isRunActive,
  __resetRunLockForTests,
} from "./takeoffBatchCache";

/** Minimal in-memory Storage for the node test environment. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, v); },
  } as Storage;
}

describe("batch cache key + signature", () => {
  it("is versioned and tied to project + mode", () => {
    expect(batchCacheKey(42, "quick")).toBe("takeoff-batches:v1:42:quick");
    expect(batchCacheKey(42, "precise")).toBe("takeoff-batches:v1:42:precise");
  });
  it("signature changes when page selection changes", () => {
    expect(batchSignature("quick", [1, 2, 3, 4])).not.toBe(batchSignature("quick", [1, 2, 3, 5]));
    expect(batchSignature("quick", [1, 2])).not.toBe(batchSignature("precise", [1, 2]));
  });
});

describe("resume cache", () => {
  let store: Storage;
  beforeEach(() => { store = fakeStorage(); });

  it("round-trips completed batches", () => {
    const sig = batchSignature("quick", [1, 2, 3, 4, 5, 6, 7, 8]);
    saveBatch(1, "quick", sig, 0, "batch-0-text", store);
    saveBatch(1, "quick", sig, 1, "batch-1-text", store);
    const loaded = loadBatches(1, "quick", sig, store);
    expect(loaded).toEqual({ "0": "batch-0-text", "1": "batch-1-text" });
  });

  it("ignores cache when the signature (page selection) changed", () => {
    const sigA = batchSignature("quick", [1, 2, 3, 4]);
    const sigB = batchSignature("quick", [5, 6, 7, 8]);
    saveBatch(1, "quick", sigA, 0, "old", store);
    expect(loadBatches(1, "quick", sigB, store)).toEqual({}); // invalidated
  });

  it("scopes cache per mode", () => {
    const sig = batchSignature("quick", [1, 2]);
    saveBatch(1, "quick", sig, 0, "q", store);
    // precise uses a different key -> empty
    expect(loadBatches(1, "precise", batchSignature("precise", [1, 2]), store)).toEqual({});
  });

  it("clearBatches removes the cache (only called after successful save)", () => {
    const sig = batchSignature("quick", [1, 2]);
    saveBatch(1, "quick", sig, 0, "q", store);
    clearBatches(1, "quick", store);
    expect(loadBatches(1, "quick", sig, store)).toEqual({});
  });

  it("returns {} on corrupt cache", () => {
    store.setItem(batchCacheKey(1, "quick"), "not json");
    expect(loadBatches(1, "quick", "sig", store)).toEqual({});
  });
});

describe("duplicate-run lock", () => {
  beforeEach(() => __resetRunLockForTests());

  it("prevents a second concurrent run for the same take-off", () => {
    expect(tryAcquireRun(7)).toBe(true);
    expect(isRunActive(7)).toBe(true);
    expect(tryAcquireRun(7)).toBe(false); // blocked
  });

  it("allows a different take-off to run concurrently", () => {
    expect(tryAcquireRun(7)).toBe(true);
    expect(tryAcquireRun(8)).toBe(true);
  });

  it("allows re-running after release", () => {
    expect(tryAcquireRun(7)).toBe(true);
    releaseRun(7);
    expect(isRunActive(7)).toBe(false);
    expect(tryAcquireRun(7)).toBe(true);
  });
});
