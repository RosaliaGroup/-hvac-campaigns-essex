import { describe, it, expect } from "vitest";
import { toPreviewCsv, isHighlightedRow, pdcHighlights, PREVIEW_COLUMNS, type PreviewRow } from "./qboPreviewCsv";

function row(over: Partial<PreviewRow> = {}): PreviewRow {
  return {
    qboEstimateId: "2140", docNumber: "2140", status: "rejected",
    qboCustomerName: "PN#132 I PDC LLC", parentCustomerName: "PDC LLC", projectReference: "PN#132",
    resolvedCrmCustomerId: 9, opportunityAction: "create", propertyAction: "none", salesDocAction: "create",
    confidence: "high", manualReviewReason: null, ...over,
  };
}

describe("qboPreviewCsv", () => {
  it("emits the requested columns in order with a header row", () => {
    const csv = toPreviewCsv([row()]);
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("Estimate Number,QBO Estimate ID,Status,Customer,Parent Customer,CRM Customer,Opportunity,Property,Planned Action,Confidence,Manual Review Reason");
    expect(PREVIEW_COLUMNS).toHaveLength(11);
    expect(line.startsWith("2140,2140,rejected,")).toBe(true);
    expect(line).toContain("PDC LLC");
    expect(line).toContain(",9,"); // CRM customer id
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = toPreviewCsv([row({ manualReviewReason: 'matched by name, "low" confidence' })]);
    expect(csv).toContain('"matched by name, ""low"" confidence"');
  });

  it("renders an empty CRM customer as blank (no 'null')", () => {
    const csv = toPreviewCsv([row({ resolvedCrmCustomerId: null })]);
    expect(csv).not.toContain("null");
  });

  it("highlights the named example projects and PDC LLC estimates", () => {
    expect(isHighlightedRow(row({ projectReference: "PN#132" }))).toBe(true);
    expect(isHighlightedRow(row({ docNumber: "2141", projectReference: "PN#135", qboCustomerName: "PN#135" }))).toBe(true);
    expect(isHighlightedRow(row({ qboCustomerName: "York Ave", projectReference: null, parentCustomerName: null }))).toBe(true);
    expect(isHighlightedRow(row({ parentCustomerName: "PDC LLC", qboCustomerName: "Anything" }))).toBe(true);
    expect(isHighlightedRow(row({ qboCustomerName: "Jane Doe", parentCustomerName: null, projectReference: null, docNumber: "9" }))).toBe(false);
  });

  it("pdcHighlights returns only the PDC/named rows", () => {
    const rows = [
      row({ qboEstimateId: "2140", parentCustomerName: "PDC LLC" }),
      row({ qboEstimateId: "9999", qboCustomerName: "Other Co", parentCustomerName: "Other Co", projectReference: null, docNumber: "9999" }),
    ];
    expect(pdcHighlights(rows).map(r => r.qboEstimateId)).toEqual(["2140"]);
  });
});
