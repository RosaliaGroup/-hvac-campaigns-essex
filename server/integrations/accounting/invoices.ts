/**
 * QuickBooks Invoice → CRM sales-document mapping (pure, unit-tested).
 *
 * READ-ONLY ingestion — we NEVER create, modify, void, or delete invoices in
 * QuickBooks. These helpers only translate a QBO Invoice resource into the
 * shape Mechanical CRM mirrors in `quickbooksSalesDocuments` (docType="invoice").
 * No I/O here — every function is deterministic given its inputs (+ injected
 * `now`), mirroring estimates.ts so the whole surface is testable without a DB
 * or network. The only entity queried is `Invoice`.
 */
import type { InsertQuickbooksSalesDocument } from "../../../drizzle/schema";
import { parseQboDate, toQboDateLiteral } from "./estimates";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Treat sub-cent balances as zero when classifying paid/partial. */
const CENT = 0.005;

/** Minimal shape of a QBO Invoice we read from the query API. */
export interface QboInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate?: string; // "YYYY-MM-DD"
  DueDate?: string; // "YYYY-MM-DD"
  TotalAmt?: number;
  Balance?: number;
  CurrencyRef?: { value?: string; name?: string };
  CustomerRef?: { value?: string; name?: string };
  EmailStatus?: string; // "NotSet" | "NeedToSend" | "EmailSent"
  DeliveryInfo?: { DeliveryType?: string; DeliveryTime?: string };
  /** QBO stamps "Voided {date} {user}" here when an invoice is voided. */
  PrivateNote?: string;
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
  [key: string]: unknown;
}

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "void";

/**
 * True when the QBO invoice has been voided. QBO exposes no boolean for this on
 * the Invoice entity; it stamps `PrivateNote` with "Voided …" and zeroes the
 * lines. We detect the note (primary) and the fully-zeroed shape (fallback).
 * (Hard DELETES are invisible to a query and are handled by the backfill/CDC
 * plan, not here.)
 */
export function isVoidedInvoice(inv: QboInvoice): boolean {
  if (/\bvoided\b/i.test(inv.PrivateNote ?? "")) return true;
  return false;
}

/**
 * Derive invoice status from totals/balance. Void takes precedence, then:
 *   balance ≈ 0            → paid
 *   balance ≈ total (>0)   → unpaid
 *   0 < balance < total    → partial
 * "overdue" is a read-time derivation from `dueDate`, not a stored status.
 */
export function deriveInvoiceStatus(inv: QboInvoice): InvoiceStatus {
  if (isVoidedInvoice(inv)) return "void";
  const total = Number(inv.TotalAmt ?? 0);
  const balance = Number(inv.Balance ?? 0);
  if (balance <= CENT) return "paid";
  if (balance >= total - CENT) return "unpaid";
  return "partial";
}

/** Sent timestamp (mirrors estimates): only when QBO EmailStatus = EmailSent. */
export function deriveInvoiceSentAt(inv: QboInvoice): Date | null {
  if (inv.EmailStatus !== "EmailSent") return null;
  return (
    parseQboDate(inv.DeliveryInfo?.DeliveryTime) ??
    parseQboDate(inv.MetaData?.LastUpdatedTime) ??
    parseQboDate(inv.TxnDate)
  );
}

/** Amount collected on an invoice = total − balance (0 for a voided invoice). */
export function invoicePaidAmount(doc: { totalAmount: string | number; balance: string | number | null; voided?: boolean }): number {
  if (doc.voided) return 0;
  const total = Number(doc.totalAmount) || 0;
  const balance = Number(doc.balance ?? 0) || 0;
  return Math.round((total - balance) * 100) / 100;
}

export interface InvoiceQueryOptions {
  cursor?: Date | null;
  sinceDays?: number;
  startPosition?: number;
  pageSize?: number;
  now?: Date;
}

/**
 * Build the QBO query for one page of Invoices — the SAME safe incremental
 * model estimates use: with a cursor → `WHERE MetaData.LastUpdatedTime > cursor`;
 * without → bounded backfill by `TxnDate >= today − sinceDays`. Always ordered
 * by LastUpdatedTime so the (separate) invoice cursor advances monotonically.
 */
export function buildInvoiceQuery(opts: InvoiceQueryOptions = {}): string {
  const { cursor, sinceDays = 60, startPosition = 1, pageSize = 100, now = new Date() } = opts;
  let where: string;
  if (cursor) {
    where = `WHERE MetaData.LastUpdatedTime > '${cursor.toISOString()}'`;
  } else {
    const since = new Date(now.getTime() - sinceDays * DAY_MS);
    where = `WHERE TxnDate >= '${toQboDateLiteral(since)}'`;
  }
  return `SELECT * FROM Invoice ${where} ORDERBY MetaData.LastUpdatedTime STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
}

/**
 * Map a QBO Invoice → the row upserted into quickbooksSalesDocuments.
 * `customerId` and `quickbooksParentRef` are resolved by the orchestrator via
 * the QBO CustomerRef hierarchy and left unset here. Full payload → `raw`.
 */
export function mapInvoiceToSalesDoc(
  inv: QboInvoice,
  realmId: string | null,
  now: Date = new Date(),
): InsertQuickbooksSalesDocument {
  return {
    realmId,
    quickbooksId: String(inv.Id),
    docType: "invoice",
    docNumber: inv.DocNumber ?? null,
    quickbooksCustomerId: inv.CustomerRef?.value ?? null,
    status: deriveInvoiceStatus(inv),
    totalAmount: (inv.TotalAmt ?? 0).toFixed(2),
    balance: (inv.Balance ?? 0).toFixed(2),
    currency: inv.CurrencyRef?.value ?? null,
    txnDate: parseQboDate(inv.TxnDate),
    dueDate: parseQboDate(inv.DueDate),
    sentAt: deriveInvoiceSentAt(inv),
    quickbooksUpdatedAt: parseQboDate(inv.MetaData?.LastUpdatedTime),
    voided: isVoidedInvoice(inv),
    raw: inv as unknown as Record<string, unknown>,
    lastSyncedAt: now,
  };
}

/** Max LastUpdatedTime across a batch — advances the INVOICE cursor. */
export function maxInvoiceUpdatedAt(invoices: QboInvoice[]): Date | null {
  let max: Date | null = null;
  for (const inv of invoices) {
    const d = parseQboDate(inv.MetaData?.LastUpdatedTime);
    if (d && (!max || d.getTime() > max.getTime())) max = d;
  }
  return max;
}

/**
 * A document belongs to a CRM customer when its `customerId` FK points at them,
 * OR its own QBO ref, OR its parent (sub-customer) ref is one of the customer's
 * associated QBO refs. `customer.refs` is the set of the customer's own
 * CustomerRef plus any child project / sub-customer refs. Pure — the single rule
 * Customer 360 uses to reconcile estimates AND invoices to one document set.
 */
export function docMatchesCustomer(
  doc: { customerId: number | null; quickbooksCustomerId: string | null; quickbooksParentRef?: string | null },
  customer: { id: number; refs: Set<string> },
): boolean {
  if (doc.customerId != null && doc.customerId === customer.id) return true;
  if (doc.quickbooksCustomerId && customer.refs.has(doc.quickbooksCustomerId)) return true;
  if (doc.quickbooksParentRef && customer.refs.has(doc.quickbooksParentRef)) return true;
  return false;
}
