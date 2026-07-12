/**
 * Pure serialization + highlight helpers for the admin-only full-history import
 * PREVIEW. Presentation only — no planner logic lives here. Framework-free so it
 * unit-tests without a DOM.
 */

export interface PreviewRow {
  qboEstimateId: string;
  docNumber: string | null;
  status: string;
  qboCustomerName: string | null;
  parentCustomerName: string | null;
  projectReference: string | null;
  resolvedCrmCustomerId: number | null;
  opportunityAction: string;
  propertyAction: string;
  salesDocAction: string;
  confidence: string;
  manualReviewReason: string | null;
  [key: string]: unknown;
}

/** The report columns, in order, exactly as requested. */
export const PREVIEW_COLUMNS: Array<{ header: string; get: (r: PreviewRow) => unknown }> = [
  { header: "Estimate Number", get: (r) => r.docNumber ?? "" },
  { header: "QBO Estimate ID", get: (r) => r.qboEstimateId },
  { header: "Status", get: (r) => r.status },
  { header: "Customer", get: (r) => r.qboCustomerName ?? "" },
  { header: "Parent Customer", get: (r) => r.parentCustomerName ?? "" },
  { header: "CRM Customer", get: (r) => (r.resolvedCrmCustomerId == null ? "" : r.resolvedCrmCustomerId) },
  { header: "Opportunity", get: (r) => r.opportunityAction },
  { header: "Property", get: (r) => r.propertyAction },
  { header: "Planned Action", get: (r) => r.salesDocAction },
  { header: "Confidence", get: (r) => r.confidence },
  { header: "Manual Review Reason", get: (r) => r.manualReviewReason ?? "" },
];

/** RFC-4180-ish CSV field escaping. */
function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize preview rows to a CSV string with the requested columns. */
export function toPreviewCsv(rows: PreviewRow[]): string {
  const header = PREVIEW_COLUMNS.map((c) => csvField(c.header)).join(",");
  const lines = rows.map((r) => PREVIEW_COLUMNS.map((c) => csvField(c.get(r))).join(","));
  return [header, ...lines].join("\r\n");
}

/**
 * Whether a row should be visually highlighted in the report: the named example
 * projects (PN#132, PN#135, York Ave) or any estimate under the PDC LLC parent.
 * Pure presentation — no import/planner behavior is keyed on this.
 */
export function isHighlightedRow(r: PreviewRow): boolean {
  const hay = [r.docNumber, r.qboCustomerName, r.projectReference].filter(Boolean).join(" ").toLowerCase();
  const named = ["pn#132", "pn#135", "pn 132", "pn 135", "york ave"].some((t) => hay.includes(t));
  const pdc = (r.parentCustomerName ?? "").toLowerCase().includes("pdc") || (r.qboCustomerName ?? "").toLowerCase().includes("pdc");
  return named || pdc;
}

/** Rows under the PDC LLC parent (or the named example projects). */
export function pdcHighlights(rows: PreviewRow[]): PreviewRow[] {
  return rows.filter(isHighlightedRow);
}
