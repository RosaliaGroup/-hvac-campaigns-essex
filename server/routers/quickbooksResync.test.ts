/**
 * Authorization + linkage-guard tests for the customer-scoped QuickBooks resync
 * endpoint (quickbooks.resyncCustomerFromQuickBooks). Uses the real appRouter
 * with fabricated contexts so the admin middleware runs exactly as in prod.
 *
 * Covers:
 *   5. missing / invalid QuickBooks linkage is rejected (PRECONDITION_FAILED)
 *   6. non-admin users are rejected (FORBIDDEN) — before any DB/QBO work
 *   + confirmation is required (confirm:true) before execution
 *   + a linked customer routes to the customer-scoped sync with the right args
 */
import "../testEnvSetup"; // MUST be first (stripe key shim)
import { describe, expect, it, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { getDbMock, resyncSpy } = vi.hoisted(() => ({ getDbMock: vi.fn(), resyncSpy: vi.fn() }));
// Preserve every real export; swap only getDb and the customer-scoped sync.
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getDb: getDbMock }));
vi.mock("../integrations/accounting/salesDocSync", async importOriginal => ({
  ...(await importOriginal<typeof import("../integrations/accounting/salesDocSync")>()),
  syncSalesDocumentsForCustomer: resyncSpy,
}));

import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";
import { customers, properties } from "../../drizzle/schema";

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test User", email: "test@example.com", loginMethod: "team",
    role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...overrides,
  };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAdmin = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAnon = () => createCaller(makeCtx(null));

async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (err) { return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`; }
}

/** Minimal fake db: customers-table selects return `customerRow`, others empty. */
function makeDb(customerRow: Record<string, unknown> | null) {
  return {
    select: () => {
      let rows: unknown[] = [];
      const b = {
        from: (t: unknown) => { rows = t === customers ? (customerRow ? [customerRow] : []) : []; void properties; return b; },
        where: () => b,
        orderBy: () => b,
        limit: () => Promise.resolve(rows),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej),
      };
      return b;
    },
  };
}

beforeEach(() => {
  getDbMock.mockReset();
  resyncSpy.mockReset();
  resyncSpy.mockResolvedValue({ ok: true, pulled: 1, created: 1, updated: 0, skipped: 0, failed: 0, contactsCreated: 0, opportunitiesCreated: 1, followupsTriggered: 0, durationMs: 5, cursorAdvancedTo: null });
});

describe("quickbooks.resyncCustomerFromQuickBooks", () => {
  it("(6) rejects non-admin callers (FORBIDDEN) without touching DB or QBO", async () => {
    getDbMock.mockResolvedValue(makeDb({ id: 1, quickbooksCustomerId: "QB-9" }));
    expect(await code(() => asAnon().quickbooks.resyncCustomerFromQuickBooks({ customerId: 1, confirm: true }))).toBe("FORBIDDEN");
    expect(await code(() => asViewer().quickbooks.resyncCustomerFromQuickBooks({ customerId: 1, confirm: true }))).toBe("FORBIDDEN");
    expect(await code(() => asMember().quickbooks.resyncCustomerFromQuickBooks({ customerId: 1, confirm: true }))).toBe("FORBIDDEN");
    expect(resyncSpy).not.toHaveBeenCalled();
  });

  it("(5) rejects a customer with no QuickBooks linkage (PRECONDITION_FAILED)", async () => {
    getDbMock.mockResolvedValue(makeDb({ id: 2, quickbooksCustomerId: null }));
    expect(await code(() => asAdmin().quickbooks.resyncCustomerFromQuickBooks({ customerId: 2, confirm: true }))).toBe("PRECONDITION_FAILED");
    expect(resyncSpy).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation (confirm:true) — omitting it is a BAD_REQUEST", async () => {
    getDbMock.mockResolvedValue(makeDb({ id: 3, quickbooksCustomerId: "QB-9" }));
    // @ts-expect-error deliberately omit the required confirm flag
    expect(await code(() => asAdmin().quickbooks.resyncCustomerFromQuickBooks({ customerId: 3 }))).toBe("BAD_REQUEST");
    expect(resyncSpy).not.toHaveBeenCalled();
  });

  it("routes a linked customer to the customer-scoped sync with its QBO id", async () => {
    getDbMock.mockResolvedValue(makeDb({ id: 4, quickbooksCustomerId: "QB-9" }));
    const res = await asAdmin().quickbooks.resyncCustomerFromQuickBooks({ customerId: 4, confirm: true });
    expect(resyncSpy).toHaveBeenCalledWith("QB-9", { crmCustomerId: 4 });
    expect(res).toMatchObject({ ok: true, created: 1 });
  });
});
