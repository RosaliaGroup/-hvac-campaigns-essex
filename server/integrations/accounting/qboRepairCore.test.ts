import { describe, it, expect } from "vitest";
import { applyRepairRow, rollbackRun, type RepairPort, type RollbackPort, type RepairCustomerRow, type ManifestRow, type AuditRow } from "./qboRepairCore";
import type { CustomerIdentity, PropertyRow } from "../../../shared/qboCustomerRepair";

// ── In-memory RepairPort ──────────────────────────────────────────────────────
class MemRepair implements RepairPort {
  customers = new Map<number, RepairCustomerRow>();
  properties: PropertyRow[] = [];
  opportunities = new Map<number, number[]>(); // customerId -> opp ids
  oppProjectRef = new Map<number, string>();
  audit: AuditRow[] = [];
  createdProps: Array<{ id: number; customerId: number }> = [];
  private nextPropId = 9000;
  failCreateProperty = false;
  txCommits = 0;
  txRollbacks = 0;

  async getCustomer(id: number) { return this.customers.get(id) ?? null; }
  async getAllIdentities(): Promise<CustomerIdentity[]> {
    return [...this.customers.values()].map(c => ({ id: c.id, quickbooksCustomerId: c.quickbooksCustomerId, email: c.email, phone: c.phone, altPhone: c.altPhone, displayName: c.displayName, companyName: c.companyName }));
  }
  async getPropertiesForCustomer(customerId: number) { return this.properties.filter(p => p.customerId === customerId); }
  async getOpportunityIdsForCustomer(customerId: number) { return this.opportunities.get(customerId) ?? []; }
  async updateCustomerFields(id: number, patch: Record<string, unknown>) {
    const c = this.customers.get(id)!; Object.assign(c, patch);
  }
  async createProperty(row: { customerId: number; addressLine1: string }) {
    if (this.failCreateProperty) throw new Error("boom");
    const id = this.nextPropId++;
    this.properties.push({ id, customerId: row.customerId, addressLine1: row.addressLine1, city: null, zip: null });
    this.createdProps.push({ id, customerId: row.customerId });
    return id;
  }
  async setOpportunityProjectReference(oppId: number, ref: string) { this.oppProjectRef.set(oppId, ref); }
  async insertAudit(row: AuditRow) { this.audit.push(row); }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // snapshot for rollback-on-throw
    const snapCust = new Map([...this.customers].map(([k, v]) => [k, { ...v }]));
    const snapProps = this.properties.map(p => ({ ...p }));
    const snapAudit = [...this.audit];
    const snapRef = new Map(this.oppProjectRef);
    const snapCreated = [...this.createdProps];
    try { const out = await fn(); this.txCommits++; return out; }
    catch (e) { this.customers = snapCust; this.properties = snapProps; this.audit = snapAudit; this.oppProjectRef = snapRef; this.createdProps = snapCreated; this.txRollbacks++; throw e; }
  }
}

function cust(over: Partial<RepairCustomerRow> = {}): RepairCustomerRow {
  return { id: 10, displayName: null, firstName: null, lastName: null, companyName: null, email: null, phone: null, altPhone: null, quickbooksCustomerId: "316", ...over };
}
function manifest(over: Partial<ManifestRow> = {}): ManifestRow {
  return {
    crmCustomerId: 10, quickbooksCustomerId: "316",
    expectedDisplayName: "PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103",
    approvedAction: "repair_name_project_property",
    customerFieldsMayChange: true, projectReferenceMayChange: true,
    propertyCreationApproved: true, mergeApproved: false, reviewNote: "test", ...over,
  };
}
const OPTS = { runId: "run-1", actor: "tester", manifestHash: "abc123", dryRun: false };

describe("applyRepairRow", () => {
  it("applies a high-confidence composite repair: name split, project ref, property, audit", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName }));
    port.opportunities.set(10, [500]);

    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("applied");
    const c = port.customers.get(10)!;
    expect(c.displayName).toBe("Colbert Watson");
    expect(c.firstName).toBe("Colbert");
    expect(c.lastName).toBe("Watson");
    expect(res.createdPropertyId).toBeGreaterThan(0);
    expect(port.oppProjectRef.get(500)).toBe("PN #163");
    // audit: name fields + property + project ref
    expect(port.audit.some(a => a.fieldName === "displayName" && a.afterValue === "Colbert Watson")).toBe(true);
    expect(port.audit.some(a => a.fieldName === "property.created")).toBe(true);
    expect(port.audit.some(a => a.fieldName === "projectReference" && a.opportunityId === 500)).toBe(true);
    expect(port.txCommits).toBe(1);
  });

  it("dry-run computes changes but writes nothing", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName }));
    port.opportunities.set(10, [500]);
    const res = await applyRepairRow(port, m, { ...OPTS, dryRun: true });
    expect(res.result).toBe("would_apply");
    expect(res.changes.length).toBeGreaterThan(0);
    expect(port.customers.get(10)!.displayName).toBe(m.expectedDisplayName); // unchanged
    expect(port.audit.length).toBe(0);
    expect(port.oppProjectRef.size).toBe(0);
  });

  it("skips when the current DisplayName no longer matches the manifest (stale)", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: "Colbert Watson" })); // already repaired
    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("skipped");
    expect(res.reason).toBe("STALE_DISPLAY_NAME");
  });

  it("is idempotent: a second apply after success is skipped as stale", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName }));
    port.opportunities.set(10, [500]);
    const first = await applyRepairRow(port, m, OPTS);
    expect(first.result).toBe("applied");
    const second = await applyRepairRow(port, m, OPTS);
    expect(second.result).toBe("skipped");
    expect(second.reason).toBe("STALE_DISPLAY_NAME");
  });

  it("conflicts when the QBO id does not match the manifest", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName, quickbooksCustomerId: "999" }));
    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("conflict");
    expect(res.reason).toBe("QBO_ID_MISMATCH");
  });

  it("conflicts (never merges) when another record shares a strong identifier", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName, email: "a@x.com" }));
    port.customers.set(11, cust({ id: 11, quickbooksCustomerId: "700", email: "a@x.com", displayName: "Someone Else" }));
    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("conflict");
    expect(res.reason).toContain("DUPLICATE_IDENTIFIER");
    expect(port.customers.get(10)!.displayName).toBe(m.expectedDisplayName); // untouched
  });

  it("does NOT create a property when the manifest withholds approval (#7/#8)", async () => {
    const port = new MemRepair();
    const m = manifest({ crmCustomerId: 7, quickbooksCustomerId: "322", propertyCreationApproved: false,
      expectedDisplayName: "PN#160 I Natanya Phipps I 351 Central Ave, Haledon, NJ" });
    port.customers.set(7, cust({ id: 7, quickbooksCustomerId: "322", displayName: m.expectedDisplayName }));
    port.opportunities.set(7, [77]);
    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("applied");
    expect(res.createdPropertyId ?? null).toBeNull();
    expect(port.createdProps.length).toBe(0);
    expect(port.audit.some(a => a.fieldName === "property.created")).toBe(false);
    // name + project ref still applied
    expect(port.oppProjectRef.get(77)).toBe("PN#160");
  });

  it("skips a low/medium-confidence (non-repairable) name rather than guessing", async () => {
    const port = new MemRepair();
    // A legitimate, non-composite name — parser should not treat it as composite.
    const m = manifest({ expectedDisplayName: "Premier Development Corp" });
    port.customers.set(10, cust({ displayName: "Premier Development Corp" }));
    const res = await applyRepairRow(port, m, OPTS);
    expect(res.result).toBe("skipped");
    expect(res.reason).toContain("PARSE_NOT_HIGH_CONFIDENCE");
  });

  it("rolls back the whole customer transaction if a write throws", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName }));
    port.opportunities.set(10, [500]);
    port.failCreateProperty = true;
    await expect(applyRepairRow(port, m, OPTS)).rejects.toThrow();
    // nothing committed
    expect(port.txRollbacks).toBe(1);
    expect(port.customers.get(10)!.displayName).toBe(m.expectedDisplayName);
    expect(port.audit.length).toBe(0);
    expect(port.oppProjectRef.size).toBe(0);
  });

  it("never writes email/phone/billing/qbo-id (patch only carries name identity)", async () => {
    const port = new MemRepair();
    const m = manifest();
    port.customers.set(10, cust({ displayName: m.expectedDisplayName, email: "keep@x.com", phone: "5551234567" }));
    port.opportunities.set(10, [500]);
    await applyRepairRow(port, m, OPTS);
    const c = port.customers.get(10)!;
    expect(c.email).toBe("keep@x.com");
    expect(c.phone).toBe("5551234567");
    expect(c.quickbooksCustomerId).toBe("316");
    expect(port.audit.every(a => !["email", "phone", "altPhone", "quickbooksCustomerId"].includes(a.fieldName))).toBe(true);
  });
});

// ── Rollback ──────────────────────────────────────────────────────────────────
class MemRollback implements RollbackPort {
  audit: AuditRow[] = [];
  customers = new Map<number, RepairCustomerRow>();
  deletedProps: number[] = [];
  clearedRefs: Array<{ oppId: number; expected: string }> = [];
  depProps = new Set<number>();
  restored: Array<{ id: number; field: string; value: string | null }> = [];
  async getAuditRows(runId: string) { return this.audit.filter(a => a.runId === runId && a.kind === "repair"); }
  async getCustomer(id: number) { return this.customers.get(id) ?? null; }
  async getCustomerFieldValue(id: number, field: string) { const c = this.customers.get(id) as any; return c ? (c[field] ?? null) : null; }
  async restoreCustomerField(id: number, field: string, value: string | null) { const c = this.customers.get(id) as any; if (c) c[field] = value; this.restored.push({ id, field, value }); }
  async clearOpportunityProjectReference(oppId: number, expected: string) { this.clearedRefs.push({ oppId, expected }); return true; }
  async propertyHasDependencies(propertyId: number) { return this.depProps.has(propertyId); }
  async deleteProperty(propertyId: number) { this.deletedProps.push(propertyId); }
  async insertAudit(row: AuditRow) { this.audit.push(row); }
  async transaction<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
}

function auditRow(over: Partial<AuditRow>): AuditRow {
  return { runId: "run-1", kind: "repair", actor: "t", parserVersion: "1.0.0", manifestHash: "h", customerId: 10, quickbooksCustomerId: "316", fieldName: "displayName", beforeValue: null, afterValue: null, createdPropertyId: null, opportunityId: null, result: "applied", reason: null, ...over };
}

describe("rollbackRun", () => {
  it("restores a customer field when current still equals the recorded after", async () => {
    const port = new MemRollback();
    port.customers.set(10, { ...cust(), displayName: "Colbert Watson" });
    port.audit.push(auditRow({ fieldName: "displayName", beforeValue: "PN #163 I Colbert Watson I ...", afterValue: "Colbert Watson" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: false, actor: "t" });
    expect(lines[0].action).toBe("restore");
    expect(port.customers.get(10)!.displayName).toBe("PN #163 I Colbert Watson I ...");
    expect(port.audit.some(a => a.kind === "rollback" && a.result === "rolled_back")).toBe(true);
  });

  it("refuses to restore a field that changed since the repair", async () => {
    const port = new MemRollback();
    port.customers.set(10, { ...cust(), displayName: "Manually Edited Name" });
    port.audit.push(auditRow({ fieldName: "displayName", beforeValue: "raw", afterValue: "Colbert Watson" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: false, actor: "t" });
    expect(lines[0].action).toBe("refuse");
    expect(lines[0].reason).toBe("CURRENT_NOT_EQUAL_RECORDED_AFTER");
    expect(port.restored.length).toBe(0);
  });

  it("deletes a run-created property only when nothing depends on it", async () => {
    const port = new MemRollback();
    port.audit.push(auditRow({ fieldName: "property.created", createdPropertyId: 9001, afterValue: "{...}" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: false, actor: "t" });
    expect(lines[0].action).toBe("delete_property");
    expect(port.deletedProps).toContain(9001);
  });

  it("refuses to delete a property that has dependencies", async () => {
    const port = new MemRollback();
    port.depProps.add(9002);
    port.audit.push(auditRow({ fieldName: "property.created", createdPropertyId: 9002, afterValue: "{...}" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: false, actor: "t" });
    expect(lines[0].action).toBe("refuse");
    expect(lines[0].reason).toBe("PROPERTY_HAS_DEPENDENCIES");
    expect(port.deletedProps).not.toContain(9002);
  });

  it("clears a project reference set by the run", async () => {
    const port = new MemRollback();
    port.audit.push(auditRow({ fieldName: "projectReference", opportunityId: 500, afterValue: "PN #163" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: false, actor: "t" });
    expect(lines[0].action).toBe("clear_project");
    expect(port.clearedRefs).toEqual([{ oppId: 500, expected: "PN #163" }]);
  });

  it("preview (dryRun) changes nothing", async () => {
    const port = new MemRollback();
    port.customers.set(10, { ...cust(), displayName: "Colbert Watson" });
    port.audit.push(auditRow({ fieldName: "displayName", beforeValue: "raw", afterValue: "Colbert Watson" }));
    const lines = await rollbackRun(port, "run-1", { dryRun: true, actor: "t" });
    expect(lines[0].action).toBe("restore");
    expect(port.restored.length).toBe(0);
    expect(port.customers.get(10)!.displayName).toBe("Colbert Watson");
  });
});
