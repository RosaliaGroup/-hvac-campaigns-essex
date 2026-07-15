/**
 * Authorization tests for the GA4 `analytics` router.
 *
 * Every analytics procedure is `adminProcedure` → admin-only for BOTH reads and
 * the manual sync. Non-admins (member / viewer / anon) must be rejected with
 * FORBIDDEN before any handler runs; admins pass and (with no DB / no property
 * configured in the test env) get the graceful empty result, never a throw.
 */
import "./testEnvSetup"; // MUST be first (stripe client constructs at import)
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1,
    openId: "team:1",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "team",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    videoInterests: null,
    ...overrides,
  };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return {
    req: { headers: {}, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}

const asAnon = () => createCaller(makeCtx(null));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));

async function errorCode(fn: () => Promise<unknown>): Promise<string | "NO_ERROR"> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

const prevProp = process.env.GA4_PROPERTY_ID;
const prevDb = process.env.DATABASE_URL;
beforeEach(() => {
  // Keep handlers offline: no property + no DB → provider degrades to empty.
  delete process.env.GA4_PROPERTY_ID;
  delete process.env.GA4_ANALYTICS_PROPERTY_ID;
  delete process.env.DATABASE_URL;
});
afterEach(() => {
  if (prevProp === undefined) delete process.env.GA4_PROPERTY_ID;
  else process.env.GA4_PROPERTY_ID = prevProp;
  if (prevDb === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDb;
});

describe("analytics router — non-admins are rejected (admin-only)", () => {
  const reads: Array<[string, (c: ReturnType<typeof asAnon>) => Promise<unknown>]> = [
    ["overview", (c) => c.analytics.overview({ range: "28d" })],
    ["traffic", (c) => c.analytics.traffic({ range: "28d" })],
    ["campaigns", (c) => c.analytics.campaigns({ range: "28d", limit: 5 })],
    ["landingPages", (c) => c.analytics.landingPages({ range: "28d", limit: 5 })],
    ["conversions", (c) => c.analytics.conversions({ range: "28d" })],
    ["topPages", (c) => c.analytics.topPages({ range: "28d", limit: 5 })],
    ["syncStatus", (c) => c.analytics.syncStatus()],
  ];

  it.each(reads)("blocks anon on %s with FORBIDDEN", async (_name, call) => {
    expect(await errorCode(() => call(asAnon()))).toBe("FORBIDDEN");
  });
  it.each(reads)("blocks viewer on %s with FORBIDDEN", async (_name, call) => {
    expect(await errorCode(() => call(asViewer()))).toBe("FORBIDDEN");
  });
  it.each(reads)("blocks member on %s with FORBIDDEN", async (_name, call) => {
    expect(await errorCode(() => call(asMember()))).toBe("FORBIDDEN");
  });

  it("blocks the manual sync mutation for non-admins", async () => {
    expect(await errorCode(() => asAnon().analytics.sync())).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().analytics.sync())).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().analytics.sync())).toBe("FORBIDDEN");
  });
});

describe("analytics router — admins pass (read-only, graceful)", () => {
  it("lets an admin read the overview (empty when unconfigured, no throw)", async () => {
    const o = await asAdmin().analytics.overview({ range: "28d" });
    expect(o).toMatchObject({ empty: true });
    expect(o.totals.sessions).toBe(0);
  });

  it("lets an admin read every list endpoint (all empty, no throw)", async () => {
    const c = asAdmin();
    expect(await c.analytics.traffic({ range: "28d" })).toEqual([]);
    expect(await c.analytics.campaigns({ range: "28d", limit: 5 })).toEqual([]);
    expect(await c.analytics.landingPages({ range: "28d", limit: 5 })).toEqual([]);
    expect(await c.analytics.conversions({ range: "28d" })).toEqual([]);
    expect(await c.analytics.topPages({ range: "28d", limit: 5 })).toEqual([]);
  });

  it("lets an admin trigger sync — returns a typed result (no_db), never throws", async () => {
    const res = await asAdmin().analytics.sync();
    expect(res).toMatchObject({ ok: false });
  });
});
