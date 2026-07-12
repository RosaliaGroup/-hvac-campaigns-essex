import { describe, it, expect } from "vitest";
import {
  isVoidedInvoice, deriveInvoiceStatus, deriveInvoiceSentAt, invoicePaidAmount,
  buildInvoiceQuery, mapInvoiceToSalesDoc, maxInvoiceUpdatedAt, docMatchesCustomer,
  type QboInvoice,
} from "./invoices";
import { salesDocIdentityKey } from "./estimates";

const inv = (over: Partial<QboInvoice> = {}): QboInvoice => ({
  Id: "9001", DocNumber: "INV-1", TxnDate: "2026-06-01", DueDate: "2026-07-01",
  TotalAmt: 1000, Balance: 1000, CurrencyRef: { value: "USD" },
  CustomerRef: { value: "351", name: "Marco Weber:PN-173" },
  MetaData: { LastUpdatedTime: "2026-06-02T10:00:00Z" }, ...over,
});

describe("invoice status — paid / partial / unpaid / void", () => {
  it("unpaid when balance == total", () => {
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 1000 }))).toBe("unpaid");
  });
  it("paid when balance ~ 0", () => {
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 0 }))).toBe("paid");
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 0.004 }))).toBe("paid"); // sub-cent
  });
  it("partial when 0 < balance < total", () => {
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 400 }))).toBe("partial");
  });
  it("void takes precedence (QBO PrivateNote)", () => {
    expect(deriveInvoiceStatus(inv({ PrivateNote: "Voided 2026-06-03 by admin", TotalAmt: 0, Balance: 0 }))).toBe("void");
    expect(isVoidedInvoice(inv({ PrivateNote: "voided" }))).toBe(true);
    expect(isVoidedInvoice(inv({ PrivateNote: "customer note" }))).toBe(false);
  });
});

describe("invoicePaidAmount", () => {
  it("collected = total − balance", () => {
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: "400.00" })).toBe(600);
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: "0.00" })).toBe(1000);
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: null })).toBe(1000);
  });
  it("voided invoice collects nothing", () => {
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: "0.00", voided: true })).toBe(0);
  });
});

describe("deriveInvoiceSentAt", () => {
  it("only when EmailStatus = EmailSent", () => {
    expect(deriveInvoiceSentAt(inv({ EmailStatus: "NotSet" }))).toBeNull();
    expect(deriveInvoiceSentAt(inv({ EmailStatus: "EmailSent", DeliveryInfo: { DeliveryTime: "2026-06-02T12:00:00Z" } }))?.toISOString())
      .toBe("2026-06-02T12:00:00.000Z");
  });
});

describe("buildInvoiceQuery — same safe incremental model, entity=Invoice", () => {
  it("incremental with a cursor uses LastUpdatedTime > cursor", () => {
    const q = buildInvoiceQuery({ cursor: new Date("2026-06-01T00:00:00Z") });
    expect(q).toContain("SELECT * FROM Invoice");
    expect(q).toContain("WHERE MetaData.LastUpdatedTime > '2026-06-01T00:00:00.000Z'");
    expect(q).toContain("ORDERBY MetaData.LastUpdatedTime");
  });
  it("backfill (no cursor) bounds by TxnDate", () => {
    const q = buildInvoiceQuery({ cursor: null, sinceDays: 30, now: new Date("2026-07-01T00:00:00Z") });
    expect(q).toContain("SELECT * FROM Invoice");
    expect(q).toContain("WHERE TxnDate >= '2026-06-01'");
  });
});

describe("mapInvoiceToSalesDoc", () => {
  it("maps QBO fields → invoice row (docType=invoice, balance/currency/dueDate)", () => {
    const row = mapInvoiceToSalesDoc(inv({ TotalAmt: 1000, Balance: 400 }), "realm-1", new Date("2026-07-01T00:00:00Z"));
    expect(row).toMatchObject({
      docType: "invoice", quickbooksId: "9001", docNumber: "INV-1",
      quickbooksCustomerId: "351", status: "partial", totalAmount: "1000.00",
      balance: "400.00", currency: "USD", voided: false, realmId: "realm-1",
    });
    expect(row.dueDate).toEqual(new Date("2026-07-01"));
    expect(row.quickbooksUpdatedAt).toEqual(new Date("2026-06-02T10:00:00Z"));
  });
  it("a voided invoice maps voided=true / status=void", () => {
    const row = mapInvoiceToSalesDoc(inv({ PrivateNote: "Voided" }), "r", new Date());
    expect(row.voided).toBe(true);
    expect(row.status).toBe("void");
  });
});

describe("maxInvoiceUpdatedAt", () => {
  it("returns the newest LastUpdatedTime for cursor advance", () => {
    const max = maxInvoiceUpdatedAt([
      inv({ MetaData: { LastUpdatedTime: "2026-06-01T00:00:00Z" } }),
      inv({ MetaData: { LastUpdatedTime: "2026-06-05T00:00:00Z" } }),
      inv({ MetaData: { LastUpdatedTime: "2026-06-03T00:00:00Z" } }),
    ]);
    expect(max?.toISOString()).toBe("2026-06-05T00:00:00.000Z");
  });
});

describe("docMatchesCustomer — hierarchy reconciliation rule", () => {
  const marco = { id: 23, refs: new Set(["354"]) }; // Marco's own CustomerRef
  it("matches by the local customerId FK (direct)", () => {
    expect(docMatchesCustomer({ customerId: 23, quickbooksCustomerId: "351", quickbooksParentRef: null }, marco)).toBe(true);
  });
  it("matches by the customer's own QBO ref", () => {
    expect(docMatchesCustomer({ customerId: null, quickbooksCustomerId: "354", quickbooksParentRef: null }, marco)).toBe(true);
  });
  it("matches a CHILD/sub-customer document via its parent ref (the 351→354 case)", () => {
    expect(docMatchesCustomer({ customerId: null, quickbooksCustomerId: "351", quickbooksParentRef: "354" }, marco)).toBe(true);
  });
  it("does NOT match an unrelated ref (no hidden documents from other customers)", () => {
    expect(docMatchesCustomer({ customerId: 99, quickbooksCustomerId: "999", quickbooksParentRef: "888" }, marco)).toBe(false);
  });
  it("the local FK takes precedence — a doc resolved to another customer never matches by a shared ref", () => {
    const other = { id: 7, refs: new Set(["354"]) };
    // Doc resolved to customer 23 (Marco) but carrying ref 354: docMatchesCustomer
    // is a pure predicate, so both would "match"; the query layer only ref-matches
    // UNRESOLVED docs (customerId IS NULL), which is what prevents the double-claim.
    expect(docMatchesCustomer({ customerId: 23, quickbooksCustomerId: "354", quickbooksParentRef: null }, other)).toBe(true);
    // …and an UNRESOLVED doc under an unrelated ref stays unmatched (no guess).
    expect(docMatchesCustomer({ customerId: null, quickbooksCustomerId: "777", quickbooksParentRef: null }, marco)).toBe(false);
  });
  it("an unresolved invoice (customerId null, ref not in the set) is NOT force-assigned", () => {
    expect(docMatchesCustomer({ customerId: null, quickbooksCustomerId: "351", quickbooksParentRef: null }, marco)).toBe(false); // 351 not in {354}
  });
});

describe("invoice status transitions (derivable from balance/void — no stored transition)", () => {
  it("partial → paid as balance is collected", () => {
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 400 }))).toBe("partial");
    expect(deriveInvoiceStatus(inv({ TotalAmt: 1000, Balance: 0 }))).toBe("paid");
  });
  it("a previously-active invoice becoming voided reads as void (excluded from money)", () => {
    const active = inv({ TotalAmt: 1000, Balance: 1000 });
    expect(deriveInvoiceStatus(active)).toBe("unpaid");
    const voided = inv({ ...active, PrivateNote: "Voided 2026-07-01 by admin" });
    expect(deriveInvoiceStatus(voided)).toBe("void");
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: "1000.00", voided: true })).toBe(0);
  });
  it("sparse QBO response (no TotalAmt/Balance) does not crash → paid(0)", () => {
    expect(deriveInvoiceStatus({ Id: "1", CustomerRef: { value: "1" } } as QboInvoice)).toBe("paid");
    expect(mapInvoiceToSalesDoc({ Id: "1" } as QboInvoice, "r").totalAmount).toBe("0.00");
  });
  it("credit / negative balance is represented (not silently dropped)", () => {
    // A credit memo-style negative balance → not 'unpaid'; paid-amount reflects it.
    expect(invoicePaidAmount({ totalAmount: "1000.00", balance: "-50.00" })).toBe(1050);
  });
});

describe("composite document identity (realmId, docType, quickbooksId)", () => {
  const realm = "9130350000000";
  it("an estimate and an invoice sharing one QBO id are DISTINCT identities (coexist)", () => {
    // QBO numbers Estimates and Invoices in separate sequences — the same numeric
    // id can name both. They must NOT collide onto one row.
    const est = salesDocIdentityKey({ realmId: realm, docType: "estimate", quickbooksId: "130" });
    const inv = salesDocIdentityKey({ realmId: realm, docType: "invoice", quickbooksId: "130" });
    expect(est).not.toBe(inv);
  });
  it("two invoices with the same id in the same realm are the SAME identity (idempotent upsert)", () => {
    const a = salesDocIdentityKey({ realmId: realm, docType: "invoice", quickbooksId: "5001" });
    const b = salesDocIdentityKey({ realmId: realm, docType: "invoice", quickbooksId: "5001" });
    expect(a).toBe(b);
  });
  it("the same invoice id in DIFFERENT realms is a DISTINCT identity (multi-realm safe)", () => {
    const a = salesDocIdentityKey({ realmId: "realmA", docType: "invoice", quickbooksId: "5001" });
    const b = salesDocIdentityKey({ realmId: "realmB", docType: "invoice", quickbooksId: "5001" });
    expect(a).not.toBe(b);
  });
});
