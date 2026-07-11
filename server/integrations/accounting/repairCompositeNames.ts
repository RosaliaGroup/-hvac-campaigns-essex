/**
 * Repair planning for existing CRM contacts whose name is a composite QBO
 * display name (pure, unit-tested). The DB-touching CLI lives in
 * scripts/repair-qbo-composite-names.ts; ALL decisions are made here so they can
 * be tested without a database and so dry-run and apply share identical logic.
 *
 * Safety properties enforced by this module:
 *   - Only records whose current displayName confidently parses as a composite
 *     PN name are touched — everything else is SKIPPED.
 *   - A manually-approved name is never changed.
 *   - Planning is idempotent: once a name has been cleaned it no longer parses
 *     as composite, so a rerun skips it.
 *   - It NEVER merges. Possible duplicates are only *reported* for a human.
 */
import { parseQboDisplayName, looksLikeCompanyName, isPlausibleName, type ParsedAddress } from "./qboNameParser";
import { splitName, normalizePhone } from "../../routers/customers";

export interface RepairCustomerRow {
  id: number;
  type: "residential" | "commercial";
  displayName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  quickbooksCustomerId: string | null;
  quickbooksRawDisplayName: string | null;
  projectReference: string | null;
  displayNameManuallyApproved: boolean;
}

export interface RepairAfter {
  displayName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  type: "residential" | "commercial";
}

export interface RepairAction {
  customerId: number;
  before: { displayName: string; companyName: string | null; firstName: string | null; lastName: string | null };
  after: RepairAfter;
  /** Project code to store on the customer + service property (fill-empty only). */
  projectReference: string | null;
  serviceAddress: ParsedAddress | null;
  serviceAddressText: string | null;
  locationNotes: string | null;
  /** Value to store into quickbooksRawDisplayName when it is currently empty. */
  rawDisplayNameToPreserve: string;
  /** Parser segmentation confidence — only "high" may become an auto-repair candidate. */
  confidence: "high" | "medium" | "low";
  /** Which composite format was detected. */
  format: "pipe" | "space" | "none";
  /** True when a safe, plausible customer name was extracted (else we keep the current name). */
  nameConfident: boolean;
}

export type RepairDecision =
  | { kind: "repair"; action: RepairAction }
  | { kind: "skip"; customerId: number; reason: string };

/**
 * Decide what (if anything) to do with one customer row. Pure and idempotent.
 */
export function planCustomerRepair(row: RepairCustomerRow): RepairDecision {
  if (row.displayNameManuallyApproved) {
    return { kind: "skip", customerId: row.id, reason: "display name manually approved — never overwrite" };
  }

  const parsed = parseQboDisplayName(row.displayName);
  if (!parsed.isComposite) {
    return { kind: "skip", customerId: row.id, reason: "name is not a composite PN pattern" };
  }

  const nameConfident = isPlausibleName(parsed.customerName);
  // Classify from the CLEAN parsed name only — NOT the stale firstName/lastName on
  // the corrupted record (those were produced by the old bad split and must not
  // decide company-vs-person).
  const parsedIsCompany = looksLikeCompanyName(parsed.customerName);
  let after: RepairAfter;
  if (!nameConfident) {
    // Composite detected but no safe customer name (e.g. project-only, or an
    // unsafe segmentation). Propose NO rename — keep the current name. The low
    // confidence routes this to manual review; we never name a contact "PN-…".
    after = { displayName: row.displayName, companyName: row.companyName, firstName: row.firstName, lastName: row.lastName, type: row.type };
  } else if (parsedIsCompany) {
    // Company: store the clean org name in companyName, mark commercial, and CLEAR
    // any stale person first/last so they can never later override the company
    // classification.
    const companyName = parsed.customerName;
    after = { displayName: companyName, companyName, firstName: null, lastName: null, type: "commercial" };
  } else if (row.companyName?.trim()) {
    // Parsed name is not company-like, but a curated companyName already exists —
    // keep it (still a company record), and clear stale person fields.
    const companyName = row.companyName.trim();
    after = { displayName: companyName, companyName, firstName: null, lastName: null, type: "commercial" };
  } else {
    // Person: split the CLEAN parsed name; overwrite any stale garbage first/last.
    const { firstName, lastName } = splitName(parsed.customerName);
    after = { displayName: parsed.customerName, companyName: null, firstName, lastName, type: row.type };
  }

  // Nothing would change AND we had a confident name → genuinely already clean, skip.
  if (nameConfident && after.displayName === row.displayName && after.companyName === row.companyName) {
    return { kind: "skip", customerId: row.id, reason: "already clean — no change" };
  }

  // Effective repair confidence. Seed from the parser's own segmentation
  // confidence, then apply the address-tail downgrade HERE (in the core) so the
  // apply gate matches the reviewed dry-run exactly: a composite whose service
  // address parsed without a confident city AND state tail is not safe to
  // auto-apply and is capped at "medium" (→ manual review). (Duplicate-based
  // downgrades stay in isHighConfidenceApplyTarget, which needs the full table.)
  let confidence: "high" | "medium" | "low" = parsed.confidence === "n/a" ? "low" : parsed.confidence;
  if (!nameConfident) confidence = lower(confidence, "low");
  if (parsed.serviceAddressText && (!parsed.serviceAddress || !parsed.serviceAddress.city || !parsed.serviceAddress.state)) {
    confidence = lower(confidence, "medium");
  }

  return {
    kind: "repair",
    action: {
      customerId: row.id,
      before: {
        displayName: row.displayName,
        companyName: row.companyName,
        firstName: row.firstName,
        lastName: row.lastName,
      },
      after,
      projectReference: row.projectReference || parsed.projectReference,
      serviceAddress: parsed.serviceAddress,
      serviceAddressText: parsed.serviceAddressText,
      locationNotes: parsed.locationNotes,
      rawDisplayNameToPreserve: row.quickbooksRawDisplayName || row.displayName,
      confidence,
      format: parsed.format,
      nameConfident,
    },
  };
}

export interface MergeCandidate {
  id: number;
  matchedBy: "quickbooksCustomerId" | "email" | "phone";
  displayName: string;
}

/**
 * The apply gate. A repair may be written ONLY when it is high confidence, has a
 * confidently-extracted name, and has no possible duplicate. This is exactly the
 * "repair-candidate" set surfaced by the dry-run; every medium/low record and any
 * record with a duplicate candidate is excluded and left for manual review.
 */
export function isHighConfidenceApplyTarget(action: RepairAction, duplicateCandidates: MergeCandidate[]): boolean {
  return action.confidence === "high" && action.nameConfident && duplicateCandidates.length === 0;
}

/**
 * Find EXISTING customers that may be the same entity as `target`, matched by
 * QBO customer id → email → normalized phone. Reported to a human as possible
 * manual merges — this function NEVER merges anything.
 */
export function findMergeCandidates(
  target: RepairCustomerRow,
  others: Array<Pick<RepairCustomerRow, "id" | "displayName" | "email" | "phone" | "quickbooksCustomerId">>,
): MergeCandidate[] {
  const out: MergeCandidate[] = [];
  const seen = new Set<number>();
  const qboId = target.quickbooksCustomerId?.trim() || null;
  const emailKey = target.email?.trim().toLowerCase() || null;
  const phoneKey = normalizePhone(target.phone);

  for (const o of others) {
    if (o.id === target.id || seen.has(o.id)) continue;
    let matchedBy: MergeCandidate["matchedBy"] | null = null;
    if (qboId && (o.quickbooksCustomerId?.trim() || null) === qboId) matchedBy = "quickbooksCustomerId";
    else if (emailKey && (o.email?.trim().toLowerCase() || null) === emailKey) matchedBy = "email";
    else if (phoneKey && normalizePhone(o.phone) === phoneKey) matchedBy = "phone";
    if (matchedBy) {
      out.push({ id: o.id, matchedBy, displayName: o.displayName });
      seen.add(o.id);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-MIGRATION, READ-ONLY dry run.
//
// Runs against a database where migration 0038 has NOT been applied, so the five
// new columns do not exist and must not be queried. It reads only pre-existing
// columns, treats every 0038-only value as explicitly "unavailable", and is
// deliberately MORE conservative than the post-migration planner: anything less
// than high confidence is flagged for manual review instead of proposed as a
// repair. It performs NO writes — the orchestrator below only ever issues
// SELECT / SET-READ-ONLY / START-TRANSACTION-READ-ONLY / ROLLBACK.
// ─────────────────────────────────────────────────────────────────────────────

/** The minimal set of EXISTING columns read pre-migration (no 0038 columns). */
export interface PreMigrationRow {
  id: number;
  type: "residential" | "commercial";
  displayName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  quickbooksCustomerId: string | null;
}

export const UNAVAILABLE_RAW = "not available — migration 0038 not applied";
export const UNAVAILABLE_APPROVAL =
  "false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)";

export interface PreMigrationRecord {
  // ── read from the current database ──
  crmId: number;
  qboCustomerId: string | null;
  currentDisplayName: string;
  // ── unavailable because migration 0038 is not applied ──
  rawDisplayName: string;
  approvalLockStatus: string;
  // ── inferred by the parser (would only be written after migration + --apply) ──
  proposedCleanName: string | null;
  proposedType: string | null;
  proposedProjectReference: string | null;
  proposedAddress: string | null;
  proposedAddressLine1: string | null;
  proposedLocationNotes: string | null;
  // ── read + inferred ──
  propertyAction: "reuse-existing" | "create-new" | "none";
  duplicateCandidates: MergeCandidate[];
  // ── assessment ──
  confidence: "high" | "medium" | "low" | "n/a";
  reasons: string[];
  proposedAction: string;
  skipReason: string | null;
  status: "repair-candidate" | "flag-for-review" | "skip";
}

/** Build a full RepairCustomerRow from a pre-migration read, with 0038 fields defaulted. */
export function rowFromPreMigration(r: PreMigrationRow): RepairCustomerRow {
  return {
    ...r,
    quickbooksRawDisplayName: null, // column does not exist yet
    projectReference: null, // column does not exist yet
    displayNameManuallyApproved: false, // column does not exist yet — treated as false
  };
}

const SEVERITY = { high: 3, medium: 2, low: 1 } as const;
function lower(a: "high" | "medium" | "low", b: "high" | "medium" | "low"): "high" | "medium" | "low" {
  return SEVERITY[a] <= SEVERITY[b] ? a : b;
}

/**
 * Assess ONE pre-migration record. Pure. Downgrades to "flag-for-review" (never
 * an auto-repair) on any uncertainty the caller asked us to be careful about.
 * `propertyAction` is left "none" here and resolved by the orchestrator via a
 * read-only property lookup.
 */
export function assessPreMigration(row: PreMigrationRow, duplicateCandidates: MergeCandidate[]): PreMigrationRecord {
  const base = {
    crmId: row.id,
    qboCustomerId: row.quickbooksCustomerId,
    currentDisplayName: row.displayName,
    rawDisplayName: UNAVAILABLE_RAW,
    approvalLockStatus: UNAVAILABLE_APPROVAL,
    duplicateCandidates,
    propertyAction: "none" as const,
  };

  const decision = planCustomerRepair(rowFromPreMigration(row));
  if (decision.kind === "skip") {
    return {
      ...base,
      proposedCleanName: null,
      proposedType: null,
      proposedProjectReference: null,
      proposedAddress: null,
      proposedAddressLine1: null,
      proposedLocationNotes: null,
      confidence: "n/a",
      reasons: [decision.reason],
      proposedAction: `skip — ${decision.reason}`,
      skipReason: decision.reason,
      status: "skip",
    };
  }

  const a = decision.action;
  const reasons: string[] = [];
  // Seed from the parser's own segmentation confidence, then only DOWNGRADE for
  // things the parser cannot know (duplicates, pre-migration limits).
  let confidence: "high" | "medium" | "low" = a.confidence;
  reasons.push(`${a.format}-delimited composite; parser confidence ${a.confidence}`);

  if (!a.nameConfident) {
    reasons.push("no safe customer name extracted — no rename proposed (project-only or unsafe segmentation)");
    confidence = lower(confidence, "low");
  }
  if (a.serviceAddressText && (!a.serviceAddress || !a.serviceAddress.city || !a.serviceAddress.state)) {
    reasons.push("service address parsed without a confident city/state tail");
    confidence = lower(confidence, "medium");
  }
  if (duplicateCandidates.length) {
    const desc = duplicateCandidates.map(c => `#${c.id} (by ${c.matchedBy})`).join(", ");
    reasons.push(`conflicting identity signal(s) — possible duplicate contact(s): ${desc}`);
    confidence = lower(confidence, "medium");
  }
  if (confidence === "high") reasons.push("project code + plausible name + confident address boundary");

  const status: PreMigrationRecord["status"] = confidence === "high" ? "repair-candidate" : "flag-for-review";
  return {
    ...base,
    proposedCleanName: a.after.displayName,
    proposedType: a.after.type,
    proposedProjectReference: a.projectReference,
    proposedAddress: a.serviceAddressText,
    proposedAddressLine1: a.serviceAddress?.line1 ?? null,
    proposedLocationNotes: a.locationNotes,
    confidence,
    reasons,
    proposedAction:
      status === "repair-candidate"
        ? "repair AFTER migration 0038 + explicit --apply approval"
        : "flag for manual review — do NOT auto-repair",
    skipReason: null,
    status,
  };
}

export interface PreMigrationTotals {
  totalCustomersInTable: number;
  scannedCandidates: number;
  confidentRepairCandidates: number;
  ambiguousFlagged: number;
  manuallyApprovedSkipped: number;
  notCompositeSkipped: number;
  existingPropertiesReused: number;
  proposedNewProperties: number;
  possibleDuplicateContacts: number;
  automaticMergesPerformed: number;
  databaseWritesPerformed: number;
}

export interface PreMigrationReport {
  records: PreMigrationRecord[];
  totals: PreMigrationTotals;
  /** Every SQL statement issued, in order — for the "no writes" audit. */
  statementsIssued: string[];
}

/**
 * A read-only SQL executor. The orchestrator calls it ONLY with SELECT and
 * transaction-control statements; it never constructs a write. Injected so the
 * orchestration can be unit-tested without a database.
 */
export type ReadExec = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

/**
 * Drive the whole pre-migration dry run through a read-only executor. Issues a
 * read-only transaction, reads the minimum columns, assesses each record, and
 * resolves property reuse — then ROLLBACKs. Returns a structured report plus the
 * exact list of statements issued (all of which are reads).
 */
export async function collectPreMigrationDryRun(exec: ReadExec): Promise<PreMigrationReport> {
  const statementsIssued: string[] = [];
  const run = async (sql: string, params?: unknown[]) => {
    statementsIssued.push(sql);
    return exec(sql, params);
  };

  await run("SET SESSION TRANSACTION READ ONLY");
  await run("START TRANSACTION READ ONLY");

  // Scan candidates in BOTH supported shapes: pipe-delimited OR a strongly
  // anchored leading PN/Project/Job/WO code (the confirmed space-delimited format).
  // The parser/assessment then classifies each; non-composites are skipped.
  const candidateRows = (await run(
    "SELECT id, type, displayName, companyName, firstName, lastName, email, phone, quickbooksCustomerId FROM customers " +
      "WHERE displayName LIKE '%|%' OR REGEXP_LIKE(displayName, '^[[:space:]]*(PN|PROJECT|PROJ|JOB|WO)[ ._#:-]*[0-9]', 'i')",
  )) as unknown as PreMigrationRow[];

  const allRows = (await run(
    "SELECT id, displayName, email, phone, quickbooksCustomerId FROM customers",
  )) as unknown as Array<Pick<RepairCustomerRow, "id" | "displayName" | "email" | "phone" | "quickbooksCustomerId">>;

  const records: PreMigrationRecord[] = [];
  for (const row of candidateRows) {
    const candidates = findMergeCandidates(rowFromPreMigration(row), allRows);
    const rec = assessPreMigration(row, candidates);
    if (rec.status !== "skip" && rec.proposedAddressLine1) {
      const props = await run("SELECT id, addressLine1 FROM properties WHERE customerId = ?", [row.id]);
      const reuse = props.some(p => norm(p.addressLine1) === norm(rec.proposedAddressLine1));
      rec.propertyAction = reuse ? "reuse-existing" : "create-new";
    }
    records.push(rec);
  }

  await run("ROLLBACK");

  const totals: PreMigrationTotals = {
    totalCustomersInTable: allRows.length,
    scannedCandidates: candidateRows.length,
    confidentRepairCandidates: records.filter(r => r.status === "repair-candidate").length,
    ambiguousFlagged: records.filter(r => r.status === "flag-for-review").length,
    // Cannot be read pre-migration; the approval column does not exist yet.
    manuallyApprovedSkipped: 0,
    notCompositeSkipped: records.filter(r => r.status === "skip").length,
    existingPropertiesReused: records.filter(r => r.propertyAction === "reuse-existing").length,
    proposedNewProperties: records.filter(r => r.propertyAction === "create-new").length,
    possibleDuplicateContacts: records.filter(r => r.duplicateCandidates.length > 0).length,
    automaticMergesPerformed: 0,
    databaseWritesPerformed: 0,
  };

  return { records, totals, statementsIssued };
}
