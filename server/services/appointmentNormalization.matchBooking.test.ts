/**
 * matchExistingPropertyForBooking — compliant NEW-booking forward-fill.
 * Verifies: same-customer match reuse (dedupe/idempotent), no-match → null,
 * NEVER creates a property, and DB errors propagate (not silently suppressed).
 */
import { describe, it, expect } from "vitest";
import { properties } from "../../drizzle/schema";
import { matchExistingPropertyForBooking } from "./appointmentNormalization";

interface Store { properties: any[]; inserts: any[]; throwOnSelect?: boolean; }

function fakeDb(store: Store): any {
  return {
    select: () => ({
      from: (_t: unknown) => ({
        where: () => {
          if (store.throwOnSelect) return Promise.reject(new Error("DB down"));
          return Promise.resolve(store.properties);
        },
      }),
    }),
    // Present so an accidental create would be observable — must never be called.
    insert: () => ({ values: (v: any) => { store.inserts.push(v); return Promise.resolve([{ insertId: 999 }]); } }),
  };
}

const store = (props: any[], throwOnSelect = false): Store => ({ properties: props, inserts: [], throwOnSelect });

describe("matchExistingPropertyForBooking", () => {
  it("returns null for a blank address; never touches the DB to create", async () => {
    const s = store([]);
    expect(await matchExistingPropertyForBooking(fakeDb(s), 7, "  ")).toBeNull();
    expect(await matchExistingPropertyForBooking(fakeDb(s), 7, null)).toBeNull();
    expect(s.inserts).toHaveLength(0);
  });

  it("reuses an existing same-customer property matched by free text", async () => {
    const s = store([{ id: 20, customerId: 7, addressLine1: "500 Main St", addressLine2: null, city: "Newark", state: "NJ", zip: "07102" }]);
    const id = await matchExistingPropertyForBooking(fakeDb(s), 7, "500 Main St, Newark, NJ 07102");
    expect(id).toBe(20);
    expect(s.inserts).toHaveLength(0);
  });

  it("matches on exact addressLine1 equality (capped)", async () => {
    const s = store([{ id: 31, customerId: 7, addressLine1: "12 Elm Ave", city: null, state: null, zip: null }]);
    expect(await matchExistingPropertyForBooking(fakeDb(s), 7, "12 Elm Ave")).toBe(31);
  });

  it("returns null (leaves unlinked) when no property matches — and NEVER creates one", async () => {
    const s = store([{ id: 20, customerId: 7, addressLine1: "500 Main St", city: "Newark", state: "NJ", zip: "07102" }]);
    const id = await matchExistingPropertyForBooking(fakeDb(s), 7, "9 Nowhere Rd");
    expect(id).toBeNull();
    expect(s.inserts).toHaveLength(0);
  });

  it("propagates DB errors (does NOT silently suppress)", async () => {
    const s = store([], /* throwOnSelect */ true);
    await expect(matchExistingPropertyForBooking(fakeDb(s), 7, "500 Main St")).rejects.toThrow("DB down");
  });
});
