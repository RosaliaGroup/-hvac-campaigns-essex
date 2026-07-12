/**
 * Admin authorization + read-only guarantees for quickbooks.previewFullHistory.
 * Uses the real appRouter + fabricated contexts so the middleware runs exactly
 * as in production.
 */
import "./testEnvSetup"; // MUST be first
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test", email: "t@e.com", loginMethod: "team",
    role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null,
    ...overrides,
  };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAnon = () => createCaller(makeCtx(null));
const asMember = () => createCaller(makeCtx(makeUser({ role: "user", teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (e) { return e instanceof TRPCError ? e.code : `NON_TRPC:${String(e)}`; }
}

describe("quickbooks.previewFullHistory — authorization", () => {
  it("rejects unauthenticated callers (adminProcedure → FORBIDDEN)", async () => {
    expect(await errorCode(() => asAnon().quickbooks.previewFullHistory())).toBe("FORBIDDEN");
  });

  it("rejects non-admin (member) callers with FORBIDDEN", async () => {
    expect(await errorCode(() => asMember().quickbooks.previewFullHistory())).toBe("FORBIDDEN");
  });

  it("admin passes authorization and the preview reports ZERO database writes", async () => {
    // No DATABASE_URL in tests → the planner returns its safe empty result
    // WITHOUT touching QuickBooks or writing anything. The point: authz passed
    // and the read-only contract holds (databaseWrites === 0).
    const res = (await asAdmin().quickbooks.previewFullHistory()) as { databaseWrites: number; cursorUnchanged: boolean };
    expect(res.databaseWrites).toBe(0);
    expect(res.cursorUnchanged).toBe(true);
  });
});
