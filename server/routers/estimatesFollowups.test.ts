/**
 * Task 8B defect (a): approving or declining a tiered estimate must cancel the
 * opportunity's open close-loop follow-ups (email + text + call). cancelOpenFollowups
 * itself cancels every open/gated/snoozed task regardless of channel and logs a
 * timeline event, so asserting it is invoked with the opportunity id is sufficient.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any = null;
vi.mock("../db", () => ({ getDb: vi.fn(async () => currentDb) }));
// Keep the QBO push out of the unit test (approve calls it, best-effort).
vi.mock("../integrations/accounting/estimatePush", () => ({ pushApprovedEstimate: vi.fn(async () => ({ ok: true, qbId: "QBO-1" })) }));
// Spy on the loop-cancel; provide ensureFollowupsForOpportunity too (imported by salesDocSync via appRouter).
vi.mock("../integrations/accounting/followups", () => ({
  cancelOpenFollowups: vi.fn(async () => 3),
  ensureFollowupsForOpportunity: vi.fn(async () => 0),
}));

import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import { cancelOpenFollowups } from "../integrations/accounting/followups";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: -1, openId: "team:1", name: "Sales Sam", email: "s@example.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o } as AuthenticatedUser;
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const caller = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

function makeDb(data: Record<string, unknown[]>) {
  const rows = (t: unknown) => data[getTableName(t as never)] ?? [];
  const db: any = {
    select() {
      let tbl: unknown;
      const chain: any = {
        from: (t: unknown) => { tbl = t; return chain; },
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(rows(tbl)),
        then: (r: (v: unknown) => unknown) => Promise.resolve(rows(tbl)).then(r),
      };
      return chain;
    },
    insert() { return { values: () => ({ then: (r: (x: unknown) => unknown) => r([{ insertId: 1 }]) }) }; },
    update() { return { set: () => ({ where: () => Promise.resolve() }) }; },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return db;
}

const ESTIMATE = { id: 5, opportunityId: 77, estimateNumber: "ME-EST-2026-0009", status: "sent", approvedSnapshot: null, quickbooksEstimateId: null };
const OPTION = { id: 10, estimateId: 5, tier: "good", label: "Good", description: null, subtotal: "100.00", total: "100.00", rebateAmount: "0.00", warrantyTerms: null, maintenancePlan: null, isApproved: false, sortOrder: 0 };
const LINES = [{ id: 1, optionId: 10, name: "Labor", description: null, itemType: "labor", quantity: "1", unitPrice: "100.00", amount: "100.00", sortOrder: 0 }];

beforeEach(() => { vi.mocked(cancelOpenFollowups).mockClear(); });

describe("estimates.approve / .decline cancel the opportunity close loop (Task 8B)", () => {
  it("approve cancels the loop for the opportunity", async () => {
    currentDb = makeDb({ estimates: [ESTIMATE], estimateOptions: [OPTION], estimateLineItems: LINES });
    await caller().estimates.approve({ estimateId: 5, optionId: 10 });
    expect(cancelOpenFollowups).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cancelOpenFollowups).mock.calls[0][0]).toBe(77); // opportunityId
    expect(String(vi.mocked(cancelOpenFollowups).mock.calls[0][1])).toMatch(/approved/i);
  });

  it("decline cancels the loop for the opportunity", async () => {
    currentDb = makeDb({ estimates: [ESTIMATE], estimateOptions: [OPTION], estimateLineItems: LINES });
    await caller().estimates.decline({ estimateId: 5, reason: "went with another vendor" });
    expect(cancelOpenFollowups).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cancelOpenFollowups).mock.calls[0][0]).toBe(77);
    expect(String(vi.mocked(cancelOpenFollowups).mock.calls[0][1])).toMatch(/declined/i);
  });
});
