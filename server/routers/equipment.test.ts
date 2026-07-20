/**
 * equipment router — staff CRUD. Property-anchored (customerId derived), category
 * validation, retire/reactivate, warranty attachment, and auth. Table-aware fake db.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTableName } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any = null;
vi.mock("../db", () => ({ getDb: vi.fn(async () => currentDb) }));

import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: -1, openId: "team:1", name: "Tech Lead", email: "t@example.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o } as AuthenticatedUser;
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const caller = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));
const anonCaller = () => createCaller(makeCtx(null));

function makeDb(data: Record<string, unknown[]> = {}) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; set: Record<string, unknown> }> = [];
  const rows = (t: unknown) => data[getTableName(t as never)] ?? [];
  const db = {
    inserts, updates,
    select() {
      let tbl: unknown;
      const chain: Record<string, unknown> = {
        from: (t: unknown) => { tbl = t; return chain; },
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(rows(tbl)),
        then: (r: (v: unknown) => unknown) => Promise.resolve(rows(tbl)).then(r),
      };
      return chain;
    },
    insert(t: unknown) {
      const table = getTableName(t as never);
      return { values(v: Record<string, unknown>) { inserts.push({ table, values: v }); const result = [{ insertId: inserts.length }];
        return { then: (r: (x: unknown) => unknown) => r(result) }; } };
    },
    update(t: unknown) { const table = getTableName(t as never); return { set(s: Record<string, unknown>) { return { where() { updates.push({ table, set: s }); return Promise.resolve(); } }; } }; },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

beforeEach(() => { currentDb = makeDb(); });

describe("equipment.create — property-anchored, customerId derived", () => {
  it("derives customerId from the property and stores an active unit", async () => {
    currentDb = makeDb({ properties: [{ id: 7, customerId: 42 }] });
    const r = await caller().equipment.create({ propertyId: 7, category: "furnace", make: "Carrier" });
    expect(r).toEqual({ id: 1 });
    const ins = currentDb.inserts[0];
    expect(ins.table).toBe("customerEquipment");
    expect(ins.values).toMatchObject({ propertyId: 7, customerId: 42, category: "furnace", make: "Carrier", status: "active" });
  });

  it("rejects when the property does not exist", async () => {
    currentDb = makeDb({ properties: [] });
    await expect(caller().equipment.create({ propertyId: 999, category: "furnace" })).rejects.toThrow(/property not found/i);
  });

  it("rejects an out-of-vocabulary category (controlled list)", async () => {
    currentDb = makeDb({ properties: [{ id: 7, customerId: 42 }] });
    // @ts-expect-error — invalid category must be rejected by zod
    await expect(caller().equipment.create({ propertyId: 7, category: "banana" })).rejects.toThrow();
    expect(currentDb.inserts.length).toBe(0);
  });
});

describe("equipment.update — re-derives customerId when moved to another property", () => {
  it("recomputes customerId from the new property", async () => {
    currentDb = makeDb({ customerEquipment: [{ id: 3, customerId: 42, propertyId: 7 }], properties: [{ id: 8, customerId: 99 }] });
    await caller().equipment.update({ id: 3, propertyId: 8 });
    expect(currentDb.updates[0].table).toBe("customerEquipment");
    expect(currentDb.updates[0].set).toMatchObject({ propertyId: 8, customerId: 99 });
  });

  it("rejects updating an equipment row that does not exist", async () => {
    currentDb = makeDb({ customerEquipment: [] });
    await expect(caller().equipment.update({ id: 404, make: "X" })).rejects.toThrow(/equipment not found/i);
  });
});

describe("equipment.retire / reactivate — soft status only", () => {
  it("retire sets status=retired (row is kept)", async () => {
    currentDb = makeDb();
    await caller().equipment.retire({ id: 3 });
    expect(currentDb.updates[0].set).toEqual({ status: "retired" });
  });
  it("reactivate sets status=active", async () => {
    currentDb = makeDb();
    await caller().equipment.reactivate({ id: 3 });
    expect(currentDb.updates[0].set).toEqual({ status: "active" });
  });
});

describe("equipment.listByCustomer — warranty attachment + active-first ordering", () => {
  it("attaches equipmentId-matched warranties and orders active before retired", async () => {
    currentDb = makeDb({
      customerEquipment: [
        { id: 1, customerId: 42, status: "retired", installedAt: null },
        { id: 2, customerId: 42, status: "active", installedAt: null },
      ],
      equipmentWarranties: [
        { id: 10, customerId: 42, equipmentId: 2, type: "manufacturer", status: "active" },
        { id: 11, customerId: 42, equipmentId: null, type: "labor", status: "active" }, // customer-level → skipped
      ],
    });
    const res = await caller().equipment.listByCustomer({ customerId: 42 });
    expect(res.total).toBe(2);
    expect(res.items[0].status).toBe("active"); // active unit sorts first
    expect(res.items.find(i => i.id === 2)?.warranties).toHaveLength(1);
    expect(res.items.find(i => i.id === 1)?.warranties).toHaveLength(0);
  });

  it("sorts a unit's warranties active-first, then latest-expiring", async () => {
    currentDb = makeDb({
      customerEquipment: [{ id: 5, customerId: 42, status: "active", installedAt: null }],
      equipmentWarranties: [
        { id: 20, customerId: 42, equipmentId: 5, type: "labor", status: "expired", expiresAt: "2030-01-01" },
        { id: 21, customerId: 42, equipmentId: 5, type: "manufacturer", status: "active", expiresAt: "2027-01-01" },
        { id: 22, customerId: 42, equipmentId: 5, type: "extended", status: "active", expiresAt: "2029-01-01" },
      ],
    });
    const res = await caller().equipment.listByCustomer({ customerId: 42 });
    const ws = res.items.find(i => i.id === 5)!.warranties;
    expect(ws.map(w => w.id)).toEqual([22, 21, 20]); // active(latest-exp) → active → expired last
  });
});

describe("equipment — auth", () => {
  it("rejects unauthenticated create", async () => {
    currentDb = makeDb({ properties: [{ id: 7, customerId: 42 }] });
    await expect(anonCaller().equipment.create({ propertyId: 7, category: "furnace" })).rejects.toThrow();
  });
});
