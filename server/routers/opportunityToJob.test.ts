import { describe, it, expect } from "vitest";
import {
  resolveJobProperty,
  convertOpportunityToJob,
  ConvertError,
  type ConvertJobPort,
  type PropertyCandidate,
  type OpportunityLite,
  type ConvertedJobLite,
} from "./opportunityToJob";

// ── helpers ────────────────────────────────────────────────────────────────

function prop(over: Partial<PropertyCandidate> = {}): PropertyCandidate {
  return { id: 1, label: null, addressLine1: "1 Main St", city: "Newark", state: "NJ", zip: "07103", isPrimary: false, ...over };
}

/**
 * In-memory port. Records every call so tests can assert exactly what was
 * written — and, crucially, that NO QuickBooks method exists to be called.
 */
class FakePort implements ConvertJobPort {
  calls: string[] = [];
  jobs: Array<{ id: number; jobNumber: string; status: string; customerId: number; propertyId: number | null; opportunityId: number; title: string; internalNotes: string | null }> = [];
  events: Array<{ opportunityId: number; jobId: number; userId: number }> = [];
  private nextId = 100;

  constructor(
    private opp: OpportunityLite | null,
    private customerPresent: boolean,
    private properties: PropertyCandidate[],
    private existing: ConvertedJobLite | null = null,
  ) {}

  async getOpportunity(id: number) { this.calls.push("getOpportunity"); return this.opp && this.opp.id === id ? this.opp : null; }
  async customerExists(_c: number) { this.calls.push("customerExists"); return this.customerPresent; }
  async getExistingConvertedJob(_o: number) { this.calls.push("getExistingConvertedJob"); return this.existing; }
  async getCustomerProperties(_c: number) { this.calls.push("getCustomerProperties"); return this.properties; }
  async createJob(input: { customerId: number; opportunityId: number; title: string; propertyId: number | null; internalNotes: string | null }) {
    this.calls.push("createJob");
    const id = this.nextId++;
    const jobNumber = `ME-2026-${String(id).padStart(4, "0")}`;
    this.jobs.push({ id, jobNumber, status: "new", customerId: input.customerId, propertyId: input.propertyId, opportunityId: input.opportunityId, title: input.title, internalNotes: input.internalNotes });
    return { id, jobNumber };
  }
  async recordEvent(opportunityId: number, jobId: number, userId: number) { this.calls.push("recordEvent"); this.events.push({ opportunityId, jobId, userId }); }
}

const OPP: OpportunityLite = { id: 42, customerId: 7, title: "Rooftop replacement", projectReference: "PN#160" };

// ── resolveJobProperty (pure) ───────────────────────────────────────────────

describe("resolveJobProperty", () => {
  it("uses the single property when exactly one exists", () => {
    expect(resolveJobProperty([prop({ id: 5 })], undefined)).toEqual({ kind: "resolved", propertyId: 5 });
  });
  it("resolves to null (property-less) when the customer has no properties", () => {
    expect(resolveJobProperty([], undefined)).toEqual({ kind: "resolved", propertyId: null });
  });
  it("is ambiguous with multiple non-primary properties", () => {
    const cands = [prop({ id: 1 }), prop({ id: 2 })];
    expect(resolveJobProperty(cands, undefined)).toEqual({ kind: "ambiguous", candidates: cands });
  });
  it("uses the single designated primary among several (not a guess)", () => {
    const cands = [prop({ id: 1 }), prop({ id: 2, isPrimary: true }), prop({ id: 3 })];
    expect(resolveJobProperty(cands, undefined)).toEqual({ kind: "resolved", propertyId: 2 });
  });
  it("is ambiguous when multiple properties are marked primary", () => {
    const cands = [prop({ id: 1, isPrimary: true }), prop({ id: 2, isPrimary: true })];
    expect(resolveJobProperty(cands, undefined).kind).toBe("ambiguous");
  });
  it("honors an explicit valid property selection (override)", () => {
    const cands = [prop({ id: 1 }), prop({ id: 2 })];
    expect(resolveJobProperty(cands, 2)).toEqual({ kind: "resolved", propertyId: 2 });
  });
  it("rejects an explicit property the customer does not own", () => {
    expect(resolveJobProperty([prop({ id: 1 })], 999)).toEqual({ kind: "invalid", propertyId: 999 });
  });
});

// ── convertOpportunityToJob (orchestration) ─────────────────────────────────

describe("convertOpportunityToJob", () => {
  it("converts successfully, seeds the job, and records an audit event", async () => {
    const port = new FakePort(OPP, true, [prop({ id: 5 })]);
    const res = await convertOpportunityToJob(port, { opportunityId: 42, userId: 3 });
    expect(res).toMatchObject({ ok: true, alreadyConverted: false, propertyId: 5, status: "new" });
    expect(port.jobs).toHaveLength(1);
    expect(port.jobs[0]).toMatchObject({ customerId: 7, opportunityId: 42, title: "Rooftop replacement", propertyId: 5 });
    expect(port.jobs[0].internalNotes).toContain("Opportunity #42");
    expect(port.jobs[0].internalNotes).toContain("PN#160");
    // audit: opportunity id, new job id, converting user
    expect(port.events).toEqual([{ opportunityId: 42, jobId: port.jobs[0].id, userId: 3 }]);
  });

  it("is idempotent: returns the existing primary job without creating another", async () => {
    const existing: ConvertedJobLite = { id: 77, jobNumber: "ME-2026-0077", status: "scheduled", propertyId: 5 };
    const port = new FakePort(OPP, true, [prop({ id: 5 })], existing);
    const res = await convertOpportunityToJob(port, { opportunityId: 42, userId: 3 });
    expect(res).toEqual({ ok: true, jobId: 77, jobNumber: "ME-2026-0077", status: "scheduled", alreadyConverted: true, propertyId: 5 });
    expect(port.jobs).toHaveLength(0); // no new job
    expect(port.events).toHaveLength(0); // no duplicate event
    expect(port.calls).not.toContain("createJob");
  });

  it("throws OPPORTUNITY_NOT_FOUND when the opportunity is missing", async () => {
    const port = new FakePort(null, true, []);
    await expect(convertOpportunityToJob(port, { opportunityId: 42, userId: 1 })).rejects.toMatchObject({ code: "OPPORTUNITY_NOT_FOUND" });
    expect(port.calls).not.toContain("createJob");
  });

  it("throws CUSTOMER_NOT_FOUND when the customer row is absent", async () => {
    const port = new FakePort(OPP, false, []);
    await expect(convertOpportunityToJob(port, { opportunityId: 42, userId: 1 })).rejects.toBeInstanceOf(ConvertError);
    await expect(convertOpportunityToJob(port, { opportunityId: 42, userId: 1 })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    expect(port.calls).not.toContain("createJob");
  });

  it("creates a property-less job when the customer has no property", async () => {
    const port = new FakePort(OPP, true, []);
    const res = await convertOpportunityToJob(port, { opportunityId: 42, userId: 3 });
    expect(res).toMatchObject({ ok: true, propertyId: null });
    expect(port.jobs[0].propertyId).toBeNull();
  });

  it("requests property selection (no write) when multiple properties are ambiguous", async () => {
    const cands = [prop({ id: 1 }), prop({ id: 2 })];
    const port = new FakePort(OPP, true, cands);
    const res = await convertOpportunityToJob(port, { opportunityId: 42, userId: 3 });
    expect(res).toEqual({ ok: false, reason: "property_selection_required", candidates: cands });
    expect(port.jobs).toHaveLength(0);
    expect(port.events).toHaveLength(0);
  });

  it("converts with a user-selected property override", async () => {
    const cands = [prop({ id: 1 }), prop({ id: 2 })];
    const port = new FakePort(OPP, true, cands);
    const res = await convertOpportunityToJob(port, { opportunityId: 42, propertyId: 2, userId: 3 });
    expect(res).toMatchObject({ ok: true, propertyId: 2 });
    expect(port.jobs[0].propertyId).toBe(2);
  });

  it("rejects a selected property that is not the customer's", async () => {
    const port = new FakePort(OPP, true, [prop({ id: 1 })]);
    await expect(convertOpportunityToJob(port, { opportunityId: 42, propertyId: 999, userId: 3 })).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
    expect(port.jobs).toHaveLength(0);
  });

  it("makes NO QuickBooks calls (port exposes no QBO surface)", async () => {
    const port = new FakePort(OPP, true, [prop({ id: 5 })]);
    await convertOpportunityToJob(port, { opportunityId: 42, userId: 3 });
    // Every method the conversion invoked is on the allow-list; none touch QBO.
    const allowed = new Set(["getOpportunity", "customerExists", "getExistingConvertedJob", "getCustomerProperties", "createJob", "recordEvent"]);
    expect(port.calls.every(c => allowed.has(c))).toBe(true);
    expect(port.calls.some(c => /quick|qbo|invoice|estimate|sync/i.test(c))).toBe(false);
  });
});
