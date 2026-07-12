/**
 * In-process mutual exclusion for QuickBooks sales-doc syncs (pure, unit-tested).
 *
 * A backfill reprocesses the whole window and must never run concurrently with
 * another backfill/sync — overlapping runs waste QBO calls and can double-log
 * conflicts. The service runs a single replica, so an in-process lock is
 * sufficient; `staleAfterMs` guarantees a crashed/aborted holder can't wedge the
 * lock forever (matching the fetch timeout, a real run always finishes or throws
 * and releases via `withSyncLock`'s finally).
 *
 * For a future multi-replica deployment this should be backed by a DB advisory
 * lock; the interface here is deliberately swappable.
 */

export interface SyncLockState {
  heldBy: string | null;
  since: number | null;
}

export class SyncLock {
  private heldBy: string | null = null;
  private since: number | null = null;
  constructor(
    private readonly staleAfterMs = 5 * 60 * 1000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Acquire if free (or the prior holder is stale). Returns false if busy. */
  tryAcquire(owner: string): boolean {
    const t = this.now();
    if (this.heldBy && this.since != null && t - this.since < this.staleAfterMs) {
      return false;
    }
    this.heldBy = owner;
    this.since = t;
    return true;
  }

  release(owner: string): void {
    // Only the current holder may release (a stale-takeover owns it now).
    if (this.heldBy === owner) {
      this.heldBy = null;
      this.since = null;
    }
  }

  state(): SyncLockState {
    return { heldBy: this.heldBy, since: this.since };
  }
}

/**
 * Run `fn` under the lock. If the lock is busy, `fn` is NOT run and
 * `onBusy` is returned instead. The lock is always released — even if `fn`
 * throws or its awaited work times out — so a hung/aborted run cannot wedge it.
 */
export async function withSyncLock<T>(
  lock: SyncLock,
  owner: string,
  fn: () => Promise<T>,
  onBusy: () => T,
): Promise<T> {
  if (!lock.tryAcquire(owner)) {
    return onBusy();
  }
  try {
    return await fn();
  } finally {
    lock.release(owner);
  }
}
