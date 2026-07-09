import { describe, it, expect } from "vitest";
import {
  parseQboDate,
  toQboDateLiteral,
  deriveSentAt,
  normalizeEstimateStatus,
  mapDocStatusToStage,
  computeDaysPending,
  mapEstimateToSalesDoc,
  buildContactFromEstimate,
  buildEstimateQuery,
  maxUpdatedAt,
  shouldSkipExistingDoc,
  pickContactMatch,
  type QboEstimate,
  type LocalContactCandidate,
} from "./estimates";
import { normalizePhone } from "../../routers/customers";

const NOW = new Date("2026-07-07T12:00:00.000Z");

function estimate(overrides: Partial<QboEstimate> = {}): QboEstimate {
  return {
    Id: "42",
    DocNumber: "1001",
    TxnDate: "2026-07-01",
    TotalAmt: 2500.5,
    TxnStatus: "Pending",
    EmailStatus: "EmailSent",
    CustomerRef: { value: "77", name: "Acme HVAC" },
    BillEmail: { Address: "billing@acme.test" },
    DeliveryInfo: { DeliveryType: "Email", DeliveryTime: "2026-07-02T09:00:00-04:00" },
    MetaData: { CreateTime: "2026-07-01T08:00:00Z", LastUpdatedTime: "2026-07-02T09:00:00Z" },
    ...overrides,
  };
}

describe("date helpers", () => {
  it("parses and formats QBO dates, tolerating junk", () => {
    expect(parseQboDate("2026-07-01")?.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(parseQboDate(undefined)).toBeNull();
    expect(parseQboDate("not-a-date")).toBeNull();
    expect(toQboDateLiteral(new Date("2026-05-08T23:00:00Z"))).toBe("2026-05-08");
  });
});

describe("deriveSentAt", () => {
  it("uses DeliveryTime when emailed", () => {
    expect(deriveSentAt(estimate())?.toISOString()).toBe("2026-07-02T13:00:00.000Z");
  });
  it("is null when never emailed", () => {
    expect(deriveSentAt(estimate({ EmailStatus: "NeedToSend", DeliveryInfo: undefined }))).toBeNull();
  });
  it("falls back to LastUpdatedTime then TxnDate when EmailSent but no DeliveryTime", () => {
    const e = estimate({ DeliveryInfo: undefined });
    expect(deriveSentAt(e)?.toISOString()).toBe("2026-07-02T09:00:00.000Z");
    const e2 = estimate({ DeliveryInfo: undefined, MetaData: {} });
    expect(deriveSentAt(e2)?.toISOString().slice(0, 10)).toBe("2026-07-01");
  });
});

describe("normalizeEstimateStatus", () => {
  it("maps the QBO statuses", () => {
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Pending" }), NOW)).toBe("pending");
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Accepted" }), NOW)).toBe("accepted");
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Closed" }), NOW)).toBe("closed");
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Rejected" }), NOW)).toBe("rejected");
  });
  it("promotes an expired pending doc to expired", () => {
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Pending", ExpirationDate: "2026-07-01" }), NOW)).toBe("expired");
  });
  it("does NOT expire an already-accepted doc past its expiry", () => {
    expect(normalizeEstimateStatus(estimate({ TxnStatus: "Accepted", ExpirationDate: "2026-01-01" }), NOW)).toBe("accepted");
  });
  it("defaults unknown status to pending", () => {
    expect(normalizeEstimateStatus(estimate({ TxnStatus: undefined }), NOW)).toBe("pending");
  });
});

describe("mapDocStatusToStage", () => {
  it("maps statuses to pipeline stages", () => {
    expect(mapDocStatusToStage("accepted", null)).toBe("won");
    expect(mapDocStatusToStage("closed", null)).toBe("won");
    expect(mapDocStatusToStage("rejected", null)).toBe("lost");
    expect(mapDocStatusToStage("expired", null)).toBe("lost");
    expect(mapDocStatusToStage("pending", new Date())).toBe("pending");
    expect(mapDocStatusToStage("pending", null)).toBe("proposal_sent");
  });
});

describe("computeDaysPending", () => {
  it("counts whole days from sentAt", () => {
    expect(computeDaysPending({ sentAt: new Date("2026-07-02T09:00:00Z"), txnDate: null }, NOW)).toBe(5);
  });
  it("falls back to txnDate and never goes negative", () => {
    expect(computeDaysPending({ sentAt: null, txnDate: new Date("2026-07-06T12:00:00Z") }, NOW)).toBe(1);
    expect(computeDaysPending({ sentAt: new Date("2026-07-10T12:00:00Z"), txnDate: null }, NOW)).toBe(0);
  });
  it("is null with no anchor date", () => {
    expect(computeDaysPending({ sentAt: null, txnDate: null }, NOW)).toBeNull();
  });
});

describe("mapEstimateToSalesDoc", () => {
  it("maps all mirrored fields with 2-dp money and raw snapshot", () => {
    const doc = mapEstimateToSalesDoc(estimate(), "realm-1", NOW);
    expect(doc).toMatchObject({
      realmId: "realm-1",
      quickbooksId: "42",
      docType: "estimate",
      docNumber: "1001",
      quickbooksCustomerId: "77",
      status: "pending",
      totalAmount: "2500.50",
    });
    expect(doc.txnDate?.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(doc.sentAt?.toISOString()).toBe("2026-07-02T13:00:00.000Z");
    expect(doc.quickbooksUpdatedAt?.toISOString()).toBe("2026-07-02T09:00:00.000Z");
    expect(doc.raw).toBeTruthy();
  });
  it("defaults a missing amount to 0.00", () => {
    expect(mapEstimateToSalesDoc(estimate({ TotalAmt: undefined }), null, NOW).totalAmount).toBe("0.00");
  });
});

describe("buildContactFromEstimate", () => {
  it("prefers the full QBO customer, falling back to the estimate", () => {
    const c = buildContactFromEstimate(estimate(), {
      Id: "77",
      DisplayName: "Acme HVAC LLC",
      CompanyName: "Acme HVAC LLC",
      GivenName: "Al",
      FamilyName: "Ace",
      PrimaryEmailAddr: { Address: "al@acme.test" },
      PrimaryPhone: { FreeFormNumber: "862-555-0100" },
      BillAddr: { Line1: "1 Main", City: "Newark", CountrySubDivisionCode: "NJ", PostalCode: "07102" },
    });
    expect(c).toMatchObject({
      quickbooksCustomerId: "77",
      displayName: "Acme HVAC LLC",
      companyName: "Acme HVAC LLC",
      email: "al@acme.test",
      phone: "862-555-0100",
    });
    expect(c.address).toMatchObject({ line1: "1 Main", city: "Newark", state: "NJ", zip: "07102" });
  });
  it("falls back to estimate BillEmail + CustomerRef.name when no customer record", () => {
    const c = buildContactFromEstimate(estimate(), null);
    expect(c.displayName).toBe("Acme HVAC");
    expect(c.email).toBe("billing@acme.test");
    expect(c.address).toBeNull();
  });
});

describe("buildEstimateQuery", () => {
  it("backfills a 60-day window with no cursor", () => {
    const q = buildEstimateQuery({ now: NOW, sinceDays: 60 });
    expect(q).toContain("FROM Estimate WHERE TxnDate >= '2026-05-08'");
    expect(q).toContain("ORDERBY MetaData.LastUpdatedTime STARTPOSITION 1 MAXRESULTS 100");
  });
  it("uses the cursor for incremental pulls", () => {
    const cursor = new Date("2026-07-02T09:00:00.000Z");
    const q = buildEstimateQuery({ cursor, startPosition: 101, pageSize: 50 });
    expect(q).toContain("WHERE MetaData.LastUpdatedTime > '2026-07-02T09:00:00.000Z'");
    expect(q).toContain("STARTPOSITION 101 MAXRESULTS 50");
  });
});

describe("maxUpdatedAt", () => {
  it("returns the latest LastUpdatedTime across a batch", () => {
    const list = [
      estimate({ MetaData: { LastUpdatedTime: "2026-07-01T00:00:00Z" } }),
      estimate({ MetaData: { LastUpdatedTime: "2026-07-05T00:00:00Z" } }),
      estimate({ MetaData: {} }),
    ];
    expect(maxUpdatedAt(list)?.toISOString()).toBe("2026-07-05T00:00:00.000Z");
    expect(maxUpdatedAt([])).toBeNull();
  });
});

describe("shouldSkipExistingDoc (idempotency guard)", () => {
  it("skips when the stored copy is as new or newer", () => {
    const a = new Date("2026-07-05T00:00:00Z");
    const older = new Date("2026-07-01T00:00:00Z");
    expect(shouldSkipExistingDoc({ quickbooksUpdatedAt: a }, { quickbooksUpdatedAt: older })).toBe(true);
    expect(shouldSkipExistingDoc({ quickbooksUpdatedAt: a }, { quickbooksUpdatedAt: a })).toBe(true);
  });
  it("re-processes when the incoming copy is newer", () => {
    expect(
      shouldSkipExistingDoc(
        { quickbooksUpdatedAt: new Date("2026-07-01T00:00:00Z") },
        { quickbooksUpdatedAt: new Date("2026-07-05T00:00:00Z") },
      ),
    ).toBe(false);
  });
  it("re-processes when either side lacks a timestamp", () => {
    expect(shouldSkipExistingDoc({ quickbooksUpdatedAt: null }, { quickbooksUpdatedAt: new Date() })).toBe(false);
    expect(shouldSkipExistingDoc({ quickbooksUpdatedAt: new Date() }, { quickbooksUpdatedAt: null })).toBe(false);
  });
});

describe("pickContactMatch (dedup order email → phone → name)", () => {
  const candidates: LocalContactCandidate[] = [
    { id: 1, email: "match@x.test", phone: null, displayName: "Someone", companyName: null },
    { id: 2, email: null, phone: "(862) 555-0100", displayName: "Phone Person", companyName: null },
    { id: 3, email: null, phone: null, displayName: "Acme HVAC", companyName: "Acme HVAC" },
  ];
  it("prefers email", () => {
    expect(pickContactMatch({ email: "match@x.test", phone: "8625550100", displayName: "Acme HVAC", companyName: null }, candidates, normalizePhone))
      .toEqual({ matchedBy: "email", id: 1 });
  });
  it("falls to phone (last-10-digit) when no email match", () => {
    expect(pickContactMatch({ email: "nope@x.test", phone: "1-862-555-0100", displayName: null, companyName: null }, candidates, normalizePhone))
      .toEqual({ matchedBy: "phone", id: 2 });
  });
  it("falls to name last", () => {
    expect(pickContactMatch({ email: null, phone: null, displayName: null, companyName: "acme hvac" }, candidates, normalizePhone))
      .toEqual({ matchedBy: "name", id: 3 });
  });
  it("returns null when nothing matches", () => {
    expect(pickContactMatch({ email: "x@y.z", phone: "9999999999", displayName: "Nobody", companyName: null }, candidates, normalizePhone)).toBeNull();
  });
});
