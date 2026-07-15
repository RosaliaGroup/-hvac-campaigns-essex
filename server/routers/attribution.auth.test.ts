/**
 * Authorization + safety-boundary tests for the attribution router.
 * Uses the real appRouter with fabricated contexts so middleware runs as in prod.
 * Reads are member-level; every write and the match workflow are admin-only.
 */
import "../testEnvSetup"; // MUST be first
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

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
    req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}

const asAdmin = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAnon = () => createCaller(makeCtx(null));

async function code(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}
const passedAuthz = (c: string) => c !== "UNAUTHORIZED" && c !== "FORBIDDEN";

describe("attribution router — read authorization", () => {
  it("anonymous callers are rejected from reads (UNAUTHORIZED)", async () => {
    expect(await code(() => asAnon().attribution.getOverview())).toBe("UNAUTHORIZED");
    expect(await code(() => asAnon().attribution.getBySource())).toBe("UNAUTHORIZED");
  });

  it("an authenticated member may read reports (passes authz)", async () => {
    // No DB in unit env → handler throws INTERNAL; the point is it is NOT blocked by authz.
    expect(passedAuthz(await code(() => asMember().attribution.getByLandingPage()))).toBe(true);
    expect(passedAuthz(await code(() => asMember().attribution.getFunnel()))).toBe(true);
  });
});

describe("attribution router — write/admin authorization", () => {
  const link = () => ({ opportunityId: 1, leadCaptureId: 1 });

  it("anonymous → blocked on every write (admin gate throws FORBIDDEN)", async () => {
    // adminProcedure checks role directly, so a missing user is FORBIDDEN (not UNAUTHORIZED).
    expect(await code(() => asAnon().attribution.linkOpportunityToLeadCapture(link()))).toBe("FORBIDDEN");
    expect(await code(() => asAnon().attribution.unlinkOpportunityAttribution({ opportunityId: 1 }))).toBe("FORBIDDEN");
  });

  it("viewer → FORBIDDEN on writes", async () => {
    expect(await code(() => asViewer().attribution.linkOpportunityToLeadCapture(link()))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().attribution.unlinkOpportunityAttribution({ opportunityId: 1 }))).toBe("FORBIDDEN");
  });

  it("non-admin member → FORBIDDEN on writes AND on the admin match workflow", async () => {
    expect(await code(() => asMember().attribution.linkOpportunityToLeadCapture(link()))).toBe("FORBIDDEN");
    expect(await code(() => asMember().attribution.unlinkOpportunityAttribution({ opportunityId: 1 }))).toBe("FORBIDDEN");
    expect(await code(() => asMember().attribution.getSuggestedMatches())).toBe("FORBIDDEN");
    expect(await code(() => asMember().attribution.recalculateDryRun())).toBe("FORBIDDEN");
  });

  it("admin passes authz on writes and the match workflow (reaches handler)", async () => {
    expect(passedAuthz(await code(() => asAdmin().attribution.linkOpportunityToLeadCapture(link())))).toBe(true);
    expect(passedAuthz(await code(() => asAdmin().attribution.unlinkOpportunityAttribution({ opportunityId: 1 })))).toBe(true);
    expect(passedAuthz(await code(() => asAdmin().attribution.getSuggestedMatches()))).toBe(true);
    expect(passedAuthz(await code(() => asAdmin().attribution.recalculateDryRun()))).toBe(true);
  });
});

describe("attribution router — QuickBooks & SEO remain read-only (static guard)", () => {
  const src = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "attribution.ts"),
    "utf8",
  );

  it("never writes seoPages or quickbooksSalesDocuments", () => {
    for (const table of ["seoPages", "quickbooksSalesDocuments"]) {
      for (const op of ["insert", "update", "delete"]) {
        expect(src.includes(`${op}(${table}`)).toBe(false);
      }
    }
  });

  it("the only table mutated is opportunities (sourceLeadCaptureId link/unlink)", () => {
    const updateTargets = Array.from(src.matchAll(/db\.update\((\w+)\)/g)).map(m => m[1]);
    expect(new Set(updateTargets)).toEqual(new Set(["opportunities"]));
    expect(src.includes("db.insert(")).toBe(false);
    expect(src.includes("db.delete(")).toBe(false);
  });
});
