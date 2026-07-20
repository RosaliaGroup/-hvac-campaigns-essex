/**
 * forwardFillPropertyForBooking — compliant two-tier NEW-booking forward-fill.
 * Verifies:
 *  - REUSE an existing same-customer property (dedupe/idempotent),
 *  - CREATE only when the typed address parses COMPLETE (Street+City+State+ZIP),
 *  - INCOMPLETE free-text line → null, never creates,
 *  - blank → null,
 *  - DB errors propagate (never silently suppressed).
 */
import { describe, it, expect } from "vitest";
import { properties } from "../../drizzle/schema";
import { forwardFillPropertyForBooking } from "./appointmentNormalization";

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
    insert: () => ({
      values: (v: any) => {
        const id = 900 + store.inserts.length;
        store.inserts.push(v);
        store.properties.push({ addressLine2: null, city: null, state: null, zip: null, ...v, id });
        return Promise.resolve([{ insertId: id }]);
      },
    }),
  };
}
const store = (props: any[], throwOnSelect = false): Store => ({ properties: props, inserts: [], throwOnSelect });

const COMPLETE = "45 Oak St, Springfield, NJ 07081";
const INCOMPLETE = "45 Oak St";

describe("forwardFillPropertyForBooking", () => {
  it("blank address → null, no DB writes", async () => {
    const s = store([]);
    expect(await forwardFillPropertyForBooking(fakeDb(s), 7, "  ")).toBeNull();
    expect(await forwardFillPropertyForBooking(fakeDb(s), 7, null)).toBeNull();
    expect(s.inserts).toHaveLength(0);
  });

  it("REUSE: links an existing same-customer property matched by free text (no create)", async () => {
    const s = store([{ id: 20, customerId: 7, addressLine1: "45 Oak St", addressLine2: null, city: "Springfield", state: "NJ", zip: "07081" }]);
    const id = await forwardFillPropertyForBooking(fakeDb(s), 7, COMPLETE);
    expect(id).toBe(20);
    expect(s.inserts).toHaveLength(0);
  });

  it("CREATE: complete typed address with no match → creates a STRUCTURED property", async () => {
    const s = store([]);
    const id = await forwardFillPropertyForBooking(fakeDb(s), 7, COMPLETE, "residential");
    expect(id).toBe(900);
    expect(s.inserts).toHaveLength(1);
    expect(s.inserts[0]).toMatchObject({
      customerId: 7,
      addressLine1: "45 Oak St",
      city: "Springfield",
      state: "NJ",
      zip: "07081",
      isPrimary: true,
    });
  });

  it("INCOMPLETE: single line missing city/state/ZIP → null, NEVER creates", async () => {
    const s = store([]);
    const id = await forwardFillPropertyForBooking(fakeDb(s), 7, INCOMPLETE);
    expect(id).toBeNull();
    expect(s.inserts).toHaveLength(0);
  });

  it("idempotent: a complete address whose addressLine1 already exists reuses it (no duplicate)", async () => {
    const s = store([{ id: 55, customerId: 7, addressLine1: "45 Oak St", addressLine2: null, city: null, state: null, zip: null }]);
    // Existing row is incomplete so tier-1 free-text match still catches it (line1 within text).
    const id = await forwardFillPropertyForBooking(fakeDb(s), 7, COMPLETE);
    expect(id).toBe(55);
    expect(s.inserts).toHaveLength(0);
  });

  it("propagates DB errors (does NOT silently suppress)", async () => {
    const s = store([], /* throwOnSelect */ true);
    await expect(forwardFillPropertyForBooking(fakeDb(s), 7, COMPLETE)).rejects.toThrow("DB down");
  });
});
