/**
 * QuickBooks Estimate → CRM sales-document mapping (pure, unit-tested).
 *
 * QuickBooks is the source of truth; these helpers only translate a QBO
 * Estimate resource into the shape Mechanical CRM mirrors. No I/O here — every
 * function is deterministic given its inputs (and an injected `now`), so the
 * whole mapping/query surface is testable without a DB or network.
 *
 * "Proposal" is NOT a distinct QBO entity — proposals are Estimates, so we only
 * ever query the Estimate entity.
 */
import type { InsertQuickbooksSalesDocument } from "../../../drizzle/schema";

/** Minimal shape of a QBO Estimate we read from the query API. */
export interface QboEstimate {
  Id: string;
  DocNumber?: string;
  TxnDate?: string; // "YYYY-MM-DD"
  TotalAmt?: number;
  TxnStatus?: string; // "Pending" | "Accepted" | "Closed" | "Rejected"
  ExpirationDate?: string; // "YYYY-MM-DD"
  EmailStatus?: string; // "NotSet" | "NeedToSend" | "EmailSent"
  CustomerRef?: { value?: string; name?: string };
  BillEmail?: { Address?: string };
  CustomerMemo?: { value?: string };
  DeliveryInfo?: { DeliveryType?: string; DeliveryTime?: string };
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
  [key: string]: unknown;
}

export type SalesDocStatus = "pending" | "accepted" | "closed" | "rejected" | "expired";
export type OpportunityStage = "new" | "proposal_sent" | "pending" | "won" | "lost";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a QBO date/datetime string to a Date, or null when absent/invalid. */
export function parseQboDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date as a QBO query date literal ("YYYY-MM-DD"), UTC. */
export function toQboDateLiteral(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Derive the "sent" timestamp: QBO marks EmailStatus="EmailSent" once the
 * estimate has been emailed. Prefer the actual DeliveryTime, then fall back to
 * the last-updated / txn date. Returns null when it was never sent.
 */
export function deriveSentAt(e: QboEstimate): Date | null {
  if (e.EmailStatus !== "EmailSent") return null;
  return (
    parseQboDate(e.DeliveryInfo?.DeliveryTime) ??
    parseQboDate(e.MetaData?.LastUpdatedTime) ??
    parseQboDate(e.TxnDate)
  );
}

/**
 * Normalize QBO TxnStatus → our status enum, promoting a still-pending doc past
 * its ExpirationDate to "expired".
 */
export function normalizeEstimateStatus(e: QboEstimate, now: Date = new Date()): SalesDocStatus {
  const raw = (e.TxnStatus ?? "Pending").toLowerCase();
  const base: SalesDocStatus =
    raw === "accepted" ? "accepted" : raw === "closed" ? "closed" : raw === "rejected" ? "rejected" : "pending";
  if (base === "pending") {
    const exp = parseQboDate(e.ExpirationDate);
    if (exp && exp.getTime() < now.getTime()) return "expired";
  }
  return base;
}

/** Map a normalized sales-doc status → opportunity pipeline stage. */
export function mapDocStatusToStage(status: SalesDocStatus, sentAt: Date | null): OpportunityStage {
  switch (status) {
    case "accepted":
    case "closed":
      return "won";
    case "rejected":
    case "expired":
      return "lost";
    case "pending":
    default:
      return sentAt ? "pending" : "proposal_sent";
  }
}

/**
 * Whole days a document has been awaiting a decision, measured from when it was
 * sent (or issued, if never emailed). Null when there is no anchor date; never
 * negative.
 */
export function computeDaysPending(
  doc: { sentAt?: Date | null; txnDate?: Date | null },
  now: Date = new Date(),
): number | null {
  const anchor = doc.sentAt ?? doc.txnDate ?? null;
  if (!anchor) return null;
  return Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY_MS));
}

/**
 * Map a QBO Estimate → the row we upsert into quickbooksSalesDocuments.
 * `customerId`/`opportunityId` are resolved later by the orchestrator and left
 * unset here. The full estimate is stashed in `raw` for audit.
 */
export function mapEstimateToSalesDoc(
  e: QboEstimate,
  realmId: string | null,
  now: Date = new Date(),
): InsertQuickbooksSalesDocument {
  const sentAt = deriveSentAt(e);
  const status = normalizeEstimateStatus(e, now);
  return {
    realmId,
    quickbooksId: String(e.Id),
    docType: "estimate",
    docNumber: e.DocNumber ?? null,
    quickbooksCustomerId: e.CustomerRef?.value ?? null,
    status,
    totalAmount: (e.TotalAmt ?? 0).toFixed(2),
    txnDate: parseQboDate(e.TxnDate),
    sentAt,
    expiresAt: parseQboDate(e.ExpirationDate),
    quickbooksUpdatedAt: parseQboDate(e.MetaData?.LastUpdatedTime),
    raw: e as unknown as Record<string, unknown>,
    lastSyncedAt: now,
  };
}

/** Fields needed to auto-create a CRM contact from an estimate + its QBO customer. */
export interface EstimateContactInput {
  quickbooksCustomerId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
}

/** Minimal QBO Customer shape used for contact auto-creation. */
export interface QboCustomerLite {
  Id?: string;
  DisplayName?: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

/**
 * Build the contact fields for auto-creation, preferring the full QBO Customer
 * record and falling back to what the estimate itself carries (BillEmail,
 * CustomerRef.name) so we can still create a usable contact if the customer
 * fetch failed.
 */
export function buildContactFromEstimate(e: QboEstimate, customer: QboCustomerLite | null): EstimateContactInput {
  const displayName =
    customer?.DisplayName?.trim() ||
    e.CustomerRef?.name?.trim() ||
    [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ").trim() ||
    "QuickBooks Customer";
  const addr = customer?.BillAddr;
  return {
    quickbooksCustomerId: e.CustomerRef?.value ?? customer?.Id ?? null,
    displayName,
    firstName: customer?.GivenName?.trim() || null,
    lastName: customer?.FamilyName?.trim() || null,
    companyName: customer?.CompanyName?.trim() || null,
    email: customer?.PrimaryEmailAddr?.Address?.trim() || e.BillEmail?.Address?.trim() || null,
    phone: customer?.PrimaryPhone?.FreeFormNumber?.trim() || null,
    address: addr
      ? {
          line1: addr.Line1?.trim() || null,
          line2: addr.Line2?.trim() || null,
          city: addr.City?.trim() || null,
          state: addr.CountrySubDivisionCode?.trim() || null,
          zip: addr.PostalCode?.trim() || null,
        }
      : null,
  };
}

export interface EstimateQueryOptions {
  /** Incremental cursor: only docs updated strictly after this. */
  cursor?: Date | null;
  /** Backfill window in days when there is no cursor (default 60). */
  sinceDays?: number;
  startPosition?: number;
  pageSize?: number;
  /** Injected clock for deterministic tests. */
  now?: Date;
}

/**
 * Build the QBO query for one page of Estimates.
 * - With a cursor → incremental: WHERE MetaData.LastUpdatedTime > cursor.
 * - Without a cursor → backfill: WHERE TxnDate >= (today − sinceDays).
 * Always ordered by LastUpdatedTime so the cursor advances monotonically.
 */
export function buildEstimateQuery(opts: EstimateQueryOptions = {}): string {
  const { cursor, sinceDays = 60, startPosition = 1, pageSize = 100, now = new Date() } = opts;
  let where: string;
  if (cursor) {
    where = `WHERE MetaData.LastUpdatedTime > '${cursor.toISOString()}'`;
  } else {
    const since = new Date(now.getTime() - sinceDays * DAY_MS);
    where = `WHERE TxnDate >= '${toQboDateLiteral(since)}'`;
  }
  return `SELECT * FROM Estimate ${where} ORDERBY MetaData.LastUpdatedTime STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
}

/**
 * Idempotency guard: skip re-processing an already-mirrored document when our
 * stored copy is as new as (or newer than) the incoming one. Only skips when
 * BOTH sides carry a QBO LastUpdatedTime — otherwise we re-process to be safe.
 */
export function shouldSkipExistingDoc(
  existing: { quickbooksUpdatedAt?: Date | null },
  incoming: { quickbooksUpdatedAt?: Date | null },
): boolean {
  const a = existing.quickbooksUpdatedAt ?? null;
  const b = incoming.quickbooksUpdatedAt ?? null;
  if (!a || !b) return false;
  return a.getTime() >= b.getTime();
}

export interface LocalContactCandidate {
  id: number;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  companyName: string | null;
}

/**
 * Match an incoming contact against existing local customers in priority order
 * email → phone → name (companyName or displayName). `quickbooksCustomerId`
 * matching is handled by the caller via a direct indexed lookup and takes
 * precedence over this. `normalizePhone` is injected to keep this module pure.
 */
export function pickContactMatch(
  input: { email: string | null; phone: string | null; displayName: string | null; companyName: string | null },
  candidates: LocalContactCandidate[],
  normalizePhone: (p: string | null | undefined) => string | null,
): { matchedBy: "email" | "phone" | "name"; id: number } | null {
  const emailKey = input.email?.trim().toLowerCase() || null;
  const phoneKey = normalizePhone(input.phone);
  const nameKey = (input.companyName?.trim() || input.displayName?.trim() || "").toLowerCase() || null;

  if (emailKey) {
    const m = candidates.find(c => (c.email ?? "").trim().toLowerCase() === emailKey);
    if (m) return { matchedBy: "email", id: m.id };
  }
  if (phoneKey) {
    const m = candidates.find(c => normalizePhone(c.phone) === phoneKey);
    if (m) return { matchedBy: "phone", id: m.id };
  }
  if (nameKey) {
    const m = candidates.find(
      c => (c.companyName ?? "").trim().toLowerCase() === nameKey || (c.displayName ?? "").trim().toLowerCase() === nameKey,
    );
    if (m) return { matchedBy: "name", id: m.id };
  }
  return null;
}

/** The maximum LastUpdatedTime across a batch, for advancing the sync cursor. */
export function maxUpdatedAt(estimates: QboEstimate[]): Date | null {
  let max: Date | null = null;
  for (const e of estimates) {
    const d = parseQboDate(e.MetaData?.LastUpdatedTime);
    if (d && (!max || d.getTime() > max.getTime())) max = d;
  }
  return max;
}
