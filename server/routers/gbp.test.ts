/**
 * Google Business Profile router — authorization + read-only surface.
 *
 * Uses the real appRouter with fabricated contexts so the adminProcedure
 * middleware runs exactly as in production. DB-dependent handlers are only
 * reached once authz passes (the DB is unavailable in tests, so they resolve to
 * safe empty/typed results — the point is that authz is enforced first).
 */
import "../testEnvSetup"; // MUST be first
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";
import { gbpRouter } from "./gbp";

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
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));

async function errorCode(fn: () => Promise<unknown>): Promise<string | "NO_ERROR"> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("gbp router — admin only", () => {
  it("blocks anonymous callers on every read", async () => {
    expect(await errorCode(() => asAnon().gbp.overview())).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().gbp.reviews({}))).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().gbp.insights({}))).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().gbp.posts({}))).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().gbp.getSyncStatus())).toBe("FORBIDDEN");
  });

  it("blocks non-admin members and viewers", async () => {
    expect(await errorCode(() => asMember().gbp.overview())).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().gbp.overview())).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().gbp.sync())).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().gbp.sync())).toBe("FORBIDDEN");
  });

  it("allows admins to read (degrades to empty without a DB, never FORBIDDEN)", async () => {
    const overview = await asAdmin().gbp.overview();
    expect(overview.connected).toBe(false);
    expect(overview.totalReviews).toBe(0);
    expect(Array.isArray(await asAdmin().gbp.reviews({}))).toBe(true);
    expect(Array.isArray(await asAdmin().gbp.insights({}))).toBe(true);
    const posts = await asAdmin().gbp.posts({});
    expect(Array.isArray(posts.posts)).toBe(true);
    expect(Array.isArray(posts.photos)).toBe(true);
  });

  it("admin sync resolves to a typed result without a DB (never throws)", async () => {
    const res = await asAdmin().gbp.sync();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(["no_db", "unconfigured"]).toContain(res.reason);
  });
});

describe("gbp router — read-only shape", () => {
  it("exposes exactly one mutation (sync); everything else is a query", () => {
    // tRPC records the procedure type on each def. The only write-shaped
    // procedure is `sync` (which refreshes the read cache, not Business Profile).
    const defs = (gbpRouter as unknown as { _def: { procedures: Record<string, { _def: { type: string } }> } })._def
      .procedures;
    const mutations = Object.entries(defs)
      .filter(([, p]) => p._def.type === "mutation")
      .map(([name]) => name);
    expect(mutations).toEqual(["sync"]);
  });
});
