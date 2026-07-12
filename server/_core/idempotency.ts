/**
 * Server-side idempotency guard for billed Anthropic calls.
 *
 * Purpose: the same batch must not be billed twice if the browser retries after
 * a network interruption. Each request carries a deterministic `batchId`
 * (Take-Off id + mode + page range + document checksum — computed client-side in
 * takeoffBatchCache.computeBatchId). This store keys on that id:
 *   - completed  → return the cached response, do NOT call Anthropic again.
 *   - in-flight  → coalesce onto the existing call rather than starting a second
 *                  (billed) one; both callers get the one result.
 *   - new        → run the call, cache only a SUCCESS.
 *
 * A failed call is not cached, so a genuine retry can still proceed. The store is
 * in-memory (single Railway instance; the retry window is seconds-to-minutes) —
 * no DB migration. The key is an opaque hash and never contains prompt or
 * document text, so nothing sensitive is retained here or in logs.
 */

export interface IdempotencyConfig {
  ttlMs: number;      // how long a completed result stays cached
  maxEntries: number; // hard cap on retained entries (oldest completed evicted first)
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  ttlMs: 30 * 60_000, // 30 minutes — well beyond any network-retry window
  maxEntries: 500,
};

type Entry<T> =
  | { state: "inflight"; promise: Promise<T> }
  | { state: "done"; value: T; completedAt: number };

export interface IdempotentOutcome<T> {
  value: T;
  cached: boolean;    // served from a prior COMPLETED run (no new Anthropic call)
  coalesced: boolean; // awaited an IN-FLIGHT run for the same id (no second call)
}

export class IdempotencyStore {
  private map = new Map<string, Entry<unknown>>();

  constructor(
    private cfg: IdempotencyConfig = DEFAULT_CONFIG,
    private now: () => number = () => Date.now(),
  ) {}

  private evict(): void {
    const t = this.now();
    // Map preserves insertion order, so entries() is oldest-first.
    const entries = Array.from(this.map.entries());
    for (const [k, e] of entries) {
      if (e.state === "done" && t - e.completedAt > this.cfg.ttlMs) this.map.delete(k);
    }
    if (this.map.size > this.cfg.maxEntries) {
      for (const [k, e] of entries) {
        if (this.map.size <= this.cfg.maxEntries) break;
        if (e.state === "done") this.map.delete(k);
      }
    }
  }

  /**
   * Run `fn` at most once per `key` while a result is cached / in flight.
   * `cacheable(value)` decides whether a completed value is retained (used to
   * cache successes only). Exceptions are never cached — the key is released so
   * a retry can re-run.
   */
  async run<T>(
    key: string,
    fn: () => Promise<T>,
    opts?: { cacheable?: (value: T) => boolean },
  ): Promise<IdempotentOutcome<T>> {
    this.evict();

    const existing = this.map.get(key) as Entry<T> | undefined;
    if (existing) {
      if (existing.state === "done") {
        return { value: existing.value, cached: true, coalesced: false };
      }
      const value = await existing.promise; // coalesce onto the in-flight call
      return { value, cached: false, coalesced: true };
    }

    const promise = fn();
    this.map.set(key, { state: "inflight", promise });
    try {
      const value = await promise;
      const keep = opts?.cacheable ? opts.cacheable(value) : true;
      if (keep) {
        this.map.set(key, { state: "done", value, completedAt: this.now() });
        this.evict(); // re-trim so the just-added entry can't exceed maxEntries
      } else {
        this.map.delete(key); // e.g. an error result — allow a retry to re-run
      }
      return { value, cached: false, coalesced: false };
    } catch (err) {
      this.map.delete(key); // release on throw so the batch can be retried
      throw err;
    }
  }

  /** Test/introspection helpers. */
  size(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
}

/** Shared store for the Take-Off analyzeBatch flow. */
export const takeoffIdempotency = new IdempotencyStore();
