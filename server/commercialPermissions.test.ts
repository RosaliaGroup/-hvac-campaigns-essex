/**
 * Permission enforcement for the Commercial Opportunities namespace
 * (opportunities.commercial.*). Uses the real appRouter with fabricated
 * contexts so the exact production middleware chain runs. DATABASE_URL is unset
 * so DB-backed resolvers return null/throw INTERNAL_SERVER_ERROR — which lets us
 * distinguish "blocked by authz" (FORBIDDEN/UNAUTHORIZED) from "passed authz,
 * hit the DB stub" (INTERNAL_SERVER_ERROR / a returned empty result).
 */
import "./testEnvSetup";
import { beforeAll, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

beforeAll(() => {
  delete process.env.DATABASE_URL; // force getDb() → null (no real DB in unit tests)
});

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test User", email: "t@example.com", loginMethod: "team",
    role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null,
    ...overrides,
  };
}
const makeCtx = (user: AuthenticatedUser | null): TrpcContext => ({
  req: { headers: {} } as never,
  res: { cookie: () => {}, clearCookie: () => {} } as never,
  user,
});

const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));
const asAnon = () => createCaller(makeCtx(null));

async function code(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("commercial — unauthenticated", () => {
  it("rejects queries and mutations with UNAUTHORIZED", async () => {
    expect(await code(() => asAnon().opportunities.commercial.list())).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().opportunities.commercial.create({ title: "T", customerId: 1 }))).toBe("UNAUTHORIZED");
    // stages.create is adminProcedure — its gate returns FORBIDDEN for a non-admin
    // (including anon), by design, rather than distinguishing unauthenticated.
    expect(await code(() => asAnon().opportunities.commercial.stages.create({ stageKey: "x_y", name: "X" }))).toBe("FORBIDDEN");
  });
});

describe("commercial — viewer is read-only", () => {
  it("allows queries", async () => {
    expect(await code(() => asViewer().opportunities.commercial.list())).toBe("NO_ERROR");
    expect(await code(() => asViewer().opportunities.commercial.stages.list())).toBe("NO_ERROR");
  });
  it("blocks every mutation with FORBIDDEN", async () => {
    expect(await code(() => asViewer().opportunities.commercial.create({ title: "T", customerId: 1 }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().opportunities.commercial.transitionStage({ id: 1, toStageId: 1 }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().opportunities.commercial.comments.create({ opportunityId: 1, body: "hi" }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().opportunities.commercial.documents.create({ opportunityId: 1, category: "scope", url: "https://x.com/f" }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().opportunities.commercial.members.add({ opportunityId: 1, teamMemberId: 2 }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().opportunities.commercial.stages.create({ stageKey: "x_y", name: "X" }))).toBe("FORBIDDEN");
  });
});

describe("commercial — member", () => {
  it("passes the authz gate on create/transition/comment (reaches the DB stub, not FORBIDDEN)", async () => {
    // getDb() is null → INTERNAL_SERVER_ERROR proves the member cleared authz.
    expect(await code(() => asMember().opportunities.commercial.create({ title: "T", customerId: 1 }))).toBe("INTERNAL_SERVER_ERROR");
    expect(await code(() => asMember().opportunities.commercial.transitionStage({ id: 1, toStageId: 1 }))).toBe("INTERNAL_SERVER_ERROR");
    expect(await code(() => asMember().opportunities.commercial.comments.create({ opportunityId: 1, body: "hi" }))).toBe("INTERNAL_SERVER_ERROR");
  });
  it("is blocked from stage administration (admin only)", async () => {
    expect(await code(() => asMember().opportunities.commercial.stages.create({ stageKey: "x_y", name: "X" }))).toBe("FORBIDDEN");
    expect(await code(() => asMember().opportunities.commercial.stages.reorder({ orderedIds: [1, 2] }))).toBe("FORBIDDEN");
    expect(await code(() => asMember().opportunities.commercial.stages.remove({ id: 1 }))).toBe("FORBIDDEN");
  });
  it("can still read the stage list", async () => {
    expect(await code(() => asMember().opportunities.commercial.stages.list())).toBe("NO_ERROR");
  });
});

describe("commercial — admin", () => {
  it("passes the admin gate on stage administration (reaches DB stub, not FORBIDDEN)", async () => {
    expect(await code(() => asAdmin().opportunities.commercial.stages.create({ stageKey: "x_y", name: "X" }))).toBe("INTERNAL_SERVER_ERROR");
    expect(await code(() => asAdmin().opportunities.commercial.stages.remove({ id: 1 }))).toBe("INTERNAL_SERVER_ERROR");
  });
});
