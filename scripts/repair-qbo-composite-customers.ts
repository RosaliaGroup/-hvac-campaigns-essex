/**
 * repair-qbo-composite-customers.ts
 *
 * TWO modes, dry-run by default in BOTH:
 *
 * 1. SCAN (default) — reports the before → after repair plan for composite
 *    DisplayNames. Strictly SELECT-only. Requires `--prod-read-ack`.
 *      pnpm exec tsx scripts/repair-qbo-composite-customers.ts --prod-read-ack \
 *          [--limit N] [--customer-id ID] [--qbo-id ID] [--json out.json]
 *
 * 2. APPLY (manifest-driven) — entered with `--manifest <path>`. Runs the
 *    reviewed repair over ONLY the rows in the manifest, via applyRepairRow()
 *    which re-reads, re-parses, verifies the QBO id, verifies the expected
 *    DisplayName (stale check), re-checks duplicates, and skips anything that
 *    differs. Each customer is committed in its own transaction and every field
 *    change is written to qboRepairAuditLog.
 *
 *      • Manifest present but WITHOUT the full write acknowledgement → dry-run:
 *        prints "would_apply" with zero writes.
 *      • A real write requires ALL of:
 *          --apply --prod-write-ack --manifest <path> --run-id <value>
 *          --confirm "APPLY_QBO_REPAIR_<COUNT>"
 *        where <COUNT> must equal the number of manifest rows. Any missing flag,
 *        wrong count, or wrong token aborts before a single write.
 *
 * Safety: emails/phones are redacted in scan output. Never touches estimates,
 * invoices, billing addresses, QBO ids, or any sync cursor.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { parseQboCompositeName } from "../shared/qboCompositeName";
import {
  proposeMerge,
  proposePropertyAction,
  normalizeEmail,
  normalizePhone,
  type CustomerIdentity,
  type PropertyRow,
} from "../shared/qboCustomerRepair";
import { applyRepairRow, type ManifestRow, type RowResult } from "../server/integrations/accounting/qboRepairCore";
import { connect, makeRepairPort } from "./qboRepairDb";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

// ── Mode 2: manifest-driven apply (dry-run unless fully acknowledged) ─────────
async function runApply(manifestPath: string): Promise<void> {
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as { manifestVersion: string; parserVersion: string; rows: ManifestRow[] };
  const manifestHash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const rows = manifest.rows;
  const count = rows.length;

  // Integrity gate: if a hash is asserted it MUST match the file on disk. This
  // catches a silently-edited manifest in any mode, before touching the DB.
  const assertedHash = val("--manifest-hash");
  if (assertedHash && assertedHash !== manifestHash) {
    console.error(`REFUSED: --manifest-hash ${assertedHash} != computed ${manifestHash}. Manifest changed since review. Aborting before any DB access.`);
    process.exit(2);
  }

  // Determine whether this is a real write or a dry-run. A write requires the
  // full flag set INCLUDING an asserted, matching manifest hash.
  const fullyAcked = has("--apply") && has("--prod-write-ack") && has("--run-id") && has("--confirm") && has("--manifest-hash");
  let dryRun = true;
  if (fullyAcked) {
    const confirm = val("--confirm");
    const expected = `APPLY_QBO_REPAIR_${count}`;
    if (confirm !== expected) {
      console.error(`REFUSED: --confirm must be exactly "${expected}" (got ${JSON.stringify(confirm)}). Aborting before any write.`);
      process.exit(2);
    }
    dryRun = false;
  } else if (has("--apply")) {
    console.error("REFUSED: --apply requires ALL of --prod-write-ack --run-id <v> --manifest-hash <h> --confirm \"APPLY_QBO_REPAIR_<COUNT>\". Aborting before any write.");
    process.exit(2);
  }

  const runId = val("--run-id") ?? `dryrun-${manifestHash}`;
  const actor = process.env.USER || process.env.USERNAME || "cli";
  console.log(`APPLY mode — manifest ${manifest.manifestVersion} (hash ${manifestHash}), rows=${count}, parserVersion=${manifest.parserVersion}`);
  console.log(`  runId=${runId}  mode=${dryRun ? "DRY-RUN (no writes)" : "WRITE (--prod-write-ack)"}\n`);

  const conn = await connect();
  const port = makeRepairPort(conn);
  const results: RowResult[] = [];
  try {
    for (const m of rows) {
      const res = await applyRepairRow(port, m, { runId, actor, manifestHash, dryRun });
      results.push(res);
      const chg = res.changes.map(c => c.field).join(",") || "-";
      console.log(`  CRM #${res.customerId}  ${res.result.toUpperCase()}  ${res.reason}  fields=[${chg}]${res.createdPropertyId ? ` property#${res.createdPropertyId}` : ""}`);
    }
  } finally {
    await conn.end();
  }
  const tally = results.reduce((a, r) => { a[r.result] = (a[r.result] ?? 0) + 1; return a; }, {} as Record<string, number>);
  console.log(`\n================ APPLY TOTALS ================`);
  for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}`);
  console.log(`\nMODE: ${dryRun ? "DRY-RUN — no rows modified." : "WRITE — changes committed per-customer and audited."}`);

  // Redacted, deterministic artifact (manifest order). Repair fields carry no
  // emails/phones/tokens; nothing sensitive is written. --json opt-in only.
  const jsonOut = val("--json");
  if (jsonOut) {
    const artifact = {
      manifestVersion: manifest.manifestVersion,
      manifestHash,
      parserVersion: manifest.parserVersion,
      mode: dryRun ? "dry-run" : "write",
      manifestRowsChecked: count,
      tally,
      candidates: results.map(r => ({
        crmCustomerId: r.customerId,
        result: r.result,
        reason: r.reason,
        createdPropertyId: r.createdPropertyId ?? null,
        changes: r.changes.map(c => ({ field: c.field, before: c.before, after: c.after })),
      })),
    };
    fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
    console.log(`\nRedacted manifest-verification artifact written: ${jsonOut}`);
  }
}

const LIMIT = Number(val("--limit") ?? "500");
const FILTER_CUSTOMER = val("--customer-id");
const FILTER_QBO = val("--qbo-id");
const JSON_OUT = val("--json");

function redactEmail(e: string | null): string | null {
  if (!e) return e;
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
}
function redactPhone(p: string | null): string | null {
  const d = (p ?? "").replace(/[^0-9]/g, "");
  return d ? `***${d.slice(-4)}` : p;
}

function envDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Fallback to a local .env in the working directory only; no user-specific paths.
  try { const m = fs.readFileSync(".env", "utf8").match(/DATABASE_URL=(.+)/); if (m) return m[1].trim(); } catch { /* ignore */ }
  throw new Error("DATABASE_URL not set (export it or provide a .env in the working directory)");
}

async function main() {
  const conn = await mysql.createConnection({ uri: envDatabaseUrl(), timezone: "Z" });
  const q = async (s: string, p: unknown[] = []) => (await conn.query(s, p))[0] as Record<string, unknown>[];

  const where: string[] = ["quickbooksCustomerId IS NOT NULL"];
  const params: unknown[] = [];
  if (FILTER_CUSTOMER) { where.push("id = ?"); params.push(Number(FILTER_CUSTOMER)); }
  if (FILTER_QBO) { where.push("quickbooksCustomerId = ?"); params.push(FILTER_QBO); }

  const customers = await q(
    `SELECT id, type, displayName, firstName, lastName, companyName, email, phone, altPhone,
            billingLine1, billingCity, billingState, billingZip,
            quickbooksCustomerId, quickbooksCustomerUpdatedAt
     FROM customers WHERE ${where.join(" AND ")} ORDER BY id ASC LIMIT ?`,
    [...params, LIMIT],
  );
  const properties = (await q(
    `SELECT id, customerId, addressLine1, city, zip FROM properties`,
  )) as unknown as PropertyRow[];

  const identities: CustomerIdentity[] = customers.map(r => ({
    id: r.id as number,
    quickbooksCustomerId: (r.quickbooksCustomerId as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    altPhone: (r.altPhone as string) ?? null,
    displayName: (r.displayName as string) ?? null,
    companyName: (r.companyName as string) ?? null,
  }));

  const totals = {
    scanned: 0, confirmedComposite: 0, highRepairable: 0, mediumSkipped: 0, lowSkipped: 0,
    alreadyCorrect: 0, existingProperty: 0, newPropertyProposed: 0, propertyConflicts: 0,
    duplicateCandidates: 0, safeMergeProposals: 0, mergeConflicts: 0, missingQboId: 0, malformed: 0,
  };
  const report: unknown[] = [];

  for (const r of customers) {
    totals.scanned++;
    const raw = (r.displayName as string) ?? "";
    const parsed = parseQboCompositeName(raw);
    const line = (label: string, before: unknown, after: unknown) =>
      console.log(`   ${label}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);

    if (!parsed.isComposite) { totals.alreadyCorrect++; continue; }
    totals.confirmedComposite++;

    // Merge analysis (report only). Only consider records that actually SHARE a
    // strong identifier (QBO id / email / phone) — two different people with
    // different identifiers are not a "conflict", just distinct customers.
    const me = identities.find(i => i.id === r.id)!;
    const meEmail = normalizeEmail(me.email);
    const mePhone = normalizePhone(me.phone);
    const sharesIdentifier = (o: CustomerIdentity) =>
      (me.quickbooksCustomerId && o.quickbooksCustomerId === me.quickbooksCustomerId) ||
      (meEmail && normalizeEmail(o.email) === meEmail) ||
      (mePhone && normalizePhone(o.phone) === mePhone);
    const mergeProposals = identities
      .filter(o => o.id !== me.id && sharesIdentifier(o))
      .map(o => proposeMerge(me, o));
    const safeMerges = mergeProposals.filter(d => d.merge);
    const conflictMerges = mergeProposals.filter(d => !d.merge && d.reason === "IDENTIFIER_CONFLICT");
    if (mergeProposals.length) totals.duplicateCandidates += mergeProposals.length;
    if (safeMerges.length) totals.safeMergeProposals += safeMerges.length;
    if (conflictMerges.length) totals.mergeConflicts += conflictMerges.length;

    // Property analysis (report only).
    const propDecision = proposePropertyAction(
      r.id as number,
      { line1: parsed.serviceAddressLine1, city: parsed.serviceCity, state: parsed.serviceState, zip: parsed.servicePostalCode },
      properties,
    );
    if (propDecision.action === "existing") totals.existingProperty++;
    else if (propDecision.action === "create") totals.newPropertyProposed++;
    else if (propDecision.action === "conflict") totals.propertyConflicts++;

    if (!r.quickbooksCustomerId) totals.missingQboId++;

    const repairable = parsed.confidence === "high";
    if (parsed.confidence === "high") totals.highRepairable++;
    else if (parsed.confidence === "medium") totals.mediumSkipped++;
    else totals.lowSkipped++;

    const proposedDisplay = parsed.customerDisplayName;
    console.log(`\n── CRM #${r.id}  QBO ${r.quickbooksCustomerId}  [${parsed.confidence.toUpperCase()}${repairable ? " · repairable" : " · SKIP"}]`);
    console.log(`   reasonCodes: ${parsed.reasonCodes.join(", ")}`);
    console.log(`   raw QBO displayName: ${JSON.stringify(raw)}`);
    line("displayName", raw, proposedDisplay);
    line("firstName", r.firstName, parsed.firstName);
    line("lastName", r.lastName, parsed.lastName);
    line("companyName", r.companyName, parsed.companyName);
    line("projectReference", null, parsed.projectReference);
    console.log(`   billing address: UNCHANGED (line1=${JSON.stringify(r.billingLine1)})`);
    console.log(`   service property: ${propDecision.action} (${propDecision.reason}) → line1=${JSON.stringify(parsed.serviceAddressLine1)} city=${JSON.stringify(parsed.serviceCity)} state=${JSON.stringify(parsed.serviceState)} zip=${JSON.stringify(parsed.servicePostalCode)}`);
    console.log(`   location notes: ${JSON.stringify(parsed.locationNotes)}`);
    console.log(`   duplicates: safeMerges=${safeMerges.length} conflicts=${conflictMerges.length}`);
    console.log(`   proposed action: ${repairable ? "REPAIR name+split, preserve projectReference, " + propDecision.action + " property" : "SKIP (" + parsed.confidence + " confidence)"}`);
    if (!repairable) console.log(`   skip reason: ${parsed.reasonCodes.filter(c => c.startsWith("CUSTOMER_")).join(",") || "low confidence"}`);

    report.push({
      crmCustomerId: r.id, qboCustomerId: r.quickbooksCustomerId, confidence: parsed.confidence,
      repairable, reasonCodes: parsed.reasonCodes, rawDisplayName: raw,
      email: redactEmail((r.email as string) ?? null), phone: redactPhone((r.phone as string) ?? null),
      before: { displayName: raw, firstName: r.firstName, lastName: r.lastName, companyName: r.companyName, projectReference: null },
      after: { displayName: proposedDisplay, firstName: parsed.firstName, lastName: parsed.lastName, companyName: parsed.companyName, projectReference: parsed.projectReference },
      serviceProperty: { action: propDecision.action, reason: propDecision.reason, line1: parsed.serviceAddressLine1, city: parsed.serviceCity, state: parsed.serviceState, zip: parsed.servicePostalCode },
      locationNotes: parsed.locationNotes,
      billing: "unchanged",
      merges: { safe: safeMerges.length, conflicts: conflictMerges.length },
    });
  }

  console.log("\n================ TOTALS ================");
  for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: ${v}`);
  console.log("\nMODE: DRY-RUN (SELECT-only). No rows were modified. --apply is disabled.");

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ generatedForRecords: totals.scanned, totals, candidates: report }, null, 2));
    console.log(`\nRedacted JSON report written: ${JSON_OUT}`);
  }
  await conn.end();
}

// ── Dispatch: manifest → apply (dry-run unless fully acked); else → scan ──────
const MANIFEST = val("--manifest");
if (MANIFEST) {
  runApply(MANIFEST).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
} else {
  if (has("--apply")) {
    console.error("REFUSED: --apply requires --manifest <path>. No manifest → nothing to apply.");
    process.exit(2);
  }
  if (!has("--prod-read-ack")) {
    console.error("REFUSED: pass --prod-read-ack to acknowledge a read-only production query. No DB access without it.");
    process.exit(2);
  }
  main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
}
