import { describe, it, expect } from "vitest";
import {
  buildCustomerFieldUpdate,
  hasReviewableConflict,
  planCustomerConflictWrites,
  type ExistingConflictRow,
  type FieldConflict,
  type IncomingCustomerFields,
  type MergeableCustomer,
} from "./customerMerge";

function crm(over: Partial<MergeableCustomer> = {}): MergeableCustomer {
  return {
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    phone: null,
    altPhone: null,
    notes: null,
    status: "active",
    billingLine1: null,
    billingLine2: null,
    billingCity: null,
    billingState: null,
    billingZip: null,
    ...over,
  };
}

function qbo(over: Partial<IncomingCustomerFields> = {}): IncomingCustomerFields {
  return {
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    phone: null,
    altPhone: null,
    notes: null,
    status: null,
    billingLine1: null,
    billingLine2: null,
    billingCity: null,
    billingState: null,
    billingZip: null,
    ...over,
  };
}

describe("buildCustomerFieldUpdate — fill empty CRM fields", () => {
  it("fills blank fields from QBO and records them as 'missing'", () => {
    const out = buildCustomerFieldUpdate(
      crm({ email: null, phone: null }),
      qbo({ email: "jane@example.com", phone: "9735550100", billingLine1: "1 Main St", billingCity: "Newark" }),
    );
    expect(out.patch).toEqual({
      email: "jane@example.com",
      phone: "9735550100",
      billingLine1: "1 Main St",
      billingCity: "Newark",
    });
    expect(out.conflicts.every(c => c.conflictType === "missing")).toBe(true);
    expect(hasReviewableConflict(out)).toBe(false);
  });
});

describe("buildCustomerFieldUpdate — do NOT overwrite conflicting CRM data", () => {
  it("keeps CRM value and logs overwrite_prevented when values differ", () => {
    const out = buildCustomerFieldUpdate(
      crm({ email: "old@crm.com", companyName: "Acme HVAC" }),
      qbo({ email: "new@qbo.com", companyName: "Acme Heating LLC" }),
    );
    // No patch — existing values are preserved.
    expect(out.patch).toEqual({});
    const emailConflict = out.conflicts.find(c => c.fieldName === "email");
    expect(emailConflict).toMatchObject({
      conflictType: "overwrite_prevented",
      crmValue: "old@crm.com",
      qboValue: "new@qbo.com",
    });
    expect(hasReviewableConflict(out)).toBe(true);
  });

  it("does not flag equal values (email case-insensitive, phone normalized)", () => {
    const out = buildCustomerFieldUpdate(
      crm({ email: "Jane@Example.com", phone: "(973) 555-0100" }),
      qbo({ email: "jane@example.com", phone: "973-555-0100" }),
    );
    expect(out.patch).toEqual({});
    expect(out.conflicts).toEqual([]);
  });
});

describe("buildCustomerFieldUpdate — status from Active", () => {
  it("never auto-changes status; logs overwrite_prevented when QBO says inactive", () => {
    const out = buildCustomerFieldUpdate(crm({ status: "active" }), qbo({ status: "inactive" }));
    expect(out.patch.status).toBeUndefined();
    expect(out.conflicts.find(c => c.fieldName === "status")).toMatchObject({
      conflictType: "overwrite_prevented",
      crmValue: "active",
      qboValue: "inactive",
    });
  });
  it("no conflict when status already matches", () => {
    const out = buildCustomerFieldUpdate(crm({ status: "active" }), qbo({ status: "active" }));
    expect(out.conflicts.find(c => c.fieldName === "status")).toBeUndefined();
  });
});

describe("buildCustomerFieldUpdate — empty QBO fields are ignored", () => {
  it("produces no patch or conflicts when QBO carries nothing new", () => {
    const out = buildCustomerFieldUpdate(crm({ email: "keep@crm.com" }), qbo({ email: null, phone: "   " }));
    expect(out.patch).toEqual({});
    expect(out.conflicts).toEqual([]);
  });
});

describe("planCustomerConflictWrites — no duplicate conflict rows across syncs", () => {
  // Simulate a table: apply a plan against the current rows, return the new row set.
  let nextId = 1;
  function applyPlan(rows: ExistingConflictRow[], incoming: FieldConflict[]): ExistingConflictRow[] {
    const plan = planCustomerConflictWrites(rows, incoming);
    let next = rows.map(r => ({ ...r }));
    for (const upd of plan.updates) {
      const row = next.find(r => r.id === upd.id);
      if (row) row.qboValue = upd.qboValue;
    }
    for (const ins of plan.inserts) {
      next.push({ id: nextId++, fieldName: ins.fieldName, qboValue: ins.qboValue, status: ins.status });
    }
    return next;
  }

  it("keeps a single open row for the same overwrite_prevented conflict on every sync", () => {
    const incoming: FieldConflict[] = [
      { fieldName: "email", conflictType: "overwrite_prevented", crmValue: "old@crm.com", qboValue: "new@qbo.com" },
    ];
    let rows: ExistingConflictRow[] = [];
    // Poll five times with the exact same conflict.
    for (let i = 0; i < 5; i++) rows = applyPlan(rows, incoming);
    const openEmail = rows.filter(r => r.fieldName === "email" && r.status === "open");
    expect(openEmail).toHaveLength(1);
  });

  it("refreshes (not duplicates) the open row when the QBO value changes", () => {
    let rows: ExistingConflictRow[] = [];
    rows = applyPlan(rows, [
      { fieldName: "email", conflictType: "overwrite_prevented", crmValue: "old@crm.com", qboValue: "a@qbo.com" },
    ]);
    rows = applyPlan(rows, [
      { fieldName: "email", conflictType: "overwrite_prevented", crmValue: "old@crm.com", qboValue: "b@qbo.com" },
    ]);
    const openEmail = rows.filter(r => r.fieldName === "email" && r.status === "open");
    expect(openEmail).toHaveLength(1);
    expect(openEmail[0].qboValue).toBe("b@qbo.com");
  });

  it("does not re-insert a 'missing' auto-fill that was already recorded", () => {
    const incoming: FieldConflict[] = [
      { fieldName: "phone", conflictType: "missing", crmValue: null, qboValue: "9735550100" },
    ];
    let rows: ExistingConflictRow[] = [];
    rows = applyPlan(rows, incoming);
    rows = applyPlan(rows, incoming);
    expect(rows.filter(r => r.fieldName === "phone")).toHaveLength(1);
  });

  it("dedupes duplicate conflicts within a single batch to one open row", () => {
    const plan = planCustomerConflictWrites([], [
      { fieldName: "companyName", conflictType: "overwrite_prevented", crmValue: "Acme HVAC", qboValue: "Acme LLC" },
      { fieldName: "companyName", conflictType: "overwrite_prevented", crmValue: "Acme HVAC", qboValue: "Acme LLC" },
    ]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.openCount).toBe(1);
  });
});
