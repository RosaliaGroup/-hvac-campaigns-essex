/**
 * Work-category classification for the Opportunity Center — PURE + display-only.
 *
 * QuickBooks Estimates/Proposals are mirrored as opportunities. QuickBooks stays
 * the source of truth: nothing here changes the stored QBO document type or the
 * sync behaviour. This module only DERIVES a human "work category" badge shown
 * on the dashboard:
 *
 *   Primary badge (large):  Residential | Commercial | Change Order
 *   Secondary badge (small): the unchanged QBO document type (Estimate / Proposal)
 *
 * `deriveWorkCategory(document, customer)` is the single source of truth for the
 * classification — every UI component calls it instead of re-implementing the
 * rules. Classification is deliberately CONSERVATIVE (see rules below): when a
 * signal is ambiguous we fall back to Residential rather than over-labelling.
 */

export type WorkCategory = "residential" | "commercial" | "change_order";

/** Display label for each category (what the primary badge renders). */
export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
  change_order: "Change Order",
};

export function workCategoryLabel(category: WorkCategory): string {
  return WORK_CATEGORY_LABELS[category];
}

/**
 * The document signals the classifier reads. This is a light, display-oriented
 * shape (not the DB row): callers extract it from a sales document via
 * `extractSalesDocSignals` so the raw QBO payload never has to reach the client.
 */
export interface WorkCategoryDocument {
  /** Unchanged QBO document type, e.g. "estimate". Never mutated here. */
  docType?: string | null;
  docNumber?: string | null;
  /** Free text to scan: customer memo + private note + line descriptions. */
  text?: string | null;
  /** True only when the estimate is reliably linked to an existing job/project. */
  linkedToExistingJob?: boolean | null;
}

/** The customer signals the classifier reads. */
export interface WorkCategoryCustomer {
  /** customers.type — "residential" | "commercial". */
  type?: string | null;
  companyName?: string | null;
  displayName?: string | null;
}

/**
 * CONSERVATIVE change-order patterns. We only flag a Change Order on an
 * unambiguous phrase — never on a bare "change" (which appears innocently in
 * lots of HVAC scopes: "change filter", "no change", "thermostat change").
 */
const CHANGE_ORDER_PATTERNS: RegExp[] = [
  /change[\s-]order/i, // "change order" / "change-order"
  /\bCO\s*#/i, // "CO #" / "CO#" (change-order number)
  /change to existing work/i,
];

/**
 * Rule 1 — Change Order. True when the document text unambiguously references a
 * change order, OR the estimate is reliably linked to an existing job/project.
 * A vague "change" alone must NOT qualify.
 */
export function isChangeOrder(document: WorkCategoryDocument): boolean {
  if (document.linkedToExistingJob === true) return true;
  const haystack = `${document.text ?? ""} ${document.docNumber ?? ""}`;
  return CHANGE_ORDER_PATTERNS.some(re => re.test(haystack));
}

/**
 * Clear corporate/entity or commercial-project signals in a company name.
 * Kept tight so we only promote to Commercial when the name plainly reads as a
 * business, not for every customer that happens to have a company field.
 */
const COMMERCIAL_NAME_PATTERN =
  /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|corp|corp\.|corporation|ltd|llp|pllc|plc|company|enterprises?|industries|holdings|properties|realty|management|construction|contractors?|developers?|hospital|school|university|church|municipal|borough|township|county)\b/i;

/**
 * Rule 2 — Commercial. True when the customer is typed commercial, or the
 * company name clearly indicates a commercial company/project.
 */
export function isCommercial(customer: WorkCategoryCustomer): boolean {
  if ((customer.type ?? "").trim().toLowerCase() === "commercial") return true;
  const company = (customer.companyName ?? "").trim();
  if (company && COMMERCIAL_NAME_PATTERN.test(company)) return true;
  return false;
}

/**
 * THE single classifier. Priority: Change Order → Commercial → Residential.
 * Pure and deterministic; safe to call on both server and client.
 */
export function deriveWorkCategory(
  document: WorkCategoryDocument,
  customer: WorkCategoryCustomer,
): WorkCategory {
  if (isChangeOrder(document)) return "change_order";
  if (isCommercial(customer)) return "commercial";
  return "residential";
}

/**
 * Secondary badge — the UNCHANGED QuickBooks document type. QBO has no distinct
 * "Proposal" entity (proposals are Estimates), so we render "Proposal" only when
 * the document text explicitly says so; otherwise the QBO type ("estimate") is
 * shown title-cased.
 */
export function deriveDocTypeLabel(document: WorkCategoryDocument): string {
  const text = document.text ?? "";
  if ((document.docType ?? "estimate").toLowerCase() === "estimate" && /\bproposal\b/i.test(text)) {
    return "Proposal";
  }
  const t = (document.docType ?? "estimate").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Estimate";
}

/** Raw QBO estimate fields we read to build classifier signals (all optional). */
interface RawEstimateLike {
  DocNumber?: unknown;
  CustomerMemo?: { value?: unknown } | null;
  PrivateNote?: unknown;
  Line?: Array<{ Description?: unknown }> | null;
  LinkedTxn?: unknown;
  [key: string]: unknown;
}

/**
 * Extract the light classifier signals from a stored sales document. Keeps the
 * raw-payload parsing in ONE place so the server can attach compact signals to
 * list rows (and never ship the whole QBO payload to the browser).
 *
 * `linkedToExistingJob` is deliberately CONSERVATIVE: a QBO Estimate's
 * `LinkedTxn` normally points to the Invoice(s) it was billed into, which means
 * the estimate was *accepted/invoiced* — NOT that it is a change order to an
 * existing job. So billing links (Invoice/Payment/CreditMemo/SalesReceipt/
 * RefundReceipt) are ignored; only a non-billing linked transaction counts as a
 * reliable existing-job/project link. This avoids flagging every invoiced
 * estimate as a Change Order.
 */
const BILLING_LINK_TYPES = new Set(["invoice", "payment", "creditmemo", "salesreceipt", "refundreceipt"]);

export function extractSalesDocSignals(raw: unknown): {
  text: string;
  linkedToExistingJob: boolean;
} {
  let e: RawEstimateLike | null = null;
  if (typeof raw === "string") {
    try {
      e = JSON.parse(raw) as RawEstimateLike;
    } catch {
      e = null;
    }
  } else if (raw && typeof raw === "object") {
    e = raw as RawEstimateLike;
  }
  if (!e) return { text: "", linkedToExistingJob: false };

  const parts: string[] = [];
  const memo = e.CustomerMemo && typeof e.CustomerMemo === "object" ? e.CustomerMemo.value : undefined;
  if (typeof memo === "string") parts.push(memo);
  if (typeof e.PrivateNote === "string") parts.push(e.PrivateNote);
  if (typeof e.DocNumber === "string") parts.push(e.DocNumber);
  if (Array.isArray(e.Line)) {
    for (const line of e.Line) {
      if (line && typeof line.Description === "string") parts.push(line.Description);
    }
  }
  const linkedToExistingJob =
    Array.isArray(e.LinkedTxn) &&
    e.LinkedTxn.some(l => {
      const type =
        l && typeof l === "object" && "TxnType" in l ? String((l as { TxnType?: unknown }).TxnType ?? "") : "";
      const t = type.trim().toLowerCase();
      return t !== "" && !BILLING_LINK_TYPES.has(t);
    });
  return { text: parts.join(" · "), linkedToExistingJob };
}
