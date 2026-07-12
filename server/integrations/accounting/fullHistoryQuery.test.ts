/**
 * Full-history coverage: the WHERE-less query, parent/sub-customer identity
 * resolution, and the pure dry-run planner (proposed outcomes, zero writes).
 */
import { describe, it, expect } from "vitest";
import {
  buildEstimateQuery,
  resolveCustomerIdentity,
  buildContactFromEstimate,
  planEstimateOutcome,
  summarizeCoverage,
  type QboEstimate,
  type QboCustomerLite,
  type EstimatePlanRow,
} from "./estimates";
import { parseQboCompositeName } from "../../../shared/qboCompositeName";

const NOW = new Date("2026-07-12T00:00:00Z");

describe("buildEstimateQuery — full_history mode", () => {
  it("has NO TxnDate lower bound and NO cursor predicate", () => {
    const q = buildEstimateQuery({ fullHistory: true, now: NOW });
    expect(q).not.toContain("TxnDate");
    expect(q).not.toContain("LastUpdatedTime >");
    expect(q).not.toContain("WHERE");
    expect(q).toContain("SELECT * FROM Estimate");
    expect(q).toContain("ORDERBY MetaData.LastUpdatedTime");
  });

  it("ignores the forward cursor entirely (coverage over old unchanged docs)", () => {
    const cursor = new Date("2026-07-10T17:53:00Z");
    const withCursor = buildEstimateQuery({ fullHistory: true, cursor, now: NOW });
    expect(withCursor).not.toContain("2026-07-10");
    expect(withCursor).not.toContain("WHERE");
  });

  it("preserves pagination", () => {
    const q = buildEstimateQuery({ fullHistory: true, startPosition: 201, pageSize: 100, now: NOW });
    expect(q).toContain("STARTPOSITION 201");
    expect(q).toContain("MAXRESULTS 100");
  });

  it("normal modes still apply their bounds (not weakened)", () => {
    const incr = buildEstimateQuery({ cursor: new Date("2026-01-01T00:00:00Z"), now: NOW });
    expect(incr).toContain("WHERE MetaData.LastUpdatedTime > '2026-01-01T00:00:00.000Z'");
    const back = buildEstimateQuery({ now: NOW, sinceDays: 60 });
    expect(back).toContain("WHERE TxnDate >=");
  });
});

// ─── PDC LLC fixtures ────────────────────────────────────────────────────────

const PDC_PARENT: QboCustomerLite = { Id: "9000", DisplayName: "PDC LLC", CompanyName: "PDC LLC" };

function subCustomer(id: string, name: string, ship?: QboCustomerLite["ShipAddr"]): QboCustomerLite {
  return { Id: id, DisplayName: name, Job: true, ParentRef: { value: "9000", name: "PDC LLC" }, ShipAddr: ship };
}

function estimate(id: string, docNumber: string, subId: string, subName: string, status: string, txnDate: string): QboEstimate {
  return {
    Id: id, DocNumber: docNumber, TxnStatus: status, TxnDate: txnDate,
    CustomerRef: { value: subId, name: subName },
    MetaData: { LastUpdatedTime: `${txnDate}T12:00:00Z` },
    TotalAmt: 1000,
  };
}

describe("resolveCustomerIdentity — parent/sub", () => {
  it("resolves a sub-customer to its authoritative parent", () => {
    const id = resolveCustomerIdentity(subCustomer("9135", "PN#135"), PDC_PARENT);
    expect(id.isSubCustomer).toBe(true);
    expect(id.authoritativeQboId).toBe("9000");
    expect(id.subCustomerQboId).toBe("9135");
    expect(id.parentQboId).toBe("9000");
    expect(id.parentUnresolved).toBe(false);
  });

  it("falls back to ParentRef id when the parent record was not fetched", () => {
    const id = resolveCustomerIdentity(subCustomer("9135", "PN#135"), null);
    expect(id.authoritativeQboId).toBe("9000"); // from ParentRef.value
    expect(id.parentUnresolved).toBe(false);
  });

  it("flags parentUnresolved when a Job has neither a fetched parent nor ParentRef id", () => {
    const orphan: QboCustomerLite = { Id: "9200", DisplayName: "PN#999", Job: true };
    const id = resolveCustomerIdentity(orphan, null);
    expect(id.isSubCustomer).toBe(true);
    expect(id.authoritativeQboId).toBeNull();
    expect(id.parentUnresolved).toBe(true);
  });

  it("a direct (non-sub) customer is authoritative itself", () => {
    const id = resolveCustomerIdentity({ Id: "5000", DisplayName: "Jane Doe" }, null);
    expect(id.isSubCustomer).toBe(false);
    expect(id.authoritativeQboId).toBe("5000");
  });
});

/** Build a plan row for a PDC sub-customer estimate, matched to CRM customer 9. */
function planPdc(est: QboEstimate, sub: QboCustomerLite, existing: boolean, serviceVerified = false): EstimatePlanRow {
  const identity = resolveCustomerIdentity(sub, PDC_PARENT);
  const contact = buildContactFromEstimate(est, PDC_PARENT);
  contact.quickbooksCustomerId = identity.authoritativeQboId;
  // Mirror resolveEstimateIdentity: preserve the project reference from the sub.
  if (!contact.projectReference) {
    contact.projectReference = parseQboCompositeName(sub.DisplayName ?? est.CustomerRef?.name ?? null).projectReference;
  }
  return planEstimateOutcome({
    estimate: est,
    contact,
    identity,
    existingDoc: existing ? { id: 1, customerId: 9, quickbooksUpdatedAt: new Date(est.MetaData!.LastUpdatedTime!) } : null,
    match: existing ? null : { matchedBy: "parent_qbo_id", crmCustomerId: 9 },
    serviceAddressVerified: serviceVerified,
    now: NOW,
  });
}

describe("planEstimateOutcome — PDC LLC (customer id 9)", () => {
  it("Estimate 2140 / PN#132 (rejected, missing) → proposed under PDC, no customer creation, no job", () => {
    const sub = subCustomer("9132", "PN#132 I PDC LLC");
    const row = planPdc(estimate("2140", "2140", "9132", "PN#132 I PDC LLC", "Rejected", "2025-03-01"), sub, false);
    expect(row.resolvedCrmCustomerId).toBe(9);
    expect(row.salesDocAction).toBe("create");
    expect(row.opportunityAction).toBe("create");
    expect(row.customerCreationProposed).toBe(false);
    expect(row.jobAction).toBe("none");
    expect(row.confidence).toBe("high"); // parent_qbo_id linkage
    expect(row.coverageCategory).toBe("missing_safe_import");
    expect(row.parentResolution).toContain("parent 9000");
    expect(row.dbWrites).toBe(0);
    expect(row.status).toBe("rejected");
  });

  it("Estimate 2141 / PN#135 (converted/closed, missing) → same PDC customer, separate opportunity", () => {
    const sub = subCustomer("9135", "PN#135 I PDC LLC");
    const row = planPdc(estimate("2141", "2141", "9135", "PN#135 I PDC LLC", "Closed", "2025-04-01"), sub, false);
    expect(row.resolvedCrmCustomerId).toBe(9);
    expect(row.opportunityAction).toBe("create"); // separate opp per estimate
    expect(row.customerCreationProposed).toBe(false);
    expect(row.status).toBe("closed");
  });

  it("Estimate 2160 / York Ave (present) → already_linked, property enrichment flagged", () => {
    const sub = subCustomer("9160", "York Ave I PDC LLC", { Line1: "123 York Ave", City: "Newark", CountrySubDivisionCode: "NJ" });
    const row = planPdc(estimate("2160", "2160", "9160", "York Ave I PDC LLC", "Accepted", "2025-05-01"), sub, true, true);
    expect(row.coverageCategory).toBe("already_linked");
    expect(row.salesDocAction).toBe("none"); // already mirrored + unchanged
    expect(row.resolvedCrmCustomerId).toBe(9);
    expect(row.jobAction).toBe("none");
  });

  it("row carries Customer, Parent Customer, and project reference for the report", () => {
    // Full composite (≥3 ' I ' segments) so the parser extracts the project code.
    const name = "PN#135 I PDC LLC I 42 Main St, Newark, NJ 07102 I roof unit";
    const sub = subCustomer("9135", name);
    const row = planPdc(estimate("2141", "2141", "9135", name, "Closed", "2025-04-01"), sub, false);
    expect(row.qboCustomerName).toContain("PN#135"); // the estimate's (sub) customer name
    expect(row.parentCustomerName).toBe("PDC LLC"); // authoritative parent
    expect(row.projectReference).toBe("PN#135"); // parsed from the composite
  });

  it("summarizeCoverage counts proposed opportunity/property creations (0 jobs)", () => {
    const rows = [
      planPdc(estimate("2140", "2140", "9132", "PN#132", "Rejected", "2025-03-01"), subCustomer("9132", "PN#132"), false),
      planPdc(estimate("2141", "2141", "9135", "PN#135", "Closed", "2025-04-01"), subCustomer("9135", "PN#135"), false),
    ];
    const t = summarizeCoverage(rows);
    expect(t.opportunityCreationsProposed).toBe(2); // one per missing estimate
    expect(t.propertyCreationsProposed).toBe(0); // no verified ShipAddr here
    expect(t.jobCreationsProposed).toBe(0);
    expect(t.customerCreationsProposed).toBe(0);
    expect(t.databaseWrites).toBe(0);
  });

  it("all three PDC estimates resolve under a single PDC customer — no duplicate, no merge, no job", () => {
    const rows = [
      planPdc(estimate("2140", "2140", "9132", "PN#132", "Rejected", "2025-03-01"), subCustomer("9132", "PN#132"), false),
      planPdc(estimate("2141", "2141", "9135", "PN#135", "Closed", "2025-04-01"), subCustomer("9135", "PN#135"), false),
      planPdc(estimate("2160", "2160", "9160", "York Ave", "Accepted", "2025-05-01"), subCustomer("9160", "York Ave"), true),
    ];
    expect(new Set(rows.map(r => r.resolvedCrmCustomerId))).toEqual(new Set([9]));
    expect(rows.every(r => r.customerCreationProposed === false)).toBe(true);
    expect(rows.every(r => r.jobAction === "none")).toBe(true);
    expect(summarizeCoverage(rows).customerCreationsProposed).toBe(0);
    expect(summarizeCoverage(rows).jobCreationsProposed).toBe(0);
    expect(summarizeCoverage(rows).databaseWrites).toBe(0);
  });
});

describe("planEstimateOutcome — identity/property safety", () => {
  it("never proposes a Customer from a project/composite-only identity (held for review)", () => {
    // Composite sub with no resolvable parent, no company, no confident name.
    const orphan: QboCustomerLite = { Id: "7000", DisplayName: "PN#500 I I 42 Main St", Job: true };
    const est = estimate("3000", "3000", "7000", "PN#500 I I 42 Main St", "Pending", "2024-01-01");
    const identity = resolveCustomerIdentity(orphan, null);
    const contact = buildContactFromEstimate(est, orphan);
    const row = planEstimateOutcome({ estimate: est, contact, identity, existingDoc: null, match: null, serviceAddressVerified: false, now: NOW });
    expect(row.customerCreationProposed).toBe(false);
    expect(row.salesDocAction).toBe("none");
    expect(row.coverageCategory).toBe("missing_identity_ambiguous");
    expect(row.manualReviewReason).toBeTruthy();
  });

  it("holds a composite-only service location for manual review (property proposal)", () => {
    const sub = subCustomer("9300", "Jobsite I PDC LLC");
    const est = estimate("3100", "3100", "9300", "Jobsite I PDC LLC", "Pending", "2024-06-01");
    const identity = resolveCustomerIdentity(sub, PDC_PARENT);
    const contact = buildContactFromEstimate(est, PDC_PARENT);
    // Service address present but NOT from a verified ShipAddr.
    contact.serviceAddress = { line1: "500 Jobsite Rd", line2: null, city: "Newark", state: "NJ", zip: null };
    const row = planEstimateOutcome({ estimate: est, contact, identity, existingDoc: null, match: { matchedBy: "parent_qbo_id", crmCustomerId: 9 }, serviceAddressVerified: false, now: NOW });
    expect(row.propertyAction).toBe("proposal");
    expect(row.coverageCategory).toBe("missing_property_ambiguous");
  });

  it("creates a Property from a verified ShipAddr", () => {
    const sub = subCustomer("9160", "York Ave I PDC LLC", { Line1: "123 York Ave", City: "Newark", CountrySubDivisionCode: "NJ" });
    const est = estimate("2160", "2160", "9160", "York Ave", "Pending", "2025-05-01");
    const identity = resolveCustomerIdentity(sub, PDC_PARENT);
    const contact = buildContactFromEstimate(est, sub); // sub carries ShipAddr
    const row = planEstimateOutcome({ estimate: est, contact, identity, existingDoc: null, match: { matchedBy: "parent_qbo_id", crmCustomerId: 9 }, serviceAddressVerified: true, now: NOW });
    expect(row.propertyAction).toBe("create");
  });
});

describe("planEstimateOutcome — all statuses link, dry-run writes nothing", () => {
  it.each(["Pending", "Accepted", "Closed", "Rejected"] as const)("status %s remains linked to the customer", (st) => {
    const sub = subCustomer("9135", "PN#135");
    const row = planPdc(estimate("4000", "4000", "9135", "PN#135", st, "2024-02-02"), sub, false);
    expect(row.resolvedCrmCustomerId).toBe(9);
    expect(row.dbWrites).toBe(0);
  });

  it("summarizeCoverage reports zero database writes across a mixed batch", () => {
    const rows: EstimatePlanRow[] = ["Pending", "Accepted", "Closed", "Rejected"].map((st, i) =>
      planPdc(estimate(`50${i}`, `50${i}`, "9135", "PN#135", st, "2024-02-02"), subCustomer("9135", "PN#135"), false),
    );
    expect(summarizeCoverage(rows).databaseWrites).toBe(0);
    expect(summarizeCoverage(rows).total).toBe(4);
  });
});
