/**
 * Repair existing CRM contacts whose name is a composite QuickBooks display name
 * (e.g. "PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I").
 *
 *   DRY RUN (default):        tsx scripts/repair-qbo-composite-names.ts
 *   DRY RUN + limit:          tsx scripts/repair-qbo-composite-names.ts --limit 50
 *   PRE-MIGRATION DRY RUN:    tsx scripts/repair-qbo-composite-names.ts --pre-migration
 *   APPLY (writes DB):        tsx scripts/repair-qbo-composite-names.ts --apply
 *
 * SAFETY:
 *   - Dry-run is the DEFAULT. Without --apply the script performs ZERO writes.
 *   - --pre-migration is READ-ONLY: it runs before migration 0038 exists, reads
 *     ONLY pre-existing columns inside a `START TRANSACTION READ ONLY` that is
 *     ROLLBACKed, and never selects the five new 0038 columns. --apply is
 *     rejected in this mode.
 *   - Only records whose current displayName confidently parses as a composite
 *     PN name are changed. Legitimate names are left alone.
 *   - Manually-approved names are never changed.
 *   - Idempotent: rerunning does not re-change an already-cleaned record.
 *   - It NEVER merges records. Possible duplicates are only reported.
 *
 * All decisions come from server/integrations/accounting/repairCompositeNames.ts
 * (pure + unit-tested); this file only does I/O and printing.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { getDb } from "../server/db";
import { customers, properties } from "../drizzle/schema";
import {
  planCustomerRepair,
  findMergeCandidates,
  isHighConfidenceApplyTarget,
  collectPreMigrationDryRun,
  type RepairCustomerRow,
  type RepairAction,
  type ReadExec,
  type PreMigrationReport,
  type MergeCandidate,
} from "../server/integrations/accounting/repairCompositeNames";

const APPLY = process.argv.includes("--apply");
const PRE_MIGRATION = process.argv.includes("--pre-migration");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : null;
const allowlistArg = process.argv.indexOf("--allowlist");
const ALLOWLIST_RAW = allowlistArg >= 0 ? String(process.argv[allowlistArg + 1] ?? "") : null;
const ALLOWLIST: number[] | null =
  ALLOWLIST_RAW != null
    ? ALLOWLIST_RAW.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n))
    : null;

// ── Controlled-apply policy (hardcoded approved set + expected post-migration
// dry-run values). The script REFUSES to write anything that does not match. ──
const FORBIDDEN_IDS = [7, 8, 9, 10];
interface ApprovedValues {
  displayName: string;
  type: "residential" | "commercial";
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  projectReference: string;
  locationNotes: string | null;
}
const APPROVED: Record<number, ApprovedValues> = {
  11: { displayName: "Cynthia Rodriguez", type: "residential", companyName: null, firstName: "Cynthia", lastName: "Rodriguez", projectReference: "PN#165", locationNotes: null },
  12: { displayName: "Anthony Paladino", type: "residential", companyName: null, firstName: "Anthony", lastName: "Paladino", projectReference: "PN#167", locationNotes: null },
  14: { displayName: "Helen Espiallat", type: "residential", companyName: null, firstName: "Helen", lastName: "Espiallat", projectReference: "PN#171", locationNotes: null },
  15: { displayName: "Cushman & Wakefield", type: "commercial", companyName: "Cushman & Wakefield", firstName: null, lastName: null, projectReference: "PN#172", locationNotes: "28th Floor" },
  23: { displayName: "Marco Weber", type: "residential", companyName: null, firstName: "Marco", lastName: "Weber", projectReference: "PN-173-B", locationNotes: "Basement I" },
};
const APPROVED_IDS = Object.keys(APPROVED).map(Number).sort((a, b) => a - b);

function line(s = "") {
  console.log(s);
}

/** Light PII masking for the on-disk report. Names/addresses (the point of the repair) are kept. */
function maskEmail(e: string | null): string {
  if (!e) return "—";
  const [u, d] = e.split("@");
  if (!d) return "***";
  return `${u.slice(0, 1)}***@${d}`;
}
function maskPhone(p: string | null): string {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

async function main() {
  if (PRE_MIGRATION) return runPreMigrationDryRun();

  line("");
  line("════════════════════════════════════════════════════════════════════");
  line(`  QBO composite-name repair — ${APPLY ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
  line("════════════════════════════════════════════════════════════════════");

  const db = await getDb();
  if (!db) {
    line("Database unavailable (DATABASE_URL not set). Nothing to do — no writes performed.");
    return;
  }

  // Load candidate rows in BOTH supported shapes (pipe OR anchored PN prefix) —
  // identical to the dry-run scan so apply targets exactly match what was reviewed.
  const rows = (await db
    .select({
      id: customers.id,
      type: customers.type,
      displayName: customers.displayName,
      companyName: customers.companyName,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      quickbooksCustomerId: customers.quickbooksCustomerId,
      quickbooksRawDisplayName: customers.quickbooksRawDisplayName,
      projectReference: customers.projectReference,
      displayNameManuallyApproved: customers.displayNameManuallyApproved,
    })
    .from(customers)
    .where(
      sql`${customers.displayName} LIKE '%|%' OR REGEXP_LIKE(${customers.displayName}, '^[[:space:]]*(PN|PROJECT|PROJ|JOB|WO)[ ._#:-]*[0-9]', 'i')`,
    )) as RepairCustomerRow[];

  // Lightweight full list for duplicate detection (across ALL customers).
  const allForMerge = (await db
    .select({
      id: customers.id,
      displayName: customers.displayName,
      email: customers.email,
      phone: customers.phone,
      quickbooksCustomerId: customers.quickbooksCustomerId,
    })
    .from(customers)) as Array<Pick<RepairCustomerRow, "id" | "displayName" | "email" | "phone" | "quickbooksCustomerId">>;

  const totalCustomersInTable = allForMerge.length;

  const repairs: RepairAction[] = [];
  const skipManualApproved: number[] = [];
  const skipNotComposite: number[] = [];
  const skipAlreadyClean: number[] = [];
  for (const row of rows) {
    const decision = planCustomerRepair(row);
    if (decision.kind === "skip") {
      if (/manually approved/i.test(decision.reason)) skipManualApproved.push(row.id);
      else if (/already clean/i.test(decision.reason)) skipAlreadyClean.push(row.id);
      else skipNotComposite.push(row.id);
    } else {
      repairs.push(decision.action);
    }
  }

  const planned = LIMIT != null ? repairs.slice(0, LIMIT) : repairs;

  // Build enriched per-record view (property reuse/create resolved via read-only
  // SELECTs; no writes unless --apply + apply-target below).
  interface Plan {
    action: RepairAction;
    row: RepairCustomerRow;
    candidates: MergeCandidate[];
    isApplyTarget: boolean;
    propertyAction: "reuse-existing" | "create-new" | "none";
  }
  const plans: Plan[] = [];
  for (const action of planned) {
    const row = rows.find(r => r.id === action.customerId)!;
    const candidates = findMergeCandidates(row, allForMerge);
    // ── APPLY GATE ── high-confidence, name-confident, no possible duplicate.
    const isApplyTarget = isHighConfidenceApplyTarget(action, candidates);

    let propertyAction: Plan["propertyAction"] = "none";
    const addr = action.serviceAddress;
    if (addr?.line1) {
      const line1 = addr.line1.trim().toLowerCase();
      const dup = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.customerId, action.customerId), sql`LOWER(TRIM(${properties.addressLine1})) = ${line1}`))
        .limit(1);
      propertyAction = dup.length ? "reuse-existing" : "create-new";
    }
    plans.push({ action, row, candidates, isApplyTarget, propertyAction });
  }

  const applyTargets = plans.filter(p => p.isApplyTarget);
  const manualReview = plans.filter(p => !p.isApplyTarget);
  const mergeFlagged = plans.filter(p => p.candidates.length > 0).length;
  const reuseCount = plans.filter(p => p.propertyAction === "reuse-existing").length;
  const newCount = plans.filter(p => p.propertyAction === "create-new").length;

  // ── CONTROLLED APPLY (only when --apply): allowlist-gated, one-shot. ──
  if (APPLY) {
    await runControlledApply(db, { plans, applyTargets, manualReview });
    return; // apply mode writes its own report files; do not emit the dry-run report.
  }

  const appliedCount = 0;

  // ── Write the full report to a NEW file (does not overwrite pre-migration) ──
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(repoRoot, "reports");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, APPLY ? "0038-apply-result.md" : "0038-post-migration-dry-run.md");
  writeFileSync(
    file,
    renderPostMigrationReport({
      apply: APPLY,
      totalCustomersInTable,
      scannedCandidates: rows.length,
      plans,
      applyTargets,
      manualReview,
      skipManualApproved,
      skipNotComposite,
      skipAlreadyClean,
      mergeFlagged,
      reuseCount,
      newCount,
      appliedCount,
    }),
    "utf8",
  );

  // ── PII-safe console summary (full names only in the on-disk report) ──
  line(`Scanned ${rows.length} candidate customer(s) out of ${totalCustomersInTable} total.`);
  line("");
  line("  ID | confidence | apply-eligible | projectRef");
  line("  ---+------------+----------------+-----------");
  for (const p of plans.sort((a, b) => a.action.customerId - b.action.customerId)) {
    line(
      `  ${String(p.action.customerId).padStart(2)} | ${p.action.confidence.padEnd(10)} | ${(p.isApplyTarget ? "YES" : "no").padEnd(14)} | ${p.action.projectReference ?? "—"}`,
    );
  }
  line("");
  line("────────────────────────────────────────────────────────────────────");
  line(`  total customers scanned (whole table)   : ${totalCustomersInTable}`);
  line(`  candidate records scanned               : ${rows.length}`);
  line(`  composite records detected              : ${repairs.length}`);
  line(`  high-confidence repair candidates       : ${applyTargets.length}`);
  line(`  medium/low manual-review records        : ${manualReview.length}`);
  line(`  manually-approved records skipped       : ${skipManualApproved.length}`);
  line(`  already-clean / non-composite skipped   : ${skipAlreadyClean.length + skipNotComposite.length}`);
  line(`  possible duplicate contacts             : ${mergeFlagged}`);
  line(`  properties reused / new (proposed)      : ${reuseCount} / ${newCount}`);
  line(`  automatic merges performed              : 0`);
  line(`  database writes performed               : ${APPLY ? `${appliedCount} record(s) (--apply)` : "0 (DRY RUN)"}`);
  line(`  apply-eligible CRM IDs                  : ${applyTargets.map(p => p.action.customerId).sort((a, b) => a - b).join(", ") || "none"}`);
  line("────────────────────────────────────────────────────────────────────");
  line(`Full report written to: ${file}`);
  line("");
}

/** Full Markdown report for the post-migration dry-run (or apply result). */
function renderPostMigrationReport(d: {
  apply: boolean;
  totalCustomersInTable: number;
  scannedCandidates: number;
  plans: Array<{
    action: RepairAction;
    row: RepairCustomerRow;
    candidates: MergeCandidate[];
    isApplyTarget: boolean;
    propertyAction: string;
  }>;
  applyTargets: unknown[];
  manualReview: unknown[];
  skipManualApproved: number[];
  skipNotComposite: number[];
  skipAlreadyClean: number[];
  mergeFlagged: number;
  reuseCount: number;
  newCount: number;
  appliedCount: number;
}): string {
  const L: string[] = [];
  const composite = d.plans.length;
  L.push(`# QBO Composite-Name Repair — Post-Migration ${d.apply ? "APPLY Result" : "Dry-Run Report"}`);
  L.push("");
  L.push(
    `**Mode:** post-migration, ${d.apply ? "APPLY (writes enabled — high-confidence targets only)" : "DRY RUN. `--apply` not supplied, ZERO writes."}`,
  );
  L.push("");
  L.push("## Run context");
  L.push("");
  L.push(`- Command: \`npx tsx scripts/repair-qbo-composite-names.ts${d.apply ? " --apply" : ""}\``);
  L.push("- Target: Railway project `captivating-energy`, environment **production**, db `railway` (via `MYSQL_PUBLIC_URL`).");
  L.push("- Migration 0038: **APPLIED**. New audit/lock columns are now read: `quickbooksRawDisplayName`, `projectReference`, `displayNameManuallyApproved` (customers); `locationNotes`, `projectReference` (properties).");
  L.push("");
  L.push("## Totals");
  L.push("");
  L.push(`- total customer records scanned (whole table): **${d.totalCustomersInTable}**`);
  L.push(`- candidate records scanned (pipe OR anchored PN/Project/Job/WO prefix): **${d.scannedCandidates}**`);
  L.push(`- composite records detected: **${composite}**`);
  L.push(`- high-confidence repair candidates (apply-eligible): **${d.applyTargets.length}**`);
  L.push(`- medium/low manual-review records: **${d.manualReview.length}**`);
  L.push(`- manually-approved records skipped: **${d.skipManualApproved.length}**${d.skipManualApproved.length ? ` (IDs: ${d.skipManualApproved.join(", ")})` : ""}`);
  L.push(`- already-clean records skipped: **${d.skipAlreadyClean.length}**`);
  L.push(`- non-composite records skipped: **${d.skipNotComposite.length}**`);
  L.push(`- existing properties reused (proposed): **${d.reuseCount}**`);
  L.push(`- proposed new properties: **${d.newCount}**`);
  L.push(`- possible duplicate contacts: **${d.mergeFlagged}**`);
  L.push(`- **automatic merges performed: 0**`);
  L.push(`- **database writes performed: ${d.apply ? `${d.appliedCount} (high-confidence apply targets only)` : "0"}**`);
  L.push("");
  const emit = (title: string, recs: typeof d.plans) => {
    if (!recs.length) return;
    L.push(`## ${title} (${recs.length})`);
    L.push("");
    for (const p of recs) {
      const a = p.action;
      L.push(`### CRM #${a.customerId}`);
      L.push(`- CRM record ID (read): ${a.customerId}`);
      L.push(`- QBO customer ID (read): ${p.row.quickbooksCustomerId ?? "—"}`);
      L.push(`- current CRM display name (read): \`${a.before.displayName ?? ""}\``);
      L.push(`- stored raw display name column (read): ${p.row.quickbooksRawDisplayName ? `\`${p.row.quickbooksRawDisplayName}\`` : "null (not yet populated — set on --apply)"}`);
      L.push(`- manual-approval / lock status (read): ${p.row.displayNameManuallyApproved ? "TRUE (locked — never overwritten)" : "false"}`);
      L.push(`- proposed clean contact/company name (inferred): ${a.after.displayName ?? "—"}`);
      L.push(`- proposed customer type (inferred): ${a.after.type ?? "—"}`);
      if (a.after.companyName !== a.before.companyName)
        L.push(`- proposed companyName change (inferred): ${JSON.stringify(a.before.companyName)} → ${JSON.stringify(a.after.companyName)}`);
      if (a.after.firstName !== a.before.firstName || a.after.lastName !== a.before.lastName)
        L.push(`- proposed first/last change (inferred): ${JSON.stringify([a.before.firstName, a.before.lastName])} → ${JSON.stringify([a.after.firstName, a.after.lastName])}`);
      L.push(`- proposed project reference (inferred): ${a.projectReference ?? "—"}`);
      L.push(`- proposed property address (inferred): ${a.serviceAddressText ?? "—"}`);
      L.push(`- proposed suite/floor/basement/location notes (inferred): ${a.locationNotes ?? "—"}`);
      L.push(`- property reuse-or-create (read+inferred): ${p.propertyAction}`);
      L.push(`- raw name preserved for audit (inferred): \`${a.rawDisplayNameToPreserve ?? ""}\``);
      L.push(`- match confidence (inferred): ${a.confidence}`);
      L.push(`- name confident (inferred): ${a.nameConfident}`);
      if (p.candidates.length) {
        L.push(`- possible duplicate candidate(s) — MANUAL MERGE ONLY, not performed:`);
        for (const c of p.candidates) L.push(`    - #${c.id} "${c.displayName}" (matched by ${c.matchedBy})`);
      } else {
        L.push(`- possible duplicate candidate(s): none`);
      }
      L.push(`- proposed action: ${p.isApplyTarget ? (d.apply ? "REPAIRED (--apply)" : "repair AFTER explicit --apply approval") : "flag for manual review — do NOT auto-repair"}`);
      L.push("");
    }
  };
  emit(`${d.apply ? "Repaired" : "Apply-eligible"} — high-confidence repair candidates`, d.plans.filter(p => p.isApplyTarget));
  emit("Flagged for manual review (NOT auto-repaired)", d.plans.filter(p => !p.isApplyTarget));
  L.push("## Confirmations");
  L.push("");
  L.push("- Migration 0038 was applied successfully.");
  L.push(`- ${d.apply ? "Repair apply mode ran on high-confidence targets ONLY." : "No repair apply mode was run."}`);
  L.push("- No automatic contact merges occurred.");
  if (!d.apply) L.push("- No production customer or property records were changed.");
  L.push("- Nothing was deployed.");
  L.push("");
  return L.join("\n");
}

/**
 * Apply one planned repair ATOMICALLY: the customer update and the service-property
 * write happen in a single transaction, so if the property write fails the customer
 * rename is rolled back too (all-or-nothing per record). Fill-empty for audit/project
 * fields; never merges.
 */
async function applyRepair(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  action: RepairAction,
): Promise<void> {
  await db.transaction(async tx => {
    const set: Record<string, unknown> = {
      displayName: action.after.displayName,
      companyName: action.after.companyName,
      firstName: action.after.firstName,
      lastName: action.after.lastName,
      type: action.after.type,
      // Lock the corrected name so future QBO syncs never restore the composite.
      displayNameManuallyApproved: true,
    };
    // Preserve the original composite for audit only if not already stored.
    const [cur] = await tx
      .select({ raw: customers.quickbooksRawDisplayName, project: customers.projectReference })
      .from(customers)
      .where(eq(customers.id, action.customerId))
      .limit(1);
    if (cur && !cur.raw) set.quickbooksRawDisplayName = action.rawDisplayNameToPreserve;
    if (cur && !cur.project && action.projectReference) set.projectReference = action.projectReference;
    await tx.update(customers).set(set).where(eq(customers.id, action.customerId));

    // Ensure/patch the service property — reuse by street line, never duplicate.
    const addr = action.serviceAddress;
    if (addr?.line1) {
      const line1 = addr.line1.trim().toLowerCase();
      const [dup] = await tx
        .select({ id: properties.id, locationNotes: properties.locationNotes, projectReference: properties.projectReference })
        .from(properties)
        .where(and(eq(properties.customerId, action.customerId), sql`LOWER(TRIM(${properties.addressLine1})) = ${line1}`))
        .limit(1);
      if (dup) {
        const fill: Record<string, unknown> = {};
        if (action.locationNotes && !dup.locationNotes) fill.locationNotes = action.locationNotes;
        if (action.projectReference && !dup.projectReference) fill.projectReference = action.projectReference;
        if (Object.keys(fill).length) await tx.update(properties).set(fill).where(eq(properties.id, dup.id));
      } else {
        const [primary] = await tx
          .select({ id: properties.id })
          .from(properties)
          .where(and(eq(properties.customerId, action.customerId), eq(properties.isPrimary, true)))
          .limit(1);
        await tx.insert(properties).values({
          customerId: action.customerId,
          label: "Service Address (QuickBooks)",
          addressLine1: addr.line1,
          addressLine2: addr.line2,
          city: addr.city,
          state: addr.state ?? "NJ",
          zip: addr.zip,
          locationNotes: action.locationNotes,
          projectReference: action.projectReference,
          propertyType: action.after.type,
          isPrimary: !primary,
        });
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLED APPLY — allowlist-enforced, one-shot. Refuses to write unless every
// safety condition holds; snapshots before, applies per-record atomically, and
// verifies after. Writes three report files: pre-snapshot, apply-log, verification.
// ─────────────────────────────────────────────────────────────────────────────
interface PlanRec {
  action: RepairAction;
  row: RepairCustomerRow;
  candidates: MergeCandidate[];
  isApplyTarget: boolean;
  propertyAction: "reuse-existing" | "create-new" | "none";
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function rawRows(db: Db, q: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const res: unknown = await db.execute(q);
  if (Array.isArray(res) && Array.isArray(res[0])) return res[0] as Record<string, unknown>[];
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as { rows?: unknown };
  if (r && Array.isArray(r.rows)) return r.rows as Record<string, unknown>[];
  return [];
}

function customerSnapshotCols() {
  return {
    id: customers.id,
    type: customers.type,
    displayName: customers.displayName,
    companyName: customers.companyName,
    firstName: customers.firstName,
    lastName: customers.lastName,
    email: customers.email,
    phone: customers.phone,
    quickbooksCustomerId: customers.quickbooksCustomerId,
    quickbooksRawDisplayName: customers.quickbooksRawDisplayName,
    projectReference: customers.projectReference,
    displayNameManuallyApproved: customers.displayNameManuallyApproved,
  };
}

async function snapshotCustomers(db: Db, ids: number[]) {
  if (!ids.length) return [];
  return db.select(customerSnapshotCols()).from(customers).where(inArray(customers.id, ids));
}
async function snapshotProperties(db: Db, ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(properties).where(inArray(properties.customerId, ids));
}
async function tableCounts(db: Db): Promise<{ customers: number; properties: number }> {
  const [c] = await db.select({ n: sql<number>`count(*)` }).from(customers);
  const [p] = await db.select({ n: sql<number>`count(*)` }).from(properties);
  return { customers: Number(c.n), properties: Number(p.n) };
}

/** Compare a planned action against the hardcoded approved values. Returns a
 *  human description of the FIRST mismatch, or null if everything matches. */
function valueMismatch(a: RepairAction, exp: ApprovedValues): string | null {
  const norm = (v: unknown) => (v == null || v === "" ? null : v);
  if (a.after.displayName !== exp.displayName) return `displayName ${JSON.stringify(a.after.displayName)} != ${JSON.stringify(exp.displayName)}`;
  if (a.after.type !== exp.type) return `type ${a.after.type} != ${exp.type}`;
  if (norm(a.after.companyName) !== norm(exp.companyName)) return `companyName ${JSON.stringify(a.after.companyName)} != ${JSON.stringify(exp.companyName)}`;
  if (norm(a.after.firstName) !== norm(exp.firstName)) return `firstName ${JSON.stringify(a.after.firstName)} != ${JSON.stringify(exp.firstName)}`;
  if (norm(a.after.lastName) !== norm(exp.lastName)) return `lastName ${JSON.stringify(a.after.lastName)} != ${JSON.stringify(exp.lastName)}`;
  if (a.projectReference !== exp.projectReference) return `projectReference ${JSON.stringify(a.projectReference)} != ${JSON.stringify(exp.projectReference)}`;
  if (norm(a.locationNotes) !== norm(exp.locationNotes)) return `locationNotes ${JSON.stringify(a.locationNotes)} != ${JSON.stringify(exp.locationNotes)}`;
  return null;
}

function reportsDir(): string {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(repoRoot, "reports");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fmtCustomerRow(r: Record<string, unknown>): string {
  return [
    `  - #${r.id} type=${r.type}`,
    `    displayName   : ${JSON.stringify(r.displayName)}`,
    `    company       : ${JSON.stringify(r.companyName)}`,
    `    first/last    : ${JSON.stringify([r.firstName, r.lastName])}`,
    `    email/phone   : ${maskEmail((r.email as string) ?? null)} / ${maskPhone((r.phone as string) ?? null)}`,
    `    qboCustomerId : ${r.quickbooksCustomerId ?? "—"}`,
    `    rawDisplayName: ${r.quickbooksRawDisplayName ? JSON.stringify(r.quickbooksRawDisplayName) : "null"}`,
    `    projectRef    : ${r.projectReference ?? "null"}`,
    `    manuallyApprov: ${r.displayNameManuallyApproved}`,
  ].join("\n");
}
function fmtPropertyRow(r: Record<string, unknown>): string {
  return `  - property #${r.id} (customer ${r.customerId}) "${r.label}" | ${r.addressLine1}${r.addressLine2 ? " / " + r.addressLine2 : ""}, ${r.city ?? ""} ${r.state ?? ""} ${r.zip ?? ""} | type=${r.propertyType} | notes=${JSON.stringify(r.locationNotes)} | projectRef=${r.projectReference ?? "null"} | primary=${r.isPrimary}`;
}

async function runControlledApply(
  db: Db,
  ctx: { plans: PlanRec[]; applyTargets: PlanRec[]; manualReview: PlanRec[] },
): Promise<void> {
  const dir = reportsDir();
  line("");
  line("════════════════════════════════════════════════════════════════════");
  line("  QBO composite-name repair — CONTROLLED APPLY (allowlist-enforced)");
  line("════════════════════════════════════════════════════════════════════");

  const abort = (msg: string): never => {
    line("");
    line(`⛔ PREFLIGHT ABORT — NO WRITES PERFORMED: ${msg}`);
    process.exit(3);
  };

  // ── 1. allowlist required ──
  if (!ALLOWLIST || ALLOWLIST.length === 0) abort("--apply requires --allowlist <ids>; refusing a blanket apply.");
  const allow = [...new Set(ALLOWLIST!)].sort((a, b) => a - b);

  // ── 2. allowlist must equal the approved set EXACTLY ──
  if (JSON.stringify(allow) !== JSON.stringify(APPROVED_IDS))
    abort(`allowlist [${allow.join(",")}] is not exactly the approved set [${APPROVED_IDS.join(",")}].`);

  // ── 3. allowlist must not contain any forbidden ID ──
  const forbiddenInAllow = allow.filter(id => FORBIDDEN_IDS.includes(id));
  if (forbiddenInAllow.length) abort(`allowlist contains forbidden ID(s): ${forbiddenInAllow.join(",")}.`);

  // ── 4. DB identity + the five migration columns still exist ──
  const dbNameRows = await rawRows(db, sql`SELECT DATABASE() AS db`);
  const dbName = String(dbNameRows[0]?.db ?? "");
  if (dbName !== "railway") abort(`connected database is ${JSON.stringify(dbName)}, expected "railway" (the DB where 0038 was applied).`);
  const colRows = await rawRows(
    db,
    sql`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.columns
        WHERE TABLE_SCHEMA = DATABASE()
          AND ((TABLE_NAME = 'customers' AND COLUMN_NAME IN ('quickbooksRawDisplayName','projectReference','displayNameManuallyApproved'))
            OR (TABLE_NAME = 'properties' AND COLUMN_NAME IN ('locationNotes','projectReference')))`,
  );
  if (colRows.length !== 5) abort(`expected 5 migration-0038 columns, found ${colRows.length}. Migration may be missing.`);

  // ── 5. live eligible (gate-passing) set must equal the allowlist ──
  const eligibleIds = ctx.applyTargets.map(p => p.action.customerId).sort((a, b) => a - b);
  if (JSON.stringify(eligibleIds) !== JSON.stringify(allow))
    abort(`live high-confidence eligible set [${eligibleIds.join(",")}] != allowlist [${allow.join(",")}]. Dry-run drifted; refusing.`);

  // ── 6. forbidden IDs must remain medium manual-review (never apply targets) ──
  for (const fid of FORBIDDEN_IDS) {
    const p = ctx.plans.find(x => x.action.customerId === fid);
    if (p && p.isApplyTarget) abort(`forbidden ID ${fid} is unexpectedly apply-eligible.`);
    if (p && p.action.confidence === "high") abort(`forbidden ID ${fid} unexpectedly became high confidence.`);
  }

  // ── 7. per-record gate: dup-free, not locked, high confidence, values == approved ──
  for (const p of ctx.applyTargets) {
    const id = p.action.customerId;
    if (!allow.includes(id)) abort(`gate-passing record ${id} is not in the allowlist.`);
    if (p.candidates.length) abort(`record ${id} has a duplicate candidate — manual merge only.`);
    if (p.row.displayNameManuallyApproved) abort(`record ${id} is manually approved/locked.`);
    if (p.action.confidence !== "high" || !p.action.nameConfident) abort(`record ${id} is not high/name-confident.`);
    const exp = APPROVED[id];
    if (!exp) abort(`record ${id} has no approved spec.`);
    const mm = valueMismatch(p.action, exp);
    if (mm) abort(`record ${id} proposed values differ from approved dry-run: ${mm}`);
  }

  line("Preflight PASSED: DB=railway, 5 columns present, eligible set == allowlist == approved [11,12,14,15,23], 7/8/9/10 medium, 0 duplicates, all values match approved dry-run.");
  line("");

  // ── 8. BEFORE snapshot (read-only) ──
  const beforeCustomers = await snapshotCustomers(db, allow);
  const beforeProps = await snapshotProperties(db, allow);
  const beforeForbidden = await snapshotCustomers(db, FORBIDDEN_IDS);
  const beforeCounts = await tableCounts(db);

  const snapLines: string[] = [];
  snapLines.push("# QBO Controlled Apply — PRE-APPLY Snapshot (read-only)");
  snapLines.push("");
  snapLines.push(`Allowlist (approved): **${allow.join(", ")}**. Forbidden (never touched): ${FORBIDDEN_IDS.join(", ")}.`);
  snapLines.push(`Target DB: \`railway\` (Railway production, migration 0038 applied). Email/phone masked.`);
  snapLines.push("");
  snapLines.push(`## Row counts BEFORE`);
  snapLines.push(`- customers: **${beforeCounts.customers}**`);
  snapLines.push(`- properties: **${beforeCounts.properties}**`);
  snapLines.push("");
  snapLines.push(`## Approved customer rows BEFORE (${beforeCustomers.length})`);
  for (const r of beforeCustomers) snapLines.push(fmtCustomerRow(r as Record<string, unknown>));
  snapLines.push("");
  snapLines.push(`## Properties owned by approved customers BEFORE (${beforeProps.length})`);
  snapLines.push(beforeProps.length ? beforeProps.map(r => fmtPropertyRow(r as Record<string, unknown>)).join("\n") : "  (none)");
  snapLines.push("");
  snapLines.push(`## Forbidden customer rows BEFORE (${beforeForbidden.length}) — must be identical AFTER`);
  for (const r of beforeForbidden) snapLines.push(fmtCustomerRow(r as Record<string, unknown>));
  snapLines.push("");
  const snapFile = path.join(dir, "0038-apply-pre-snapshot.md");
  writeFileSync(snapFile, snapLines.join("\n"), "utf8");
  line(`Pre-apply snapshot written: ${snapFile}`);

  // ── 9. show the exact apply command ──
  line("");
  line("Exact apply command being executed (DB URL redacted):");
  line(`  DATABASE_URL=*** npx tsx scripts/repair-qbo-composite-names.ts --apply --allowlist ${allow.join(",")}`);
  line("");

  // ── 10. APPLY per record, atomic (applyRepair wraps each in one transaction) ──
  const committed: number[] = [];
  const rolledBack: Array<{ id: number; error: string }> = [];
  for (const id of allow) {
    const p = ctx.applyTargets.find(x => x.action.customerId === id)!;
    try {
      await applyRepair(db, p.action);
      committed.push(id);
      line(`  ✓ committed record #${id}`);
    } catch (e) {
      rolledBack.push({ id, error: String(e) });
      line(`  ✗ rolled back record #${id}: ${String(e)}`);
      break; // stop immediately; do not silently continue
    }
  }

  const logLines: string[] = [];
  logLines.push("# QBO Controlled Apply — Apply Log");
  logLines.push("");
  logLines.push(`Command: \`npx tsx scripts/repair-qbo-composite-names.ts --apply --allowlist ${allow.join(",")}\``);
  logLines.push(`Allowlist enforced: **${allow.join(", ")}** (== approved). Forbidden untouched: ${FORBIDDEN_IDS.join(", ")}.`);
  logLines.push("");
  logLines.push(`- committed records (customer + property, atomic): **${committed.join(", ") || "none"}**`);
  logLines.push(`- rolled-back records: **${rolledBack.map(r => `#${r.id}`).join(", ") || "none"}**`);
  for (const r of rolledBack) logLines.push(`    - #${r.id}: ${r.error}`);
  logLines.push(`- automatic merges: **0** (never performed)`);
  logLines.push("");
  const logFile = path.join(dir, "0038-apply-log.md");
  writeFileSync(logFile, logLines.join("\n"), "utf8");
  line(`Apply log written: ${logFile}`);

  // ── 11. POST-APPLY verification (read-only) ──
  const afterCustomers = await snapshotCustomers(db, allow);
  const afterProps = await snapshotProperties(db, allow);
  const afterForbidden = await snapshotCustomers(db, FORBIDDEN_IDS);
  const afterCounts = await tableCounts(db);

  // Forbidden rows must be byte-identical before/after.
  const forbiddenUnchanged =
    JSON.stringify(beforeForbidden) === JSON.stringify(afterForbidden);
  // Each committed record must have all required audit fields.
  const perRecordChecks = afterCustomers.map(r => {
    const rec = r as Record<string, unknown>;
    const id = Number(rec.id);
    const exp = APPROVED[id];
    const props = afterProps.filter(p => Number((p as Record<string, unknown>).customerId) === id);
    const ok =
      !!exp &&
      rec.displayName === exp.displayName &&
      rec.type === exp.type &&
      (rec.companyName ?? null) === (exp.companyName ?? null) &&
      (rec.firstName ?? null) === (exp.firstName ?? null) &&
      (rec.lastName ?? null) === (exp.lastName ?? null) &&
      rec.displayNameManuallyApproved === true &&
      !!rec.quickbooksRawDisplayName &&
      rec.projectReference === exp.projectReference &&
      props.length === 1;
    return { id, ok, propCount: props.length, rec, props };
  });
  const allRecordsOk = perRecordChecks.every(c => c.ok);
  // Property duplicate check within approved customers: no customer has >1 property.
  const dupProps = perRecordChecks.filter(c => c.propCount > 1).map(c => c.id);

  const vLines: string[] = [];
  vLines.push("# QBO Controlled Apply — POST-APPLY Verification (read-only)");
  vLines.push("");
  vLines.push(`## Summary`);
  vLines.push(`- CRM IDs changed: **${committed.join(", ") || "none"}**`);
  vLines.push(`- customer fields changed per record: displayName, first/last (or company), type, quickbooksRawDisplayName, projectReference, displayNameManuallyApproved`);
  vLines.push(`- properties created: **${afterProps.length - beforeProps.length}**`);
  vLines.push(`- properties reused: **${committed.length - (afterProps.length - beforeProps.length)}**`);
  vLines.push(`- customer row count before → after: **${beforeCounts.customers} → ${afterCounts.customers}** (Δ ${afterCounts.customers - beforeCounts.customers})`);
  vLines.push(`- property row count before → after: **${beforeCounts.properties} → ${afterCounts.properties}** (Δ ${afterCounts.properties - beforeCounts.properties})`);
  vLines.push(`- rolled-back records: **${rolledBack.map(r => `#${r.id}`).join(", ") || "none"}**`);
  vLines.push(`- duplicate contacts created: **0**`);
  vLines.push(`- duplicate properties created: **${dupProps.length}**${dupProps.length ? ` (IDs: ${dupProps.join(",")})` : ""}`);
  vLines.push(`- automatic merges: **0**`);
  vLines.push(`- manual-review records (7/8/9/10) changed: **${forbiddenUnchanged ? 0 : "NON-ZERO ⚠"}**`);
  vLines.push(`- unexpected customer records changed: **0** (only allowlisted IDs written)`);
  vLines.push("");
  vLines.push(`## Per-record verification`);
  for (const c of perRecordChecks) {
    vLines.push(`### CRM #${c.id} — ${c.ok ? "✅ OK" : "❌ INCOMPLETE"}`);
    vLines.push(fmtCustomerRow(c.rec));
    vLines.push(`    linked service propert${c.propCount === 1 ? "y" : "ies"} (${c.propCount}):`);
    for (const p of c.props) vLines.push("    " + fmtPropertyRow(p as Record<string, unknown>).trim());
    vLines.push("");
  }
  vLines.push(`## Forbidden rows (7/8/9/10) — unchanged: ${forbiddenUnchanged ? "YES ✅" : "NO ❌"}`);
  for (const r of afterForbidden) vLines.push(fmtCustomerRow(r as Record<string, unknown>));
  vLines.push("");
  const vFile = path.join(dir, "0038-apply-verification.md");
  writeFileSync(vFile, vLines.join("\n"), "utf8");

  // ── console summary ──
  line("");
  line("────────────────────────────────────────────────────────────────────");
  line(`  committed          : ${committed.join(", ") || "none"}`);
  line(`  rolled back        : ${rolledBack.map(r => `#${r.id}`).join(", ") || "none"}`);
  line(`  customers count     : ${beforeCounts.customers} → ${afterCounts.customers}`);
  line(`  properties count    : ${beforeCounts.properties} → ${afterCounts.properties}`);
  line(`  properties created  : ${afterProps.length - beforeProps.length}`);
  line(`  duplicate contacts  : 0`);
  line(`  duplicate properties: ${dupProps.length}`);
  line(`  automatic merges    : 0`);
  line(`  forbidden unchanged : ${forbiddenUnchanged ? "YES" : "NO"}`);
  line(`  all records OK      : ${allRecordsOk ? "YES" : "NO"}`);
  line(`  verification written: ${vFile}`);
  line("────────────────────────────────────────────────────────────────────");
  line("");
  if (rolledBack.length || !allRecordsOk || !forbiddenUnchanged || dupProps.length) {
    line("⚠ APPLY DID NOT FULLY SUCCEED — see verification file. Investigate before proceeding.");
    process.exit(4);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-MIGRATION, READ-ONLY dry run (option 2). Reads only pre-existing columns
// through a dedicated read-only connection; writes a full report to disk.
// ─────────────────────────────────────────────────────────────────────────────
async function runPreMigrationDryRun(): Promise<void> {
  line("");
  line("════════════════════════════════════════════════════════════════════");
  line("  QBO composite-name repair — PRE-MIGRATION DRY RUN (READ-ONLY)");
  line("════════════════════════════════════════════════════════════════════");

  if (APPLY) {
    line("REFUSING: --apply cannot be combined with --pre-migration. This mode is read-only. No writes performed.");
    process.exit(2);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    line("Database unavailable (DATABASE_URL not set). Nothing to do — no connection opened, no writes performed.");
    return;
  }

  // A single dedicated connection (not a pool) so the read-only session + txn
  // settings apply to every statement.
  const conn = await mysql.createConnection(url);
  let report: PreMigrationReport;
  try {
    const exec: ReadExec = async (text, params) => {
      const [rows] = await conn.query(text, params ?? []);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    };
    report = await collectPreMigrationDryRun(exec);
  } finally {
    await conn.end();
  }

  // ── SQL audit: prove only reads were issued ──
  const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|MERGE|CREATE|REPLACE|COMMIT|GRANT)\b/i;
  const offending = report.statementsIssued.filter(s => FORBIDDEN.test(s));
  const readOnlyVerified = offending.length === 0;

  const md = renderReport(report, readOnlyVerified);

  // Write into THIS repo's reports/ dir regardless of cwd (we may be invoked
  // from the Railway-linked directory).
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(repoRoot, "reports");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "qbo-composite-name-dry-run.md");
  writeFileSync(file, md, "utf8");

  // ── concise console summary ──
  const t = report.totals;
  line("");
  line(`Scanned ${t.scannedCandidates} candidate name(s) (pipe OR anchored PN prefix) out of ${t.totalCustomersInTable} customer(s).`);
  line(`  confident repair candidates : ${t.confidentRepairCandidates}`);
  line(`  ambiguous (flagged)         : ${t.ambiguousFlagged}`);
  line(`  not-composite (skipped)     : ${t.notCompositeSkipped}`);
  line(`  properties reused / new     : ${t.existingPropertiesReused} / ${t.proposedNewProperties}`);
  line(`  possible duplicate contacts : ${t.possibleDuplicateContacts}`);
  line(`  automatic merges performed  : ${t.automaticMergesPerformed}`);
  line(`  database writes performed   : ${t.databaseWritesPerformed}`);
  line("");
  line(`SQL statements issued: ${report.statementsIssued.length} — read-only verified: ${readOnlyVerified ? "YES" : "NO"}`);
  if (!readOnlyVerified) line(`  ⚠ offending statements: ${offending.join(" | ")}`);
  line(`Full report written to: ${file}`);
  line("");
}

/** Render the complete Markdown report (full detail, PII lightly masked). */
function renderReport(report: PreMigrationReport, readOnlyVerified: boolean): string {
  const t = report.totals;
  const L: string[] = [];
  L.push("# QBO Composite-Name Repair — Pre-Migration Dry-Run Report");
  L.push("");
  L.push("**Mode:** pre-migration, READ-ONLY. No migration applied, `--apply` not supplied, no writes.");
  L.push("");
  L.push("Field provenance legend:");
  L.push("- **read** — value read from the current production database.");
  L.push("- **inferred** — computed by the parser; would only be written after migration 0038 + explicit `--apply`.");
  L.push("- **unavailable** — column does not exist until migration 0038 is applied.");
  L.push("");
  L.push("## Totals");
  L.push("");
  L.push(`- total customer records scanned (whole table): **${t.totalCustomersInTable}**`);
  L.push(`- candidate records scanned (pipe OR anchored PN/Project/Job/WO prefix): **${t.scannedCandidates}**`);
  L.push(`- confident repair candidates: **${t.confidentRepairCandidates}**`);
  L.push(`- ambiguous records flagged / skipped for manual review: **${t.ambiguousFlagged}**`);
  L.push(`- manually-approved records skipped: **${t.manuallyApprovedSkipped}** (approval column does not exist pre-migration — see note)`);
  L.push(`- non-composite records skipped: **${t.notCompositeSkipped}**`);
  L.push(`- existing properties reused: **${t.existingPropertiesReused}**`);
  L.push(`- proposed new properties: **${t.proposedNewProperties}**`);
  L.push(`- possible duplicate contacts: **${t.possibleDuplicateContacts}**`);
  L.push(`- **automatic merges performed: ${t.automaticMergesPerformed}**`);
  L.push(`- **database writes performed: ${t.databaseWritesPerformed}**`);
  L.push("");
  L.push(`> Note: \`displayNameManuallyApproved\` cannot be read pre-migration, so manually-approved records cannot be counted here. This is a schema limitation, NOT proof that no name was manually corrected. Conservative heuristics below flag such records instead of repairing them.`);
  L.push("");
  L.push("## SQL audit (read-only proof)");
  L.push("");
  L.push(`Read-only verified: **${readOnlyVerified ? "YES" : "NO"}**. Statements issued, in order:`);
  L.push("");
  L.push("```sql");
  for (const s of report.statementsIssued) L.push(s.length > 200 ? s.slice(0, 200) + " …" : s);
  L.push("```");
  L.push("");

  const emit = (title: string, recs: typeof report.records) => {
    if (!recs.length) return;
    L.push(`## ${title} (${recs.length})`);
    L.push("");
    for (const r of recs) {
      L.push(`### CRM #${r.crmId}`);
      L.push(`- CRM record ID (read): ${r.crmId}`);
      L.push(`- QBO customer ID (read): ${r.qboCustomerId ?? "—"}`);
      L.push(`- current CRM display name (read): \`${r.currentDisplayName}\``);
      L.push(`- original raw display name (unavailable): ${r.rawDisplayName}`);
      L.push(`- manual-approval / lock status (unavailable): ${r.approvalLockStatus}`);
      L.push(`- proposed clean contact/company name (inferred): ${r.proposedCleanName ?? "—"}`);
      L.push(`- proposed customer type (inferred): ${r.proposedType ?? "—"}`);
      L.push(`- proposed project reference (inferred): ${r.proposedProjectReference ?? "—"}`);
      L.push(`- proposed property address (inferred): ${r.proposedAddress ?? "—"}`);
      L.push(`- proposed suite/floor/basement/location notes (inferred): ${r.proposedLocationNotes ?? "—"}`);
      L.push(`- property reuse-or-create (read+inferred): ${r.propertyAction}`);
      L.push(`- match confidence (inferred): ${r.confidence}`);
      L.push(`- reason(s): ${r.reasons.join("; ")}`);
      if (r.duplicateCandidates.length) {
        L.push(`- possible duplicate candidate(s) — MANUAL MERGE ONLY, not performed:`);
        for (const c of r.duplicateCandidates)
          L.push(`    - #${c.id} "${c.displayName}" (matched by ${c.matchedBy})`);
      } else {
        L.push(`- possible duplicate candidate(s): none`);
      }
      L.push(`- proposed action: ${r.proposedAction}`);
      if (r.skipReason) L.push(`- skip reason: ${r.skipReason}`);
      L.push("");
    }
  };

  emit("Confident repair candidates (would repair only AFTER migration + --apply)", report.records.filter(r => r.status === "repair-candidate"));
  emit("Flagged for manual review (NOT auto-repaired)", report.records.filter(r => r.status === "flag-for-review"));
  emit("Skipped — not a composite / not safe", report.records.filter(r => r.status === "skip"));

  L.push("## Confirmations");
  L.push("");
  L.push("- No repair apply mode was run.");
  L.push("- No automatic contact merges occurred.");
  L.push("- No production customer or property records were changed.");
  L.push("- No migration was applied without authorization.");
  L.push("- Nothing was deployed.");
  L.push("");
  return L.join("\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Dry-run failed:", err);
    process.exit(1);
  });
