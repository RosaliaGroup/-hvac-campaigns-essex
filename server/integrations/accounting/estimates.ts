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
import { parseQboCompositeName } from "../../../shared/qboCompositeName";

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
/** Every value the stored `status` column can hold (estimate + invoice statuses). */
export type StoredDocStatus = SalesDocStatus | "paid" | "partial" | "unpaid" | "void";
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
export function mapDocStatusToStage(status: StoredDocStatus, sentAt: Date | null): OpportunityStage {
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

/** A postal address parsed from a QBO Bill/Ship address. */
export interface ContactAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/** Fields needed to auto-create / enrich a CRM contact from an estimate + its QBO customer. */
export interface EstimateContactInput {
  quickbooksCustomerId: string | null;
  /** The REAL customer name only — a composite QBO name is parsed away, and a
   *  composite we cannot segment confidently is WITHHELD (""), never copied here. */
  displayName: string;
  /** The original, unparsed QBO DisplayName kept for audit / review context. */
  rawDisplayName: string | null;
  /** Project code parsed out of a composite QBO name (e.g. "PN-173-B"); null otherwise. */
  projectReference: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  /** True when this record is a company (companyName resolved). Person fields must be null. */
  isCompany: boolean;
  /**
   * True when the REAL customer name is confidently known (QBO structured name,
   * a resolved company, a high-confidence parsed composite, or a plain
   * non-composite name). False for a composite that could NOT be segmented
   * confidently — the persistence layer must then WITHHOLD the name, not store
   * the raw composite.
   */
  nameConfident: boolean;
  email: string | null;
  phone: string | null;
  /** QBO Mobile → CRM altPhone. */
  mobile: string | null;
  /** QBO Customer.Notes → CRM notes. */
  notes: string | null;
  /** QBO Customer.Active → CRM active/inactive. Null when not returned. */
  active: boolean | null;
  /** QBO Customer.MetaData.LastUpdatedTime — "is the QBO record newer?" cursor. */
  quickbooksUpdatedAt: Date | null;
  /** QBO BillAddr → CRM billing address (stored on customers). */
  address: ContactAddress | null;
  /** QBO ShipAddr → CRM service address (stored as a properties row). */
  serviceAddress: ContactAddress | null;
}

interface QboAddress {
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
}

/** Minimal QBO Customer shape used for contact auto-creation + enrichment. */
export interface QboCustomerLite {
  Id?: string;
  DisplayName?: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  Active?: boolean;
  Notes?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  Mobile?: { FreeFormNumber?: string };
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
  /** True when this is a QBO sub-customer / job (has a parent). */
  Job?: boolean;
  /** Parent customer when this is a sub-customer / job. */
  ParentRef?: { value?: string; name?: string };
}

/**
 * True when the whole string is JUST a project code (e.g. "PN-220-C", "PN#500",
 * "WO 123A") with no customer name after it. main's composite parser needs ≥3
 * " I " segments, so a bare project code parses as non-composite — we must still
 * refuse to name a contact after it.
 */
function looksLikeBareProjectCode(s: string): boolean {
  return /^(?:PN|PROJECT|PROJ|JOB|WO)\s*[#:.\-]?\s*\d+[A-Za-z0-9\-]*\s*$/i.test(s.trim());
}

function mapQboAddress(addr: QboAddress | undefined): ContactAddress | null {
  if (!addr) return null;
  const mapped: ContactAddress = {
    line1: addr.Line1?.trim() || null,
    line2: addr.Line2?.trim() || null,
    city: addr.City?.trim() || null,
    state: addr.CountrySubDivisionCode?.trim() || null,
    zip: addr.PostalCode?.trim() || null,
  };
  // Drop an address with no usable parts.
  return mapped.line1 || mapped.city || mapped.zip ? mapped : null;
}

/**
 * Build the contact fields for auto-creation/enrichment, preferring the full
 * QBO Customer record and falling back to what the estimate itself carries
 * (BillEmail, CustomerRef.name) so we can still create a usable contact if the
 * customer fetch failed.
 */
export function buildContactFromEstimate(e: QboEstimate, customer: QboCustomerLite | null): EstimateContactInput {
  // The QBO-provided name (may be a composite "PN-… I Customer I addr I note").
  const rawName =
    customer?.DisplayName?.trim() ||
    e.CustomerRef?.name?.trim() ||
    [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ").trim() ||
    null;

  // Canonical shared parser (same one main's reviewed repair path trusts).
  const parsed = parseQboCompositeName(rawName);
  const givenName = customer?.GivenName?.trim() || null;
  const familyName = customer?.FamilyName?.trim() || null;
  const hasStructuredName = Boolean(givenName || familyName);

  // Only trust a parsed composite at HIGH confidence (main marks a clean
  // person/company "high"; anything ambiguous stays medium/low and is withheld).
  const useParsed = parsed.isComposite && parsed.confidence === "high";

  // Company: explicit QBO CompanyName, else a confidently-parsed composite company.
  let companyName = customer?.CompanyName?.trim() || null;
  if (!companyName && !hasStructuredName && useParsed && parsed.customerKind === "company") {
    companyName = parsed.companyName;
  }
  const isCompany = Boolean(companyName);

  // A raw string that is JUST a project code is never a real customer name.
  const bareProjectCode = Boolean(rawName) && !parsed.isComposite && looksLikeBareProjectCode(rawName as string);

  // Is the REAL customer name confidently known? A composite we could NOT segment
  // confidently — or a bare project code — is NOT; we must never fall back to
  // storing the raw composite/code as the CRM name.
  const nameConfident =
    !bareProjectCode &&
    (hasStructuredName || isCompany || useParsed || (!parsed.isComposite && Boolean(rawName)));

  // Clean CRM display name. For a low-confidence composite / bare project code we
  // WITHHOLD (""): the persistence layer then falls back to email/phone and flags
  // for review.
  let displayName: string;
  if (isCompany) displayName = companyName as string;
  else if (hasStructuredName) displayName = [givenName, familyName].filter(Boolean).join(" ");
  else if (useParsed) displayName = parsed.customerDisplayName ?? [parsed.firstName, parsed.lastName].filter(Boolean).join(" ");
  else if (!parsed.isComposite && rawName && !bareProjectCode) displayName = rawName;
  else displayName = "";

  // Person first/last: structured wins; else confidently-parsed person parts;
  // NEVER carried on a company record.
  let firstName: string | null;
  let lastName: string | null;
  if (isCompany) {
    firstName = null;
    lastName = null;
  } else if (hasStructuredName) {
    firstName = givenName;
    lastName = familyName;
  } else if (useParsed && parsed.customerKind === "person") {
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  } else {
    firstName = null;
    lastName = null;
  }

  // Service address: prefer an explicit QBO ShipAddr; else the confidently-parsed one.
  const shipAddr = mapQboAddress(customer?.ShipAddr);
  const parsedServiceAddress: ContactAddress | null =
    useParsed && parsed.serviceAddressLine1
      ? {
          line1: parsed.serviceAddressLine1,
          line2: parsed.serviceAddressLine2,
          city: parsed.serviceCity,
          state: parsed.serviceState,
          zip: parsed.servicePostalCode,
        }
      : null;

  return {
    quickbooksCustomerId: e.CustomerRef?.value ?? customer?.Id ?? null,
    displayName,
    rawDisplayName: rawName,
    projectReference: parsed.isComposite ? parsed.projectReference : null,
    firstName,
    lastName,
    companyName,
    isCompany,
    nameConfident,
    email: customer?.PrimaryEmailAddr?.Address?.trim() || e.BillEmail?.Address?.trim() || null,
    phone: customer?.PrimaryPhone?.FreeFormNumber?.trim() || null,
    mobile: customer?.Mobile?.FreeFormNumber?.trim() || null,
    notes: customer?.Notes?.trim() || null,
    active: typeof customer?.Active === "boolean" ? customer.Active : null,
    quickbooksUpdatedAt: parseQboDate(customer?.MetaData?.LastUpdatedTime),
    address: mapQboAddress(customer?.BillAddr),
    serviceAddress: shipAddr ?? parsedServiceAddress,
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
