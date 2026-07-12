import { describe, expect, it, vi } from "vitest";
import { IdempotencyStore } from "./idempotency";

/** A clock we can advance by hand for TTL tests. */
function fakeClock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("IdempotencyStore", () => {
  it("returns the cached result and does NOT re-run fn for a completed key", async () => {
    const store = new IdempotencyStore();
    const fn = vi.fn(async () => "result-A");

    const first = await store.run("k1", fn);
    const second = await store.run("k1", fn);

    expect(first).toEqual({ value: "result-A", cached: false, coalesced: false });
    expect(second.value).toBe("result-A");
    expect(second.cached).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1); // billed once, second served from cache
  });

  it("coalesces concurrent calls for the same key onto one fn invocation", async () => {
    const store = new IdempotencyStore();
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => { resolve = r; }));

    const p1 = store.run("k1", fn);
    const p2 = store.run("k1", fn); // arrives while k1 is in flight
    resolve("shared");
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fn).toHaveBeenCalledTimes(1); // only one Anthropic call
    expect(r1.value).toBe("shared");
    expect(r2.value).toBe("shared");
    expect(r2.coalesced).toBe(true);
  });

  it("does NOT cache a value rejected by `cacheable` (failed batch can retry)", async () => {
    const store = new IdempotencyStore();
    const fn = vi
      .fn<[], Promise<{ ok: boolean }>>()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const first = await store.run("k1", fn, { cacheable: (v) => v.ok });
    const second = await store.run("k1", fn, { cacheable: (v) => v.ok });

    expect(first.value).toEqual({ ok: false });
    expect(second.value).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2); // failure was not cached → retried
  });

  it("does NOT cache when fn throws, and releases the key for retry", async () => {
    const store = new IdempotencyStore();
    const fn = vi
      .fn<[], Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    await expect(store.run("k1", fn)).rejects.toThrow("boom");
    const retry = await store.run("k1", fn);
    expect(retry.value).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("expires a completed entry after the TTL", async () => {
    const clock = fakeClock();
    const store = new IdempotencyStore({ ttlMs: 1000, maxEntries: 100 }, clock.now);
    const fn = vi.fn(async () => "v");

    await store.run("k1", fn);
    clock.advance(1500); // past TTL
    await store.run("k1", fn); // entry evicted → fn runs again
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("caps retained entries at maxEntries", async () => {
    const store = new IdempotencyStore({ ttlMs: 60_000, maxEntries: 3 });
    for (let i = 0; i < 10; i++) {
      await store.run(`k${i}`, async () => i);
    }
    expect(store.size()).toBeLessThanOrEqual(3);
  });
});
