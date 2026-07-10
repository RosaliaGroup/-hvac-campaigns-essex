import { describe, it, expect } from "vitest";
import {
  buildCustomerFieldUpdate,
  hasReviewableConflict,
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
