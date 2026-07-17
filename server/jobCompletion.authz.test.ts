/**
 * Job-completion workflow authorization tests (PR #41). Drives the real appRouter
 * with fabricated contexts so auth + input validation run as in production. The
 * fine-grained rules (time transitions, completion validation, field lock) are
 * unit-tested in shared/jobTime.test.ts + shared/jobCompletion.test.ts; here we
 * verify the boundary: anon → UNAUTHORIZED, viewer write → FORBIDDEN, admin-only
 * settings, bad input → BAD_REQUEST, and authenticated staff pass into handlers.
 */
import "./testEnvSetup";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: -1, openId: "team:1", name: "T", email: "t@e.com", loginMethod: "team", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAnon = () => createCaller(makeCtx(null));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));
async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (e) { return e instanceof TRPCError ? e.code : `NON_TRPC:${String(e)}`; }
}

describe("completion authz — unauthenticated rejected", () => {
  it("all completion endpoints require auth", async () => {
    expect(await code(() => asAnon().jobs.fieldAddTimeEvent({ jobId: 1, eventType: "work_start" }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldListTime({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldAddPart({ jobId: 1, description: "x", quantity: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldListParts({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldSaveSignature({ jobId: 1, dataUrl: "data:image/png;base64,AA==" }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldGetSignature({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.completeJob({ jobId: 1, noCompletionNote: true }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.jobCompletionSummary({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.getCompletionSettings())).toBe("UNAUTHORIZED");
  });
});

describe("completion authz — viewer is read-only", () => {
  it("blocks viewer writes across the workflow", async () => {
    expect(await code(() => asViewer().jobs.fieldAddTimeEvent({ jobId: 1, eventType: "work_start" }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().jobs.fieldAddPart({ jobId: 1, description: "x", quantity: 1 }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().jobs.fieldSaveSignature({ jobId: 1, dataUrl: "data:image/png;base64,AA==" }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().jobs.completeJob({ jobId: 1, noCompletionNote: true }))).toBe("FORBIDDEN");
  });
});

describe("completion authz — settings are admin-only (admin override surface)", () => {
  it("member cannot change the signature setting; admin can reach it", async () => {
    expect(await code(() => asMember().jobs.setCompletionSettings({ requireCompletionSignature: true }))).toBe("FORBIDDEN");
    const adminCode = await code(() => asAdmin().jobs.setCompletionSettings({ requireCompletionSignature: true }));
    expect(adminCode).not.toBe("UNAUTHORIZED");
    expect(adminCode).not.toBe("FORBIDDEN");
  });
});

describe("completion authz — input validation", () => {
  it("rejects an invalid time event type with BAD_REQUEST", async () => {
    // @ts-expect-error invalid event
    expect(await code(() => asMember().jobs.fieldAddTimeEvent({ jobId: 1, eventType: "teleport" }))).toBe("BAD_REQUEST");
  });
  it("rejects an empty part description", async () => {
    expect(await code(() => asMember().jobs.fieldAddPart({ jobId: 1, description: "", quantity: 1 }))).toBe("BAD_REQUEST");
  });
});

describe("completion authz — authenticated staff pass the boundary", () => {
  it("a member reaches the completion handlers (not blocked by authz)", async () => {
    for (const c of [
      () => asMember().jobs.fieldListTime({ jobId: 1 }),
      () => asMember().jobs.fieldListParts({ jobId: 1 }),
      () => asMember().jobs.fieldGetSignature({ jobId: 1 }),
      () => asMember().jobs.completeJob({ jobId: 1, noCompletionNote: true }),
      () => asMember().jobs.jobCompletionSummary({ jobId: 1 }),
    ]) {
      const c2 = await code(c);
      expect(c2).not.toBe("UNAUTHORIZED");
      expect(c2).not.toBe("FORBIDDEN");
    }
  });
});
