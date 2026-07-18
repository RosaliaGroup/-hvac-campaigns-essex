/**
 * Notes + Job Photos authorization tests (PR #40). Drives the real appRouter
 * with fabricated contexts so the auth middleware + zod validation run as in
 * production. The fine-grained edit rule (canEditNote) and image validation
 * (validatePhotoUpload) are unit-tested in shared/jobMedia.test.ts; here we
 * verify the boundary: anon → UNAUTHORIZED, viewer write → FORBIDDEN, invalid
 * input → BAD_REQUEST, and authenticated staff pass into the handler (where the
 * unit env has no DB → INTERNAL_SERVER_ERROR, i.e. NOT blocked by authz).
 */
import "./testEnvSetup";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test", email: "t@e.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o,
  };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAnon = () => createCaller(makeCtx(null));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (e) { return e instanceof TRPCError ? e.code : `NON_TRPC:${String(e)}`; }
}
const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

describe("notes/photos authz — unauthenticated rejected (prevents URL guessing)", () => {
  it("every field media endpoint requires auth", async () => {
    expect(await code(() => asAnon().jobs.fieldAddNote({ jobId: 1, body: "x", visibility: "internal" }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldUpdateNote({ id: 1, body: "x" }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldListNotes({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldAddPhoto({ jobId: 1, category: "before", fileName: "a.jpg", dataUrl: JPG }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldListPhotos({ jobId: 1 }))).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().jobs.fieldGetPhoto({ id: 1 }))).toBe("UNAUTHORIZED");
  });
});

describe("notes/photos authz — viewer is read-only", () => {
  it("blocks a viewer from creating notes or uploading photos", async () => {
    expect(await code(() => asViewer().jobs.fieldAddNote({ jobId: 1, body: "x", visibility: "internal" }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().jobs.fieldAddPhoto({ jobId: 1, category: "after", fileName: "a.jpg", dataUrl: JPG }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().jobs.fieldUpdateNote({ id: 1, body: "x" }))).toBe("FORBIDDEN");
  });
});

describe("notes/photos authz — input validation", () => {
  it("rejects an unknown note visibility and photo category with BAD_REQUEST", async () => {
    // @ts-expect-error invalid visibility
    expect(await code(() => asMember().jobs.fieldAddNote({ jobId: 1, body: "x", visibility: "public" }))).toBe("BAD_REQUEST");
    // @ts-expect-error invalid category
    expect(await code(() => asMember().jobs.fieldAddPhoto({ jobId: 1, category: "sideways", fileName: "a.jpg", dataUrl: JPG }))).toBe("BAD_REQUEST");
  });
  it("rejects an empty note body", async () => {
    expect(await code(() => asMember().jobs.fieldAddNote({ jobId: 1, body: "", visibility: "internal" }))).toBe("BAD_REQUEST");
  });
});

describe("notes/photos authz — authenticated staff pass the boundary", () => {
  it("a member reaches the handlers (not blocked by authz)", async () => {
    for (const c of [
      () => asMember().jobs.fieldListNotes({ jobId: 1 }),
      () => asMember().jobs.fieldListPhotos({ jobId: 1 }),
      () => asMember().jobs.fieldGetPhoto({ id: 1 }),
      () => asMember().jobs.fieldAddNote({ jobId: 1, body: "hello", visibility: "customer" }),
      () => asMember().jobs.fieldAddPhoto({ jobId: 1, category: "general", fileName: "a.jpg", dataUrl: JPG }),
    ]) {
      const c2 = await code(c);
      expect(c2).not.toBe("UNAUTHORIZED");
      expect(c2).not.toBe("FORBIDDEN");
    }
  });
});
