import { describe, it, expect } from "vitest";
import {
  acquireDbLock,
  withDbLock,
  runAdvisoryLockSelfTest,
  type LockConnection,
  type DbLockLogEntry,
} from "./dbSyncLock";

/**
 * A fake MySQL that models GET_LOCK/RELEASE_LOCK the way the real server does:
 *   - named locks are shared across ALL connections (the "server");
 *   - a lock is owned by the ONE connection that acquired it;
 *   - RELEASE_LOCK from a non-owner returns 0 and does nothing;
 *   - closing/destroying a connection auto-releases the locks it held.
 * Failure injection lets us simulate NULL results, thrown queries, connect
 * failures, release failures, and connection death mid-operation.
 */
class FakeServer {
  held = new Map<string, FakeConn>(); // lockName -> owning connection
  connectCounter = 0;
}

interface FakeOpts {
  getLockReturnsNull?: boolean;
  getLockThrows?: boolean;
  releaseThrows?: boolean;
  endThrows?: boolean;
}

class FakeConn implements LockConnection {
  closed = false;
  errListeners: Array<(...a: unknown[]) => void> = [];
  readonly id: number;
  queries: string[] = [];
  constructor(private server: FakeServer, private opts: FakeOpts = {}) {
    this.id = ++server.connectCounter;
  }
  on(event: string, listener: (...a: unknown[]) => void) {
    if (event === "error") this.errListeners.push(listener);
  }
  /** Simulate the connection dying: MySQL auto-releases its locks. */
  die() {
    for (const [name, owner] of this.server.held) if (owner === this) this.server.held.delete(name);
    this.closed = true;
    this.errListeners.forEach(l => l(new Error("connection lost")));
  }
  async query(sql: string, values?: unknown[]): Promise<[unknown, unknown]> {
    this.queries.push(sql);
    if (this.closed) throw new Error("connection is closed");
    const name = (values?.[0] as string) ?? "";
    if (sql.includes("GET_LOCK")) {
      if (this.opts.getLockThrows) throw new Error("ER_LOCK_DEADLOCK");
      if (this.opts.getLockReturnsNull) return [[{ v: null }], undefined];
      const owner = this.server.held.get(name);
      if (owner && owner !== this) return [[{ v: 0 }], undefined]; // busy
      this.server.held.set(name, this);
      return [[{ v: 1 }], undefined];
    }
    if (sql.includes("RELEASE_LOCK")) {
      if (this.opts.releaseThrows) throw new Error("connection reset during release");
      const owner = this.server.held.get(name);
      if (owner === this) {
        this.server.held.delete(name);
        return [[{ v: 1 }], undefined];
      }
      return [[{ v: owner ? 0 : null }], undefined]; // not owner / didn't exist
    }
    return [[], undefined];
  }
  async end() {
    if (this.opts.endThrows) throw new Error("end failed");
    this.die();
  }
  destroy() {
    this.die();
  }
}

const factoryFor = (server: FakeServer, opts?: FakeOpts) => () => Promise.resolve(new FakeConn(server, opts) as LockConnection);
const NAME = "qbo_salesdoc_backfill";

describe("acquireDbLock — result mapping (1 / 0 / NULL)", () => {
  it("returns acquired on GET_LOCK=1 and hands back a live handle", async () => {
    const acq = await acquireDbLock(factoryFor(new FakeServer()), NAME);
    expect(acq.status).toBe("acquired");
    if (acq.status === "acquired") {
      expect(acq.handle.isAlive()).toBe(true);
      await acq.handle.release();
    }
  });

  it("returns busy on GET_LOCK=0 (already running) and closes the connection", async () => {
    const server = new FakeServer();
    const first = await acquireDbLock(factoryFor(server), NAME, { requestId: "A" });
    expect(first.status).toBe("acquired");
    const second = await acquireDbLock(factoryFor(server), NAME, { requestId: "B" });
    expect(second.status).toBe("busy"); // competing process refused
    if (first.status === "acquired") await first.handle.release();
  });

  it("returns error on GET_LOCK=NULL (database error) and aborts safely", async () => {
    const acq = await acquireDbLock(factoryFor(new FakeServer(), { getLockReturnsNull: true }), NAME);
    expect(acq.status).toBe("error");
    if (acq.status === "error") expect(acq.error.message).toMatch(/NULL/);
  });

  it("returns error when the GET_LOCK query throws", async () => {
    const acq = await acquireDbLock(factoryFor(new FakeServer(), { getLockThrows: true }), NAME);
    expect(acq.status).toBe("error");
  });

  it("returns error when the connection cannot be created", async () => {
    const acq = await acquireDbLock(() => Promise.reject(new Error("ECONNREFUSED")), NAME);
    expect(acq.status).toBe("error");
    if (acq.status === "error") expect(acq.error.message).toMatch(/ECONNREFUSED/);
  });
});

describe("competing processes — mutual exclusion across connections", () => {
  it("only one of two concurrent acquirers wins; the loser is busy", async () => {
    const server = new FakeServer();
    const [a, b] = await Promise.all([
      acquireDbLock(factoryFor(server), NAME, { requestId: "P1" }),
      acquireDbLock(factoryFor(server), NAME, { requestId: "P2" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["acquired", "busy"]);
    for (const r of [a, b]) if (r.status === "acquired") await r.handle.release();
  });

  it("a second acquirer succeeds only after the first releases", async () => {
    const server = new FakeServer();
    const a = await acquireDbLock(factoryFor(server), NAME);
    expect((await acquireDbLock(factoryFor(server), NAME)).status).toBe("busy");
    if (a.status === "acquired") await a.handle.release();
    const c = await acquireDbLock(factoryFor(server), NAME);
    expect(c.status).toBe("acquired");
    if (c.status === "acquired") await c.handle.release();
  });
});

describe("release — same connection owns and releases; others cannot", () => {
  it("release runs RELEASE_LOCK on the SAME connection that ran GET_LOCK, then closes it", async () => {
    const server = new FakeServer();
    let created: FakeConn | null = null;
    const factory = () => {
      created = new FakeConn(server);
      return Promise.resolve(created as LockConnection);
    };
    const acq = await acquireDbLock(factory, NAME);
    expect(acq.status).toBe("acquired");
    if (acq.status === "acquired") await acq.handle.release();
    expect(created!.queries.some(q => q.includes("GET_LOCK"))).toBe(true);
    expect(created!.queries.some(q => q.includes("RELEASE_LOCK"))).toBe(true);
    expect(created!.closed).toBe(true); // dedicated connection always closed
  });

  it("a pooled/other connection cannot release a lock it does not own", async () => {
    const server = new FakeServer();
    const owner = new FakeConn(server);
    const stranger = new FakeConn(server);
    // owner acquires
    await owner.query("SELECT GET_LOCK(?, 0) AS v", [NAME]);
    // stranger tries to release owner's lock -> 0, no-op
    const [rows] = await stranger.query("SELECT RELEASE_LOCK(?) AS v", [NAME]);
    expect((rows as Array<{ v: number | null }>)[0].v).toBe(0);
    expect(server.held.get(NAME)).toBe(owner); // still held by owner
  });
});

describe("withDbLock — busy / error / thrown / normal", () => {
  it("does NOT run fn when busy (no QBO work before the lock is held)", async () => {
    const server = new FakeServer();
    const holder = await acquireDbLock(factoryFor(server), NAME);
    let ran = false;
    const out = await withDbLock(
      factoryFor(server),
      NAME,
      async () => { ran = true; return "ran"; },
      reason => `refused:${reason}`,
    );
    expect(ran).toBe(false);
    expect(out).toBe("refused:busy");
    if (holder.status === "acquired") await holder.handle.release();
  });

  it("does NOT run fn on a DB error and reports the error reason", async () => {
    let ran = false;
    const out = await withDbLock(
      factoryFor(new FakeServer(), { getLockReturnsNull: true }),
      NAME,
      async () => { ran = true; return "ran"; },
      (reason, err) => `refused:${reason}:${err?.message ?? ""}`,
    );
    expect(ran).toBe(false);
    expect(out).toMatch(/^refused:error:/);
  });

  it("runs fn under the lock and releases afterwards (lock free for the next run)", async () => {
    const server = new FakeServer();
    const out = await withDbLock(factoryFor(server), NAME, async () => "did-work", () => "busy");
    expect(out).toBe("did-work");
    expect(server.held.has(NAME)).toBe(false); // released
    const next = await acquireDbLock(factoryFor(server), NAME);
    expect(next.status).toBe("acquired");
    if (next.status === "acquired") await next.handle.release();
  });

  it("releases the lock even when fn throws (a hung/aborted run cannot wedge it)", async () => {
    const server = new FakeServer();
    await expect(
      withDbLock(factoryFor(server), NAME, async () => { throw new Error("QBO timed out"); }, () => "busy"),
    ).rejects.toThrow("QBO timed out");
    expect(server.held.has(NAME)).toBe(false); // lock freed despite the throw
  });
});

describe("process crash / connection termination", () => {
  it("auto-releases the lock when the holding connection dies, and assertHeld then throws", async () => {
    const server = new FakeServer();
    let created: FakeConn | null = null;
    const factory = () => { created = new FakeConn(server); return Promise.resolve(created as LockConnection); };
    const acq = await acquireDbLock(factory, NAME);
    expect(acq.status).toBe("acquired");
    if (acq.status !== "acquired") return;

    expect(acq.handle.isAlive()).toBe(true);
    acq.handle.assertHeld(); // fine while alive

    created!.die(); // simulate crash / connection reset

    expect(server.held.has(NAME)).toBe(false); // MySQL auto-released
    expect(acq.handle.isAlive()).toBe(false);
    expect(() => acq.handle.assertHeld()).toThrow(/lost/); // sync must abort, not continue
  });

  it("a sync loop that checks assertHeld between pages exits with failure when the lock connection dies", async () => {
    const server = new FakeServer();
    let created: FakeConn | null = null;
    const factory = () => { created = new FakeConn(server); return Promise.resolve(created as LockConnection); };

    const result = await withDbLock(
      factory,
      NAME,
      async handle => {
        // page 1 ok
        handle.assertHeld();
        // connection dies before page 2
        created!.die();
        handle.assertHeld(); // throws
        return "should-not-reach";
      },
      () => "busy",
    ).then(
      v => ({ ok: true, v }),
      e => ({ ok: false, err: (e as Error).message }),
    );

    expect(result.ok).toBe(false); // exited with failure rather than continuing
  });
});

describe("release failures never throw and always close the connection", () => {
  it("logs release_failed but still closes when RELEASE_LOCK throws", async () => {
    const server = new FakeServer();
    let created: FakeConn | null = null;
    const factory = () => { created = new FakeConn(server, { releaseThrows: true }); return Promise.resolve(created as LockConnection); };
    const logs: DbLockLogEntry[] = [];
    const acq = await acquireDbLock(factory, NAME, { log: e => logs.push(e) });
    expect(acq.status).toBe("acquired");
    if (acq.status === "acquired") await expect(acq.handle.release()).resolves.toBeUndefined();
    expect(logs.some(l => l.event === "release_failed")).toBe(true);
    expect(created!.closed).toBe(true); // closed regardless (auto-releases the lock)
  });

  it("release is idempotent — a second call is a no-op", async () => {
    const acq = await acquireDbLock(factoryFor(new FakeServer()), NAME);
    if (acq.status === "acquired") {
      await acq.handle.release();
      await expect(acq.handle.release()).resolves.toBeUndefined();
    }
  });
});

describe("logging — request id + timing only, never credentials", () => {
  it("emits acquire_attempt/acquired/release with a stable requestId and ms, and no secret fields", async () => {
    const logs: DbLockLogEntry[] = [];
    let clock = 100;
    const acq = await acquireDbLock(factoryFor(new FakeServer()), NAME, {
      requestId: "req-xyz",
      now: () => (clock += 3),
      log: e => logs.push(e),
    });
    if (acq.status === "acquired") await acq.handle.release();

    expect(logs.map(l => l.event)).toEqual(["acquire_attempt", "acquired", "release"]);
    expect(logs.every(l => l.requestId === "req-xyz")).toBe(true);
    expect(logs.every(l => typeof l.ms === "number" && l.ms >= 0)).toBe(true);
    // No credential/URI/SQL-value leakage: only the known safe keys may appear.
    const allowed = new Set(["requestId", "lockName", "event", "ms", "ok", "error"]);
    for (const entry of logs) {
      for (const k of Object.keys(entry)) expect(allowed.has(k)).toBe(true);
      const blob = JSON.stringify(entry).toLowerCase();
      expect(blob).not.toContain("password");
      expect(blob).not.toContain("mysql://");
      expect(blob).not.toContain("@");
    }
  });
});

describe("runAdvisoryLockSelfTest — no-op cross-instance proof", () => {
  it("passes: A acquires, B refused, A releases, C acquires (distinct self-test lock)", async () => {
    const res = await runAdvisoryLockSelfTest(factoryFor(new FakeServer()));
    expect(res.ok).toBe(true);
    expect(res.lockName).toBe("qbo_salesdoc_selftest");
    expect(res.steps.map(s => `${s.step}=${s.actual}`)).toEqual([
      "connA acquire=acquired",
      "connB acquire while A holds=busy",
      "connC acquire after A released=acquired",
    ]);
  });

  it("fails loudly if the database does not enforce exclusion", async () => {
    // A broken server that never records holds -> B would wrongly acquire.
    const brokenFactory = () => Promise.resolve({
      query: async (sql: string) => (sql.includes("GET_LOCK") ? [[{ v: 1 }], undefined] : [[{ v: 1 }], undefined]) as [unknown, unknown],
      end: async () => {},
      destroy: () => {},
    } as LockConnection);
    const res = await runAdvisoryLockSelfTest(brokenFactory);
    expect(res.ok).toBe(false);
  });
});
