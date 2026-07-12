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
  /** QBO sub-customer/project flag. A "job" is a sub-customer under a parent. */
  Job?: boolean;
  /** Parent customer reference when this is a sub-customer/project. */
  ParentRef?: { value?: string; name?: string };
}

/**
 * The authoritative identity to use when matching/linking an estimate to a CRM
 * Customer. For a QBO sub-customer/project, the parent Customer is authoritative
 * — we match on the PARENT, never on the project/sub-customer composite name.
 */
export interface ResolvedCustomerIdentity {
  /** True when the estimate's QBO customer is a sub-customer/project. */
  isSubCustomer: boolean;
  /** QBO id we treat as the authoritative Customer (parent's id when a sub). */
  authoritativeQboId: string | null;
  /** The sub-customer's own QBO id (for audit), when applicable. */
  subCustomerQboId: string | null;
  /** Parent QBO id, when this is a sub-customer. */
  parentQboId: string | null;
  /** Parent display name (audit/context only — never used to CREATE a customer). */
  parentName: string | null;
  /** True when the parent could not be fetched/resolved for a flagged sub-customer. */
  parentUnresolved: boolean;
}

/**
 * Determine the authoritative customer identity for an estimate's QBO customer.
 * Pure: `parent` is the already-fetched parent QboCustomerLite (or null).
 *
 * A QBO customer is a sub-customer/project when `Job === true` or it carries a
 * `ParentRef`. In that case the PARENT is authoritative: the estimate must link
 * to the parent's CRM Customer, and identity matching must prefer the parent's
 * QBO id (exact linkage) — NOT incidental email on the sub-customer.
 */
export function resolveCustomerIdentity(
  customer: QboCustomerLite | null,
  parent: QboCustomerLite | null,
): ResolvedCustomerIdentity {
  const subId = customer?.Id ?? null;
  const parentRefId = customer?.ParentRef?.value ?? null;
  const isSub = Boolean(customer && (customer.Job === true || parentRefId));
  if (!isSub) {
    return {
      isSubCustomer: false,
      authoritativeQboId: subId,
      subCustomerQboId: null,
      parentQboId: null,
      parentName: null,
      parentUnresolved: false,
    };
  }
  const resolvedParentId = parent?.Id ?? parentRefId ?? null;
  return {
    isSubCustomer: true,
    // Prefer the parent as the authoritative link. Fall back to the ParentRef id
    // even if the parent record itself could not be fetched.
    authoritativeQboId: resolvedParentId,
    subCustomerQboId: subId,
    parentQboId: resolvedParentId,
    parentName: parent?.DisplayName?.trim() || parent?.CompanyName?.trim() || customer?.ParentRef?.name?.trim() || null,
    // Flagged as a sub-customer but we have neither a fetched parent nor a ParentRef id.
    parentUnresolved: isSub && !resolvedParentId,
  };
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
  /**
   * Full-history coverage mode. When true, the query has NO TxnDate lower bound
   * and does NOT depend on the forward cursor — it selects EVERY Estimate (all
   * statuses, all ages) so old, unchanged estimates that predate both the
   * backfill window and the incremental cursor are still fetched. Pagination and
   * LastUpdatedTime ordering are preserved. Takes precedence over `cursor`.
   */
  fullHistory?: boolean;
}

/**
 * Build the QBO query for one page of Estimates.
 * - full_history → WHERE-less: every Estimate, all statuses, no TxnDate bound,
 *   cursor-independent. This is the coverage-gap fix: incremental (updated>cursor)
 *   and backfill (TxnDate>=window) each miss old unchanged estimates; full_history
 *   catches them.
 * - With a cursor → incremental: WHERE MetaData.LastUpdatedTime > cursor.
 * - Without a cursor → backfill: WHERE TxnDate >= (today − sinceDays).
 * Always ordered by LastUpdatedTime so pagination is stable and any cursor
 * derived from a run advances monotonically.
 */
export function buildEstimateQuery(opts: EstimateQueryOptions = {}): string {
  const { cursor, sinceDays = 60, startPosition = 1, pageSize = 100, now = new Date(), fullHistory = false } = opts;
  let where: string;
  if (fullHistory) {
    // No lower bound: every estimate, every status, independent of the cursor.
    where = "";
  } else if (cursor) {
    where = `WHERE MetaData.LastUpdatedTime > '${cursor.toISOString()}' `;
  } else {
    const since = new Date(now.getTime() - sinceDays * DAY_MS);
    where = `WHERE TxnDate >= '${toQboDateLiteral(since)}' `;
  }
  return `SELECT * FROM Estimate ${where}ORDERBY MetaData.LastUpdatedTime STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
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

// ─── Dry-run coverage planner (pure — no I/O, produces one report row) ───────

export type CoverageCategory =
  | "already_linked"
  | "missing_safe_import"
  | "missing_identity_ambiguous"
  | "missing_property_ambiguous"
  | "duplicate_noop"
  | "manual_review";

export type MatchedBy = "qbo_id" | "parent_qbo_id" | "email" | "phone" | "name";

export interface EstimatePlanInput {
  estimate: QboEstimate;
  /** From buildContactFromEstimate (uses parent identity for a sub-customer). */
  contact: EstimateContactInput;
  /** From resolveCustomerIdentity. */
  identity: ResolvedCustomerIdentity;
  /** The already-mirrored sales-doc row, if any (keyed on QBO estimate id). */
  existingDoc: { id: number; customerId: number | null; quickbooksUpdatedAt?: Date | null } | null;
  /** The CRM customer matched (read-only) for this estimate, if any. */
  match: { matchedBy: MatchedBy; crmCustomerId: number } | null;
  /** True only when the service address came from a verified QBO ShipAddr (not a composite). */
  serviceAddressVerified: boolean;
  now?: Date;
}

export interface EstimatePlanRow {
  qboEstimateId: string;
  docNumber: string | null;
  status: SalesDocStatus;
  txnDate: string | null;
  lastUpdatedTime: string | null;
  qboCustomerRef: string | null;
  parentResolution: string;
  resolvedCrmCustomerId: number | null;
  salesDocAction: "create" | "update" | "none";
  opportunityAction: "create" | "reuse" | "none";
  propertyAction: "create" | "reuse" | "proposal" | "none";
  duplicateResult: "new" | "existing" | "reuse";
  confidence: "high" | "medium" | "low";
  manualReviewReason: string | null;
  jobAction: "none";
  customerCreationProposed: boolean;
  coverageCategory: CoverageCategory;
  /** Dry-run guarantee: always 0. */
  dbWrites: 0;
}

/** Confidence of the identity match. Exact QBO/parent linkage is strongest. */
function matchConfidence(by: MatchedBy): "high" | "medium" | "low" {
  if (by === "qbo_id" || by === "parent_qbo_id") return "high";
  if (by === "email" || by === "phone") return "medium";
  return "low"; // name-only
}

/**
 * Plan the proposed (dry-run) outcome for one estimate. Pure and deterministic;
 * writes nothing. Encodes the coverage-audit rules:
 *  - already-mirrored docs are "already_linked";
 *  - a confident identity (exact QBO/parent linkage, email, or phone) is a safe
 *    import; a name-only match or an unresolved parent is identity-ambiguous;
 *  - a Customer is proposed for creation ONLY from a confident real identity —
 *    NEVER from a project code, composite, or address;
 *  - a Property is created only from a verified service address, else proposed
 *    for manual review;
 *  - Job action is always "none".
 */
export function planEstimateOutcome(input: EstimatePlanInput): EstimatePlanRow {
  const { estimate, contact, identity, existingDoc, match, serviceAddressVerified, now = new Date() } = input;
  const status = normalizeEstimateStatus(estimate, now);
  const incoming = mapEstimateToSalesDoc(estimate, null, now);

  const base = {
    qboEstimateId: String(estimate.Id),
    docNumber: estimate.DocNumber ?? null,
    status,
    txnDate: estimate.TxnDate ?? null,
    lastUpdatedTime: estimate.MetaData?.LastUpdatedTime ?? null,
    qboCustomerRef: estimate.CustomerRef?.value ?? null,
    parentResolution: identity.isSubCustomer
      ? identity.parentUnresolved
        ? `sub-customer ${identity.subCustomerQboId ?? "?"} — PARENT UNRESOLVED`
        : `sub-customer ${identity.subCustomerQboId ?? "?"} → parent ${identity.parentQboId}${identity.parentName ? ` (${identity.parentName})` : ""}`
      : "direct customer (no parent)",
    jobAction: "none" as const,
    dbWrites: 0 as const,
  };

  // 1) Already mirrored → covered. Update only if the incoming copy is newer.
  if (existingDoc) {
    const needsUpdate = !shouldSkipExistingDoc(existingDoc, incoming);
    return {
      ...base,
      resolvedCrmCustomerId: existingDoc.customerId ?? match?.crmCustomerId ?? null,
      salesDocAction: needsUpdate ? "update" : "none",
      opportunityAction: needsUpdate ? "reuse" : "none",
      propertyAction: "none",
      duplicateResult: "existing",
      confidence: "high",
      manualReviewReason: null,
      customerCreationProposed: false,
      coverageCategory: needsUpdate ? "duplicate_noop" : "already_linked",
    };
  }

  // Property proposal: verified ShipAddr → create; composite-only → manual proposal.
  const hasServiceAddress = Boolean(contact.serviceAddress && contact.serviceAddress.line1);
  const propertyAction: EstimatePlanRow["propertyAction"] = hasServiceAddress
    ? serviceAddressVerified
      ? "create"
      : "proposal"
    : "none";

  // 2) Matched an existing CRM customer.
  if (match) {
    const confidence = matchConfidence(match.matchedBy);
    const identityAmbiguous = match.matchedBy === "name" || identity.parentUnresolved;
    const propertyAmbiguous = propertyAction === "proposal";
    const category: CoverageCategory = identityAmbiguous
      ? "missing_identity_ambiguous"
      : propertyAmbiguous
        ? "missing_property_ambiguous"
        : "missing_safe_import";
    return {
      ...base,
      resolvedCrmCustomerId: match.crmCustomerId,
      salesDocAction: "create",
      opportunityAction: "create",
      propertyAction,
      duplicateResult: "new",
      confidence,
      manualReviewReason: identityAmbiguous
        ? identity.parentUnresolved
          ? "sub-customer parent could not be resolved"
          : "matched only by name — low-confidence identity"
        : propertyAmbiguous
          ? "service location only in sub-customer/composite — needs approval"
          : null,
      customerCreationProposed: false,
      coverageCategory: category,
    };
  }

  // 3) No CRM match. May we safely CREATE a Customer? Only from a confident real
  //    identity (company or confidently-known person) — NEVER from a project
  //    code / composite / address / sub-customer name.
  const canCreateCustomer = contact.isCompany || contact.nameConfident;
  if (canCreateCustomer && !identity.parentUnresolved) {
    const propertyAmbiguous = propertyAction === "proposal";
    return {
      ...base,
      resolvedCrmCustomerId: null,
      salesDocAction: "create",
      opportunityAction: "create",
      propertyAction,
      duplicateResult: "new",
      confidence: "medium",
      manualReviewReason: propertyAmbiguous ? "service location only in composite — needs approval" : null,
      customerCreationProposed: true,
      coverageCategory: propertyAmbiguous ? "missing_property_ambiguous" : "missing_safe_import",
    };
  }

  // 4) Low-confidence identity — hold for manual review, never invent a Customer.
  return {
    ...base,
    resolvedCrmCustomerId: null,
    salesDocAction: "none",
    opportunityAction: "none",
    propertyAction: hasServiceAddress ? "proposal" : "none",
    duplicateResult: "new",
    confidence: "low",
    manualReviewReason: identity.parentUnresolved
      ? "sub-customer parent unresolved — cannot link or create"
      : "identity known only from project/composite/address — held for review",
    customerCreationProposed: false,
    coverageCategory: "missing_identity_ambiguous",
  };
}

/** Aggregate plan rows into the report totals required by the coverage audit. */
export interface CoverageTotals {
  total: number;
  alreadyLinked: number;
  missingSafeImport: number;
  missingIdentityAmbiguous: number;
  missingPropertyAmbiguous: number;
  duplicateNoop: number;
  manualReview: number;
  customerCreationsProposed: number;
  jobCreationsProposed: number;
  databaseWrites: number;
}

export function summarizeCoverage(rows: EstimatePlanRow[]): CoverageTotals {
  const t: CoverageTotals = {
    total: rows.length,
    alreadyLinked: 0,
    missingSafeImport: 0,
    missingIdentityAmbiguous: 0,
    missingPropertyAmbiguous: 0,
    duplicateNoop: 0,
    manualReview: 0,
    customerCreationsProposed: 0,
    jobCreationsProposed: 0,
    databaseWrites: 0,
  };
  for (const r of rows) {
    if (r.coverageCategory === "already_linked") t.alreadyLinked++;
    else if (r.coverageCategory === "missing_safe_import") t.missingSafeImport++;
    else if (r.coverageCategory === "missing_identity_ambiguous") t.missingIdentityAmbiguous++;
    else if (r.coverageCategory === "missing_property_ambiguous") t.missingPropertyAmbiguous++;
    else if (r.coverageCategory === "duplicate_noop") t.duplicateNoop++;
    if (r.manualReviewReason) t.manualReview++;
    if (r.customerCreationProposed) t.customerCreationsProposed++;
    t.databaseWrites += r.dbWrites; // always 0
  }
  return t;
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
