import { describe, it, expect } from "vitest";
import { refreshCustomers, type RefreshPort, type RefreshCustomerRow, type QboCustomerLite } from "./qboCustomerRefresh";

class MemRefresh implements RefreshPort {
  customers = new Map<number, RefreshCustomerRow>();
  writes: Array<{ id: number; patch: Record<string, unknown> }> = [];
  lockHeld = false;
  acquired = 0;
  released = 0;
  private clock = new Date("2026-07-10T12:00:00Z");
  async getCustomer(id: number) { return this.customers.get(id) ?? null; }
  async updateCustomerFields(id: number, patch: Record<string, unknown>) { this.writes.push({ id, patch }); const c = this.customers.get(id); if (c) Object.assign(c, patch); }
  async acquireLock() { if (this.lockHeld) return false; this.lockHeld = true; this.acquired++; return true; }
  async releaseLock() { this.lockHeld = false; this.released++; }
  now() { return this.clock; }
}

function crow(over: Partial<RefreshCustomerRow> = {}): RefreshCustomerRow {
  return { id: 1, displayName: null, firstName: null, lastName: null, companyName: null, email: null, phone: null, quickbooksCustomerId: "100", ...over };
}
function qbo(over: Partial<QboCustomerLite> = {}): QboCustomerLite {
  return { Id: "100", DisplayName: "Jane Doe", GivenName: "Jane", FamilyName: "Doe", PrimaryEmailAddr: { Address: "jane@x.com" }, PrimaryPhone: { FreeFormNumber: "5551110000" }, ...over };
}
const OPTS = { runId: "r1", dryRun: false, maxBatch: 25 };

describe("refreshCustomers", () => {
  it("fills only empty fields and sets both checkedAt and updatedAt on change", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow({ firstName: "KEEP" })); // firstName already set
    const summary = await refreshCustomers(port, async () => qbo(), [1], OPTS);
    expect(summary.changed).toBe(1);
    const c = port.customers.get(1)!;
    expect(c.firstName).toBe("KEEP"); // not overwritten
    expect(c.lastName).toBe("Doe");
    expect(c.email).toBe("jane@x.com");
    const patch = port.writes[0].patch;
    expect(patch.quickbooksCustomerCheckedAt).toBeInstanceOf(Date);
    expect(patch.quickbooksCustomerUpdatedAt).toBeInstanceOf(Date);
    expect(summary.results[0].changedFields).not.toContain("firstName");
  });

  it("unchanged rows still stamp checkedAt but NOT updatedAt", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow({ displayName: "Jane Doe", firstName: "Jane", lastName: "Doe", email: "jane@x.com", phone: "5551110000", companyName: "n/a" }));
    const summary = await refreshCustomers(port, async () => qbo({ CompanyName: "n/a" }), [1], OPTS);
    expect(summary.unchanged).toBe(1);
    const patch = port.writes[0].patch;
    expect(patch.quickbooksCustomerCheckedAt).toBeInstanceOf(Date);
    expect(patch.quickbooksCustomerUpdatedAt).toBeUndefined();
  });

  it("dry-run writes nothing", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow());
    const summary = await refreshCustomers(port, async () => qbo(), [1], { ...OPTS, dryRun: true });
    expect(summary.changed).toBe(1);
    expect(port.writes.length).toBe(0);
  });

  it("does NOT copy a composite QBO DisplayName onto an empty name (default)", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow());
    const composite = "PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103";
    await refreshCustomers(port, async () => qbo({ DisplayName: composite, GivenName: undefined, FamilyName: undefined }), [1], OPTS);
    expect(port.customers.get(1)!.displayName).toBeNull(); // composite blocked
  });

  it("allowComposite lets the reviewed-repair path copy the composite name", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow());
    const composite = "PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103";
    await refreshCustomers(port, async () => qbo({ DisplayName: composite, GivenName: undefined, FamilyName: undefined }), [1], { ...OPTS, allowComposite: true });
    expect(port.customers.get(1)!.displayName).toBe(composite);
  });

  it("flags a QBO Id mismatch as a conflict without writing", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow({ quickbooksCustomerId: "100" }));
    const summary = await refreshCustomers(port, async () => qbo({ Id: "999" }), [1], OPTS);
    expect(summary.conflicts).toBe(1);
    expect(port.writes.length).toBe(0);
  });

  it("skips customers with no QBO id and missing customers", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow({ quickbooksCustomerId: null }));
    const summary = await refreshCustomers(port, async () => qbo(), [1, 2], OPTS);
    expect(summary.skipped).toBe(2);
  });

  it("records a fetch error as a failure and continues", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow());
    port.customers.set(2, crow({ id: 2, quickbooksCustomerId: "200" }));
    let n = 0;
    const summary = await refreshCustomers(port, async () => { if (n++ === 0) throw new Error("429"); return qbo({ Id: "200" }); }, [1, 2], OPTS);
    expect(summary.failures).toBe(1);
    expect(summary.results.find(r => r.customerId === 1)!.status).toBe("failed");
  });

  it("throws when the batch exceeds the cap (never partially runs)", async () => {
    const port = new MemRefresh();
    await expect(refreshCustomers(port, async () => qbo(), [1, 2, 3], { ...OPTS, maxBatch: 2 })).rejects.toThrow(/exceeds max/);
    expect(port.acquired).toBe(0);
  });

  it("throws when the concurrency lock is already held", async () => {
    const port = new MemRefresh();
    port.lockHeld = true;
    port.customers.set(1, crow());
    await expect(refreshCustomers(port, async () => qbo(), [1], OPTS)).rejects.toThrow(/lock held/);
  });

  it("always releases the lock, even after a per-row conflict", async () => {
    const port = new MemRefresh();
    port.customers.set(1, crow());
    await refreshCustomers(port, async () => qbo({ Id: "999" }), [1], OPTS);
    expect(port.lockHeld).toBe(false);
    expect(port.released).toBe(1);
  });
});
