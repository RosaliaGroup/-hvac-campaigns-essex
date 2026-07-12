import { describe, it, expect } from "vitest";
import { assembleCustomerRelations, dedupeSalesDocs, type RelSalesDoc, type RelOpportunity } from "./customerRelations";

const doc = (over: Partial<RelSalesDoc> = {}): RelSalesDoc => ({
  id: 1, docType: "estimate", docNumber: "1000", quickbooksId: "q1",
  quickbooksCustomerId: "351", customerId: 23, opportunityId: 1,
  status: "pending", totalAmount: "100.00", txnDate: null, ...over,
});
const opp = (over: Partial<RelOpportunity> = {}): RelOpportunity => ({
  id: 1, title: "Opp", stage: "won", amount: "0.00", projectReference: null,
  quickbooksSalesDocumentId: null, createdAt: null, closedAt: null, ...over,
});

// Marco Weber = customer 23: 3 opportunities, 3 estimates (all under QBO CustomerRef 351), 0 jobs, 1 property.
function marco() {
  return assembleCustomerRelations({
    propertyCount: 1,
    jobs: [],
    opportunities: [
      opp({ id: 22, title: "Estimate 2164", amount: "21579.00" }),
      opp({ id: 25, title: "Estimate 2163", amount: "21579.00" }),
      opp({ id: 26, title: "Estimate 2162", amount: "25000.00" }),
    ],
    salesDocs: [
      doc({ id: 22, quickbooksId: "3341", docNumber: "2164-B", opportunityId: 22, status: "pending", totalAmount: "21579.00" }),
      doc({ id: 25, quickbooksId: "3340", docNumber: "2163-2", opportunityId: 25, status: "pending", totalAmount: "21579.00" }),
      doc({ id: 26, quickbooksId: "3339", docNumber: "2162-1", opportunityId: 26, status: "accepted", totalAmount: "23979.00" }),
    ],
  });
}

describe("assembleCustomerRelations — Marco (customer 23) regression", () => {
  it("returns all 3 linked opportunities", () => {
    expect(marco().opportunities.map(o => o.id).sort()).toEqual([22, 25, 26]);
  });
  it("returns all 3 estimates and 0 invoices", () => {
    const r = marco();
    expect(r.estimates.map(d => d.quickbooksId).sort()).toEqual(["3339", "3340", "3341"]);
    expect(r.invoices).toHaveLength(0);
  });
  it("returns 0 jobs (QBO sync creates none)", () => {
    expect(marco().jobs).toHaveLength(0);
  });
  it("computes correct profile counts", () => {
    expect(marco().counts).toEqual({ properties: 1, opportunities: 3, jobs: 0, estimates: 3, invoices: 0 });
  });
  it("cross-links each opportunity to its backing QBO estimate id", () => {
    const byId = Object.fromEntries(marco().opportunities.map(o => [o.id, o.quickbooksReference]));
    expect(byId).toEqual({ 22: "3341", 25: "3340", 26: "3339" });
  });
  it("keeps the sales-doc QBO CustomerRef stable (351) — never mutated to the row's id", () => {
    expect(marco().estimates.every(d => d.quickbooksCustomerId === "351")).toBe(true);
  });
});

describe("assembleCustomerRelations — dedup / no duplicates", () => {
  it("deduplicates a doc that matched by both customerId and QBO CustomerRef", () => {
    const r = assembleCustomerRelations({
      propertyCount: 0, jobs: [], opportunities: [opp({ id: 22 })],
      salesDocs: [
        doc({ id: 22, quickbooksId: "3341", opportunityId: 22 }),
        doc({ id: 22, quickbooksId: "3341", opportunityId: 22 }), // same row from the OR union
      ],
    });
    expect(r.estimates).toHaveLength(1);
    expect(r.counts.estimates).toBe(1);
  });
  it("dedupeSalesDocs collapses by primary id and by QuickBooks document id", () => {
    const out = dedupeSalesDocs([
      doc({ id: 1, quickbooksId: "A" }),
      doc({ id: 1, quickbooksId: "A" }),
      doc({ id: 2, quickbooksId: "A" }), // duplicate QBO id, different pk
      doc({ id: 3, quickbooksId: "B" }),
    ]);
    expect(out.map(d => d.id)).toEqual([1, 3]);
  });
});

describe("Marco Weber — child-project invoice hierarchy regression (no hard-coding)", () => {
  // Marco: CRM customer 23 (QBO ref 354). His 3 estimates carry the CHILD ref 351
  // (parent 354). Two invoices are filed under the child project 351 (parentRef
  // 354) and reconcile to Marco via the parent. Fixture only — nothing is
  // hard-coded to "Marco" in production code; matching is by id/ref/parentRef.
  const marco = () =>
    assembleCustomerRelations({
      propertyCount: 1,
      jobs: [],
      opportunities: [
        opp({ id: 22, stage: "won", amount: "21579.00" }),
        opp({ id: 25, stage: "won", amount: "21579.00" }),
        opp({ id: 26, stage: "won", amount: "25000.00" }),
      ],
      // As customers.getById would return them: estimates linked by customerId=23;
      // child-project invoices reconciled (customerId=23) carrying parent ref 354.
      salesDocs: [
        doc({ id: 22, docType: "estimate", quickbooksId: "3341", customerId: 23, quickbooksCustomerId: "351", status: "pending", totalAmount: "21579.00" }),
        doc({ id: 25, docType: "estimate", quickbooksId: "3340", customerId: 23, quickbooksCustomerId: "351", status: "pending", totalAmount: "21579.00" }),
        doc({ id: 26, docType: "estimate", quickbooksId: "3339", customerId: 23, quickbooksCustomerId: "351", status: "accepted", totalAmount: "23979.00" }),
        doc({ id: 40, docType: "invoice", quickbooksId: "5001", customerId: 23, quickbooksCustomerId: "351", quickbooksParentRef: "354", status: "paid", totalAmount: "21579.00", balance: "0.00" }),
        doc({ id: 41, docType: "invoice", quickbooksId: "5002", customerId: 23, quickbooksCustomerId: "351", quickbooksParentRef: "354", status: "unpaid", totalAmount: "23979.00", balance: "23979.00" }),
      ],
    });

  it("invoice count is 2 and the tab rows are the same 2", () => {
    const r = marco();
    expect(r.counts.invoices).toBe(2);
    expect(r.invoices.map(d => d.quickbooksId)).toEqual(["5001", "5002"]);
  });
  it("lifetime revenue + outstanding balance derive from those SAME 2 invoice rows", () => {
    const r = marco();
    expect(r.summary.lifetimeRevenue).toBe(21579);      // (21579−0) + (23979−23979)
    expect(r.summary.outstandingBalance).toBe(23979);   // 0 + 23979
  });
  it("estimate counts remain separate and unchanged (3)", () => {
    const r = marco();
    expect(r.counts.estimates).toBe(3);
    expect(r.invoices.some(d => d.docType === "estimate")).toBe(false);
  });
});

describe("assembleCustomerRelations — invoice reconciliation (revenue / balance / count)", () => {
  const invoiceSet = () =>
    assembleCustomerRelations({
      propertyCount: 0,
      jobs: [],
      opportunities: [opp({ id: 1, stage: "won", amount: "5000.00" })],
      salesDocs: [
        doc({ id: 1, docType: "invoice", quickbooksId: "i1", status: "paid", totalAmount: "1000.00", balance: "0.00" }),
        doc({ id: 2, docType: "invoice", quickbooksId: "i2", status: "partial", totalAmount: "1000.00", balance: "400.00" }),
        doc({ id: 3, docType: "invoice", quickbooksId: "i3", status: "unpaid", totalAmount: "500.00", balance: "500.00" }),
        doc({ id: 4, docType: "invoice", quickbooksId: "i4v", status: "void", totalAmount: "300.00", balance: "300.00", voided: true }),
        doc({ id: 5, docType: "estimate", quickbooksId: "e1", status: "pending", totalAmount: "9999.00" }),
      ],
    });

  it("lifetime revenue = sum(total − balance) over NON-voided invoices", () => {
    // (1000−0) + (1000−400) + (500−500) = 1600 ; the estimate is NOT revenue
    expect(invoiceSet().summary.lifetimeRevenue).toBe(1600);
  });
  it("outstanding balance = sum(invoice balance), NOT open estimates", () => {
    expect(invoiceSet().summary.outstandingBalance).toBe(900); // 0 + 400 + 500
  });
  it("invoiced total = gross invoiced (non-voided)", () => {
    expect(invoiceSet().summary.invoicedTotal).toBe(2500);
  });
  it("count == rows and both EXCLUDE the voided invoice", () => {
    const r = invoiceSet();
    expect(r.counts.invoices).toBe(3);
    expect(r.invoices).toHaveLength(3);
    expect(r.invoices.map(d => d.quickbooksId)).toEqual(["i1", "i2", "i3"]);
    expect(r.invoices.find(d => d.quickbooksId === "i4v")).toBeUndefined();
  });
  it("won-opportunity value is reported SEPARATELY from invoiced revenue", () => {
    const r = invoiceSet();
    expect(r.summary.wonOpportunityValue).toBe(5000); // pipeline value
    expect(r.summary.lifetimeRevenue).toBe(1600);     // invoiced — independent
  });
  it("estimates and invoices stay in separate collections", () => {
    const r = invoiceSet();
    expect(r.counts.estimates).toBe(1);
    expect(r.estimates.map(d => d.quickbooksId)).toEqual(["e1"]);
  });
  it("no invoices → revenue and balance are 0 (honest, consistent with count)", () => {
    const r = assembleCustomerRelations({ propertyCount: 0, jobs: [], opportunities: [opp({ id: 1, stage: "won", amount: "7000.00" })], salesDocs: [doc({ id: 1, docType: "estimate", quickbooksId: "e1" })] });
    expect(r.counts.invoices).toBe(0);
    expect(r.summary.lifetimeRevenue).toBe(0);
    expect(r.summary.outstandingBalance).toBe(0);
    expect(r.summary.wonOpportunityValue).toBe(7000);
  });
});

describe("assembleCustomerRelations — estimates, invoices, and PDC project reference", () => {
  it("splits estimates and invoices by docType", () => {
    const r = assembleCustomerRelations({
      propertyCount: 0, jobs: [],
      opportunities: [opp({ id: 1 }), opp({ id: 2 })],
      salesDocs: [
        doc({ id: 1, docType: "estimate", quickbooksId: "e1", opportunityId: 1 }),
        doc({ id: 2, docType: "invoice", quickbooksId: "i1", opportunityId: 2 }),
      ],
    });
    expect(r.estimates.map(d => d.quickbooksId)).toEqual(["e1"]);
    expect(r.invoices.map(d => d.quickbooksId)).toEqual(["i1"]);
    expect(r.counts).toMatchObject({ estimates: 1, invoices: 1 });
  });
  it("derives an estimate's project reference from its linked opportunity (PDC / PN#132)", () => {
    const r = assembleCustomerRelations({
      propertyCount: 0, jobs: [],
      opportunities: [opp({ id: 20, title: "PDC — Estimate 2160", projectReference: "PN#132" })],
      salesDocs: [doc({ id: 20, quickbooksId: "3314", docNumber: "2160", opportunityId: 20, quickbooksCustomerId: "119" })],
    });
    expect(r.estimates[0].projectReference).toBe("PN#132");
    expect(r.estimates[0].opportunityTitle).toBe("PDC — Estimate 2160");
    expect(r.estimates[0].quickbooksCustomerId).toBe("119"); // stable, unchanged
  });
});
