/**
 * Opportunity Center backend — authorization boundary + write-safety invariants.
 *
 *  1. Every opportunity MUTATION enforces auth: anon → UNAUTHORIZED, viewer →
 *     FORBIDDEN (Phase-1 read-only), member/admin cross the boundary into the
 *     handler. Queries remain readable by viewers.
 *  2. Static guards on the router source: the new/hardened mutations that change
 *     material state do so transactionally (db.transaction) and write an audit
 *     event (insertEvent); nothing uses publicProcedure.
 *
 * SAFETY: this test drives real mutations. We hard-unset DATABASE_URL before the
 * router loads so getDb() returns null and NO write can reach a database.
 */
process.env.DATABASE_URL = ""; // must precede the router import (getDb gates on truthiness)
import "./testEnvSetup";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: 42, openId: "team:1", name: "T", email: "t@e.com", loginMethod: "team", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAnon = () => createCaller(makeCtx(null));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));
async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (e) { return e instanceof TRPCError ? e.code : `NON_TRPC:${String(e)}`; }
}

// Every mutation on the router, invoked with a minimal valid input.
const mutations = (caller: ReturnType<typeof createCaller>) => [
  () => caller.opportunities.create({ customerId: 1, title: "Manual deal" }),
  () => caller.opportunities.update({ id: 1, priority: "high" }),
  () => caller.opportunities.updateValue({ id: 1, opportunityValue: 100 }),
  () => caller.opportunities.setStage({ id: 1, stage: "pending" }),
  () => caller.opportunities.markWon({ id: 1 }),
  () => caller.opportunities.markLost({ id: 1 }),
  () => caller.opportunities.reorder({ stage: "new", orderedIds: [1, 2] }),
  () => caller.opportunities.assignSalesperson({ id: 1, assignedToId: 5 }),
  () => caller.opportunities.followUpLater({ id: 1, days: 3 }),
  () => caller.opportunities.convertToJob({ id: 1 }),
];

describe("opportunities — mutation authorization", () => {
  it("rejects anonymous callers with UNAUTHORIZED on every mutation", async () => {
    for (const call of mutations(asAnon())) expect(await code(call)).toBe("UNAUTHORIZED");
  });

  it("rejects viewers with FORBIDDEN on every mutation (Phase-1 read-only)", async () => {
    for (const call of mutations(asViewer())) expect(await code(call)).toBe("FORBIDDEN");
  });

  it("lets members and admins cross the authz boundary into the handler", async () => {
    for (const caller of [asMember(), asAdmin()]) {
      for (const call of mutations(caller)) {
        const c = await code(call);
        // No DB in the unit env → handler hits its own "Database unavailable"
        // guard, proving authz (and input validation) passed.
        expect(c).not.toBe("FORBIDDEN");
        expect(c).not.toBe("UNAUTHORIZED");
      }
    }
  });

  it("allows viewers to READ (queries are not write-gated)", async () => {
    for (const call of [
      () => asViewer().opportunities.list({}),
      () => asViewer().opportunities.overview(),
      () => asViewer().opportunities.stats(),
    ]) {
      const c = await code(call);
      expect(c).not.toBe("FORBIDDEN");
      expect(c).not.toBe("UNAUTHORIZED");
    }
    // …but anon cannot read either.
    expect(await code(() => asAnon().opportunities.list({}))).toBe("UNAUTHORIZED");
  });
});

describe("opportunities — write-safety static invariants", () => {
  const src = readFileSync("server/routers/opportunities.ts", "utf8");

  it("uses no publicProcedure (all endpoints require an authenticated user)", () => {
    expect(src).not.toContain("publicProcedure");
  });

  it("stage moves and reorder run inside a transaction", () => {
    // performStageMove + reorder both open db.transaction(...)
    expect((src.match(/db\.transaction\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("stage changes are audited (status_changed event written)", () => {
    expect(src).toContain('"status_changed"');
    expect(src).toContain("insertEvent");
  });

  it("guards stage/reorder writes with an affectedRows conflict check", () => {
    expect(src).toContain("affectedRows");
    expect(src).toContain('code: "CONFLICT"');
  });
});
