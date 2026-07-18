/**
 * conversationCrm router — link / quick-create / unlink (explicit user actions).
 * Fake db captures inserts/upserts/updates; no real DB.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any = null;
vi.mock("../db", () => ({ getDb: vi.fn(async () => currentDb) }));

import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: -1, openId: "team:1", name: "T", email: "t@example.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o } as AuthenticatedUser;
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const caller = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

function makeDb() {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const upserts: Array<{ table: string; values: Record<string, unknown>; set: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; set: Record<string, unknown> }> = [];
  const db = {
    inserts, upserts, updates,
    insert(t: unknown) {
      const table = getTableName(t as never);
      return {
        values(v: Record<string, unknown>) {
          inserts.push({ table, values: v });
          const result = [{ insertId: inserts.length }];
          return {
            onDuplicateKeyUpdate(arg: { set: Record<string, unknown> }) { upserts.push({ table, values: v, set: arg.set }); return Promise.resolve(result); },
            then: (r: (x: unknown) => unknown) => r(result),
          };
        },
      };
    },
    update(t: unknown) { const table = getTableName(t as never); return { set(s: Record<string, unknown>) { return { where() { updates.push({ table, set: s }); return Promise.resolve(); } }; } }; },
    select() { const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: () => Promise.resolve([]) }; return chain; },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

beforeEach(() => { currentDb = makeDb(); });

describe("conversationCrm.link", () => {
  it("confirms a customer link (upsert keyed by phoneLast10)", async () => {
    const r = await caller().conversationCrm.link({ phone: "+17189383793", target: "customer", id: 42 });
    expect(r).toEqual({ success: true });
    expect(currentDb.upserts[0].table).toBe("smsConversationLinks");
    expect(currentDb.upserts[0].values).toMatchObject({ phoneLast10: "7189383793", customerId: 42 });
  });
  it("links a lead into the leadId column (not customerId)", async () => {
    await caller().conversationCrm.link({ phone: "+17189383793", target: "lead", id: 7 });
    expect(currentDb.upserts[0].values).toMatchObject({ leadId: 7 });
    expect(currentDb.upserts[0].values.customerId).toBeUndefined();
  });
});

describe("conversationCrm.quickCreateLead", () => {
  it("creates a phone lead and auto-links it", async () => {
    const r = await caller().conversationCrm.quickCreateLead({ phone: "+17189383793", name: "Walk In" });
    expect(r.success).toBe(true);
    const leadInsert = currentDb.inserts.find((i: { table: string }) => i.table === "leads");
    expect(leadInsert.values).toMatchObject({ contact: "+17189383793", contactType: "phone", source: "sms" });
    expect(leadInsert.values.service).toBeTruthy(); // required notNull column
    expect(currentDb.upserts[0].values).toMatchObject({ phoneLast10: "7189383793", leadId: 1 });
  });
});

describe("conversationCrm.quickCreateCustomer", () => {
  it("creates a customer (+property when address given) and links", async () => {
    await caller().conversationCrm.quickCreateCustomer({ phone: "+17189383793", name: "Jane Doe", address: "1 Main St" });
    const custInsert = currentDb.inserts.find((i: { table: string }) => i.table === "customers");
    expect(custInsert.values).toMatchObject({ phone: "+17189383793", type: "residential", status: "active" });
    expect(currentDb.inserts.find((i: { table: string }) => i.table === "properties")).toBeTruthy();
    expect(currentDb.upserts[0].values.customerId).toBe(1);
  });
});

describe("conversationCrm.unlink", () => {
  it("clears all link fields", async () => {
    const r = await caller().conversationCrm.unlink({ phone: "+17189383793", target: "all" });
    expect(r).toEqual({ success: true });
    expect(currentDb.updates[0].table).toBe("smsConversationLinks");
    expect(currentDb.updates[0].set).toMatchObject({ customerId: null, leadId: null, leadCaptureId: null, propertyId: null });
  });
  it("rejects an unparseable phone", async () => {
    await expect(caller().conversationCrm.link({ phone: "abc", target: "customer", id: 1 })).rejects.toThrow();
  });
});
