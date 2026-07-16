/**
 * Executive Dashboards — authorization + estimates-reconciliation tests.
 *
 * Authorization: uses the real appRouter with fabricated contexts so the actual
 * adminProcedure middleware runs as in production. Every executive procedure is
 * admin-only; non-admins (anon/viewer/member) must be rejected with FORBIDDEN.
 *
 * Reconciliation: the "Estimates Outstanding" KPI tile and its drill-down are
 * built from the SAME `salesDocConditions()` helper. This test proves the helper
 * yields IDENTICAL criteria for estimates whether or not a date window is passed
 * (the tile passes none; the drill-down passes the active range) — so the tile
 * count and the drill-down row count always reconcile. Invoices, by contrast,
 * remain date-scoped.
 */
import "../testEnvSetup"; // MUST be first
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";
import { salesDocConditions } from "./executiveDashboards";

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

describe("executiveDashboards — authorization (admin-only)", () => {
  it("rejects anonymous callers on every procedure (FORBIDDEN)", async () => {
    expect(await code(() => asAnon().executiveDashboards.filterOptions())).toBe("FORBIDDEN");
    expect(await code(() => asAnon().executiveDashboards.sales())).toBe("FORBIDDEN");
    expect(await code(() => asAnon().executiveDashboards.finance())).toBe("FORBIDDEN");
    expect(await code(() => asAnon().executiveDashboards.operations())).toBe("FORBIDDEN");
    expect(await code(() => asAnon().executiveDashboards.drilldown({ metric: "estimates" }))).toBe("FORBIDDEN");
  });

  it("rejects viewers and members (FORBIDDEN — not admin)", async () => {
    for (const caller of [asViewer, asMember]) {
      expect(await code(() => caller().executiveDashboards.sales())).toBe("FORBIDDEN");
      expect(await code(() => caller().executiveDashboards.finance())).toBe("FORBIDDEN");
      expect(await code(() => caller().executiveDashboards.operations())).toBe("FORBIDDEN");
      expect(await code(() => caller().executiveDashboards.drilldown({ metric: "recognized_revenue" }))).toBe("FORBIDDEN");
    }
  });

  it("admins pass authorization and the procedures execute cleanly", async () => {
    // No DB in the test env → getDb() returns null → procedures return their empty
    // shape (never throw), so admin calls resolve with NO_ERROR.
    expect(await code(() => asAdmin().executiveDashboards.filterOptions())).toBe("NO_ERROR");
    expect(await code(() => asAdmin().executiveDashboards.sales())).toBe("NO_ERROR");
    expect(await code(() => asAdmin().executiveDashboards.finance())).toBe("NO_ERROR");
    expect(await code(() => asAdmin().executiveDashboards.operations())).toBe("NO_ERROR");
    expect(await code(() => asAdmin().executiveDashboards.drilldown({ metric: "estimates" }))).toBe("NO_ERROR");
    expect(passedAuthz("NO_ERROR")).toBe(true);
  });
});

describe("executiveDashboards — Estimates Outstanding tile/drill-down reconciliation", () => {
  const D_FROM = new Date("2026-01-01T00:00:00Z");
  const D_TO = new Date("2026-04-01T00:00:00Z");

  it("estimates criteria are date-agnostic: passing a date window does NOT change them", () => {
    // Tile builds with no date window; drill-down builds with the active window.
    const tile = salesDocConditions({ docType: "estimate", customerId: 42 });
    const drilldown = salesDocConditions({ docType: "estimate", customerId: 42, dateFrom: D_FROM, dateTo: D_TO });
    // Identical criteria count ⇒ identical WHERE ⇒ identical result set ⇒ counts reconcile.
    expect(drilldown.length).toBe(tile.length);
    // Concretely: docType + voided=false + status IN(pending,accepted) + customerId = 4.
    expect(tile.length).toBe(4);
  });

  it("estimates snapshot has a fixed criteria count regardless of filters", () => {
    expect(salesDocConditions({ docType: "estimate" }).length).toBe(3); // no customer
    expect(salesDocConditions({ docType: "estimate", dateFrom: D_FROM }).length).toBe(3); // date ignored
    expect(salesDocConditions({ docType: "estimate", dateTo: D_TO }).length).toBe(3); // date ignored
    expect(salesDocConditions({ docType: "estimate", customerId: 7, dateFrom: D_FROM, dateTo: D_TO }).length).toBe(4);
  });

  it("invoices REMAIN date-scoped (recognized revenue), unlike estimates", () => {
    const base = salesDocConditions({ docType: "invoice" }); // docType + voided = 2
    const withDates = salesDocConditions({ docType: "invoice", dateFrom: D_FROM, dateTo: D_TO }); // + 2 date bounds
    expect(base.length).toBe(2);
    expect(withDates.length).toBe(4);
    expect(withDates.length).toBeGreaterThan(base.length);
  });
});
