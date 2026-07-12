/**
 * Cross-instance advisory lock for QuickBooks sales-doc syncs, backed by
 * MySQL `GET_LOCK` / `RELEASE_LOCK` (pure, unit-tested; all I/O injected).
 *
 * WHY a DB lock and not just the in-process SyncLock:
 *   An in-memory lock only guards a single Node process. Railway runs a fresh
 *   process on every restart, and during a rolling deploy the OLD and NEW
 *   instances are briefly alive at the same time — so two backfills can run
 *   concurrently across processes. A MySQL advisory lock is enforced by the
 *   database across ALL connections/instances, and MySQL auto-releases it if
 *   the holding connection dies (crash-safe).
 *
 * CONTRACT (matches the approved spec):
 *   - `GET_LOCK(name, 0)` runs on a DEDICATED connection that is held for the
 *     entire operation and never returned to a pool.
 *   - Result mapping:  1 = acquired · 0 = already running (busy) · NULL = DB
 *     error (abort safely).
 *   - `RELEASE_LOCK` always runs in a `finally`, and the dedicated connection is
 *     ALWAYS closed afterwards (a closed connection also auto-releases the lock).
 *   - Only the session that holds a lock can release it — a pooled/other
 *     connection calling RELEASE_LOCK gets 0 and does nothing (MySQL semantics),
 *     so a stray connection can never free another session's lock.
 *   - Every acquire/release is logged with a request id + timing only. No SQL
 *     values, URIs, or credentials are ever logged.
 */

/** Minimal surface of a mysql2/promise connection that we depend on. */
export interface LockConnection {
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
  destroy(): void;
  on?(event: string, listener: (...args: unknown[]) => void): void;
}

export type LockConnectionFactory = () => Promise<LockConnection>;

export type DbLockEvent =
  | "acquire_attempt"
  | "acquired"
  | "busy"
  | "db_error"
  | "release"
  | "release_failed"
  | "close_failed";

export interface DbLockLogEntry {
  requestId: string;
  lockName: string;
  event: DbLockEvent;
  ms: number;
  ok?: boolean;
  error?: string;
}

export interface DbLockHandle {
  /** True while the dedicated connection is believed alive and still holding. */
  isAlive(): boolean;
  /** Throws if the lock connection was lost — callers check this between QBO pages. */
  assertHeld(): void;
  /** RELEASE_LOCK (best-effort) then ALWAYS close the connection. Idempotent. */
  release(): Promise<void>;
}

export type AcquireResult =
  | { status: "acquired"; handle: DbLockHandle }
  | { status: "busy" }
  | { status: "error"; error: Error };

export interface DbLockOptions {
  requestId?: string;
  now?: () => number;
  log?: (entry: DbLockLogEntry) => void;
}

let idCounter = 0;
function defaultRequestId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `lock-${idCounter.toString(36)}`;
}

/** Pull the scalar `v` out of a `SELECT ... AS v` result across driver shapes. */
function extractV(rows: unknown): number | null {
  const first = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>)[0] : undefined;
  const v = first ? first.v : undefined;
  if (v === null || v === undefined) return null;
  return Number(v);
}

/** Close a connection without ever throwing (end, then destroy as a fallback). */
async function safeClose(conn: LockConnection, log: (e: DbLockLogEntry) => void, ctx: Omit<DbLockLogEntry, "event" | "ms">): Promise<void> {
  try {
    await conn.end();
  } catch (e) {
    try {
      conn.destroy();
    } catch {
      /* ignore */
    }
    log({ ...ctx, event: "close_failed", ms: 0, error: (e as Error).message });
  }
}

/**
 * Acquire the advisory lock on a fresh dedicated connection.
 *
 * On "acquired" the returned handle OWNS the connection and must be released.
 * On "busy" / "error" the connection is already closed for you.
 */
export async function acquireDbLock(
  connect: LockConnectionFactory,
  lockName: string,
  options: DbLockOptions = {},
): Promise<AcquireResult> {
  const now = options.now ?? (() => Date.now());
  const log = options.log ?? (() => {});
  const requestId = options.requestId ?? defaultRequestId();
  const base = { requestId, lockName };
  const t0 = now();

  log({ ...base, event: "acquire_attempt", ms: 0 });

  let conn: LockConnection;
  try {
    conn = await connect();
  } catch (e) {
    const error = e as Error;
    log({ ...base, event: "db_error", ms: now() - t0, error: error.message });
    return { status: "error", error };
  }

  // If the dedicated connection later errors, MySQL auto-releases the lock; we
  // flip `alive` so the sync can detect it and abort instead of running on.
  let alive = true;
  conn.on?.("error", () => {
    alive = false;
  });

  let value: number | null;
  try {
    const [rows] = await conn.query("SELECT GET_LOCK(?, 0) AS v", [lockName]);
    value = extractV(rows);
  } catch (e) {
    const error = e as Error;
    log({ ...base, event: "db_error", ms: now() - t0, error: error.message });
    await safeClose(conn, log, base);
    return { status: "error", error };
  }

  if (value === 0) {
    log({ ...base, event: "busy", ms: now() - t0 });
    await safeClose(conn, log, base);
    return { status: "busy" };
  }

  if (value !== 1) {
    // NULL (or any non-1/0) => treat as a database error and abort safely.
    log({ ...base, event: "db_error", ms: now() - t0, error: `GET_LOCK returned ${value === null ? "NULL" : value}` });
    await safeClose(conn, log, base);
    return { status: "error", error: new Error(`GET_LOCK('${lockName}') returned ${value === null ? "NULL" : value}`) };
  }

  log({ ...base, event: "acquired", ms: now() - t0, ok: true });

  let released = false;
  const handle: DbLockHandle = {
    isAlive: () => alive,
    assertHeld() {
      if (!alive) throw new Error(`advisory lock connection for '${lockName}' was lost — aborting sync`);
    },
    async release() {
      if (released) return;
      released = true;
      const rt0 = now();
      try {
        const [rows] = await conn.query("SELECT RELEASE_LOCK(?) AS v", [lockName]);
        const rv = extractV(rows);
        if (rv === 1) {
          log({ ...base, event: "release", ms: now() - rt0, ok: true });
        } else {
          // 0 = not owned by this session, NULL = didn't exist. The connection
          // close below still guarantees the lock is gone; we just record it.
          log({ ...base, event: "release_failed", ms: now() - rt0, ok: false, error: `RELEASE_LOCK returned ${rv === null ? "NULL" : rv}` });
        }
      } catch (e) {
        log({ ...base, event: "release_failed", ms: now() - rt0, error: (e as Error).message });
      } finally {
        await safeClose(conn, log, base);
      }
    },
  };

  return { status: "acquired", handle };
}

/**
 * Run `run` while holding the advisory lock. If the lock is busy or the DB
 * errors, `onUnavailable` is invoked instead (the connection is already closed)
 * and `run` NEVER executes — so no QBO calls can begin before the lock is held.
 * The lock is always released (and its connection closed) in `finally`.
 */
export async function withDbLock<T>(
  connect: LockConnectionFactory,
  lockName: string,
  run: (handle: DbLockHandle) => Promise<T>,
  onUnavailable: (reason: "busy" | "error", error?: Error) => T | Promise<T>,
  options: DbLockOptions = {},
): Promise<T> {
  const acq = await acquireDbLock(connect, lockName, options);
  if (acq.status === "busy") return onUnavailable("busy");
  if (acq.status === "error") return onUnavailable("error", acq.error);
  try {
    return await run(acq.handle);
  } finally {
    await acq.handle.release();
  }
}

export interface SelfTestStep {
  step: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface SelfTestResult {
  ok: boolean;
  lockName: string;
  steps: SelfTestStep[];
}

/**
 * No-op cross-instance verification (touches NO application data). Uses a
 * DISTINCT lock name so it can never block a real sync. Proves, on the live
 * database, that: (a) a second independent connection is refused while the
 * first holds the lock, and (b) the lock frees after release. This is the
 * pre-deploy self-test to run in Railway.
 */
export async function runAdvisoryLockSelfTest(
  connect: LockConnectionFactory,
  options: DbLockOptions = {},
): Promise<SelfTestResult> {
  const lockName = "qbo_salesdoc_selftest";
  const steps: SelfTestStep[] = [];
  const record = (step: string, expected: string, actual: string) =>
    steps.push({ step, expected, actual, pass: expected === actual });

  const a = await acquireDbLock(connect, lockName, { ...options, requestId: `${options.requestId ?? "selftest"}-A` });
  record("connA acquire", "acquired", a.status);

  if (a.status === "acquired") {
    const b = await acquireDbLock(connect, lockName, { ...options, requestId: `${options.requestId ?? "selftest"}-B` });
    record("connB acquire while A holds", "busy", b.status);
    if (b.status === "acquired") await b.handle.release(); // safety: don't leak

    await a.handle.release();

    const c = await acquireDbLock(connect, lockName, { ...options, requestId: `${options.requestId ?? "selftest"}-C` });
    record("connC acquire after A released", "acquired", c.status);
    if (c.status === "acquired") await c.handle.release();
  }

  return { ok: steps.every(s => s.pass), lockName, steps };
}
