/**
 * Field work-order authorization tests (PR #39).
 * Drives the REAL appRouter with fabricated contexts so the auth middleware and
 * input validation run exactly as in production. The assigned-only *rule* is
 * unit-tested exhaustively in jobsLogic.test.ts (canAccessWorkOrder); here we
 * verify the middleware boundary: anonymous → UNAUTHORIZED, viewer mutation →
 * FORBIDDEN, bad status → BAD_REQUEST, and that authenticated members/admins are
 * allowed PAST auth (they then hit the DB, absent in unit env).
 */
import "./testEnvSetup"; // MUST be first (Stripe client constructs at import).
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test User", email: "test@example.com",
    loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    videoInterests: null, ...overrides,
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

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; }
  catch (err) { return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`; }
}

describe("work order authz — unauthenticated is rejected", () => {
  it("fieldWorkOrder query requires auth", async () => {
    expect(await errorCode(() => asAnon().jobs.fieldWorkOrder({ id: 1 }))).toBe("UNAUTHORIZED");
  });
  it("setTechnicianWorkStatus mutation requires auth", async () => {
    expect(await errorCode(() => asAnon().jobs.setTechnicianWorkStatus({ id: 1, status: "accepted" }))).toBe("UNAUTHORIZED");
  });
});

describe("work order authz — viewer is read-only", () => {
  it("blocks a viewer from mutating work status (FORBIDDEN before the handler)", async () => {
    expect(await errorCode(() => asViewer().jobs.setTechnicianWorkStatus({ id: 1, status: "accepted" }))).toBe("FORBIDDEN");
  });
});

describe("work order authz — input validation", () => {
  it("rejects an unknown work status with BAD_REQUEST (before any DB access)", async () => {
    // @ts-expect-error — intentionally invalid status to exercise zod validation
    expect(await errorCode(() => asMember().jobs.setTechnicianWorkStatus({ id: 1, status: "teleported" }))).toBe("BAD_REQUEST");
  });
});

describe("work order authz — authenticated staff pass the auth boundary", () => {
  // No DB in the unit env → handlers fail with INTERNAL_SERVER_ERROR, which
  // proves auth let them through (they were NOT blocked with UNAUTHORIZED/FORBIDDEN).
  it("a member reaches the fieldWorkOrder handler", async () => {
    const code = await errorCode(() => asMember().jobs.fieldWorkOrder({ id: 1 }));
    expect(code).not.toBe("UNAUTHORIZED");
    expect(code).not.toBe("FORBIDDEN");
  });
  it("an admin reaches the fieldWorkOrder handler", async () => {
    const code = await errorCode(() => asAdmin().jobs.fieldWorkOrder({ id: 1 }));
    expect(code).not.toBe("UNAUTHORIZED");
    expect(code).not.toBe("FORBIDDEN");
  });
  it("a member reaches the setTechnicianWorkStatus handler with a valid status", async () => {
    const code = await errorCode(() => asMember().jobs.setTechnicianWorkStatus({ id: 1, status: "accepted" }));
    expect(code).not.toBe("UNAUTHORIZED");
    expect(code).not.toBe("FORBIDDEN");
  });
});
