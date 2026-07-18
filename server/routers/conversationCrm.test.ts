/**
 * conversationCrm router — link / integrity / dedup / audit (Phase-2 hardening).
 * Table-aware fake db (returns rows per drizzle table name); captures writes.
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
  return { id: -1, openId: "team:1", name: "Dispatcher Dana", email: "d@example.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o } as AuthenticatedUser;
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const caller = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

function makeDb(data: Record<string, unknown[]> = {}) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const upserts: Array<{ table: string; values: Record<string, unknown>; set: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; set: Record<string, unknown> }> = [];
  const rows = (t: unknown) => data[getTableName(t as never)] ?? [];
  const db = {
    inserts, upserts, updates,
    select() {
      let tbl: unknown;
      const chain = { from: (t: unknown) => { tbl = t; return chain; }, where: () => chain, orderBy: () => chain, limit: () => Promise.resolve(rows(tbl)), then: (r: (v: unknown) => unknown) => Promise.resolve(rows(tbl)).then(r) };
      return chain;
    },
    insert(t: unknown) {
      const table = getTableName(t as never);
      return { values(v: Record<string, unknown>) { inserts.push({ table, values: v }); const result = [{ insertId: inserts.length }];
        return { onDuplicateKeyUpdate(a: { set: Record<string, unknown> }) { upserts.push({ table, values: v, set: a.set }); return Promise.resolve(result); }, then: (r: (x: unknown) => unknown) => r(result) }; } };
    },
    update(t: unknown) { const table = getTableName(t as never); return { set(s: Record<string, unknown>) { return { where() { updates.push({ table, set: s }); return Promise.resolve(); } }; } }; },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

const PHONE = "+17189383793";
beforeEach(() => { currentDb = makeDb(); });

describe("link — existence validation + audit", () => {
  it("links a customer that exists, recording the authenticated actor", async () => {
    currentDb = makeDb({ customers: [{ id: 42 }] });
    const r = await caller().conversationCrm.link({ phone: PHONE, target: "customer", id: 42 });
    expect(r).toEqual({ success: true });
    const up = currentDb.upserts[0];
    expect(up.table).toBe("smsConversationLinks");
    expect(up.values).toMatchObject({ phoneLast10: "7189383793", customerId: 42 });
    expect(up.values.createdBy).toBe("Dispatcher Dana"); // audit from ctx, not client
    expect(up.set.updatedBy).toBe("Dispatcher Dana");
  });
  it("rejects linking a customer that does not exist (server-side id validation)", async () => {
    currentDb = makeDb({ customers: [] });
    await expect(caller().conversationCrm.link({ phone: PHONE, target: "customer", id: 999 })).rejects.toThrow(/not found/i);
  });
});

describe("selectProperty — cross-entity integrity", () => {
  it("rejects a property that does not belong to the linked customer", async () => {
    currentDb = makeDb({ smsConversationLinks: [{ customerId: 5 }], properties: [] }); // property 9 not under customer 5
    await expect(caller().conversationCrm.selectProperty({ phone: PHONE, propertyId: 9 })).rejects.toThrow(/does not belong/i);
  });
  it("accepts a property that belongs to the linked customer", async () => {
    currentDb = makeDb({ smsConversationLinks: [{ customerId: 5 }], properties: [{ id: 9 }] });
    const r = await caller().conversationCrm.selectProperty({ phone: PHONE, propertyId: 9 });
    expect(r).toEqual({ success: true });
    expect(currentDb.upserts[0].values).toMatchObject({ propertyId: 9 });
  });
  it("refuses selecting a property with no linked customer", async () => {
    currentDb = makeDb({ smsConversationLinks: [] });
    await expect(caller().conversationCrm.selectProperty({ phone: PHONE, propertyId: 9 })).rejects.toThrow(/link a customer/i);
  });
});

describe("quickCreate — dedup / double-submit safety", () => {
  it("returns a duplicate WARNING (no create) when a phone lead already exists", async () => {
    currentDb = makeDb({ leads: [{ id: 3, name: "Existing Lead" }] });
    const r = await caller().conversationCrm.quickCreateLead({ phone: PHONE });
    expect(r).toEqual({ duplicate: true, candidates: [{ id: 3, name: "Existing Lead" }] });
    expect(currentDb.inserts).toHaveLength(0); // nothing created — a retry can't duplicate
  });
  it("creates + links a lead when none exists (and only with no dup)", async () => {
    currentDb = makeDb({}); // no dup
    const r = await caller().conversationCrm.quickCreateLead({ phone: PHONE, name: "Walk In" });
    expect("success" in r && r.success).toBe(true);
    const li = currentDb.inserts.find((i: { table: string }) => i.table === "leads");
    expect(li.values).toMatchObject({ contact: PHONE, contactType: "phone", source: "sms" });
    expect(li.values.service).toBeTruthy();
    expect(currentDb.upserts[0].values).toMatchObject({ leadId: 1 });
  });
  it("warns on a duplicate customer by phone (no create)", async () => {
    currentDb = makeDb({ customers: [{ id: 7, displayName: "Jane Doe" }] });
    const r = await caller().conversationCrm.quickCreateCustomer({ phone: PHONE });
    expect("duplicate" in r && r.duplicate).toBe(true);
    expect(currentDb.inserts).toHaveLength(0);
  });
  it("force-creates a customer past the dedup gate", async () => {
    currentDb = makeDb({ customers: [{ id: 7 }] });
    const r = await caller().conversationCrm.quickCreateCustomer({ phone: PHONE, name: "Jane", force: true });
    expect("success" in r && r.success).toBe(true);
    expect(currentDb.inserts.find((i: { table: string }) => i.table === "customers")).toBeTruthy();
  });
});

describe("unlink — audited clear", () => {
  it("clears all link fields with an audit actor", async () => {
    const r = await caller().conversationCrm.unlink({ phone: PHONE, target: "all" });
    expect(r).toEqual({ success: true });
    expect(currentDb.updates[0].set).toMatchObject({ customerId: null, leadId: null, leadCaptureId: null, propertyId: null, updatedBy: "Dispatcher Dana" });
  });
  it("rejects an unparseable phone", async () => {
    await expect(caller().conversationCrm.link({ phone: "abc", target: "customer", id: 1 })).rejects.toThrow();
  });
});
