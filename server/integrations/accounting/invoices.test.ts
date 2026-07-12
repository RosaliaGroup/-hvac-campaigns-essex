import { describe, it, expect } from "vitest";
import {
  isVoidedInvoice, deriveInvoiceStatus, deriveInvoiceSentAt, invoicePaidAmount,
  buildInvoiceQuery, mapInvoiceToSalesDoc, maxInvoiceUpdatedAt, docMatchesCustomer,
  type QboInvoice,
} from "./invoices";

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
});
