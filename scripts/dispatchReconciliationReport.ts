/**
 * Dispatch reconciliation report — standalone READ-ONLY CLI.
 *
 * Runs the same pure engine (shared/dispatchReconciliation.ts) as the admin
 * tRPC endpoint, directly against a database, and prints the report as JSON plus
 * a human-readable markdown summary. Issues ONLY `SELECT` statements — no writes,
 * no remediation, no external calls.
 *
 * Usage:  PRODURL="mysql://user:pass@host:port/db" npx tsx scripts/dispatchReconciliationReport.ts [--json]
 */
import mysql from "mysql2/promise";
import { runDispatchReconciliation, type DispatchDataset } from "../shared/dispatchReconciliation";
import type { OfficeStatus, TechnicianWorkStatus, AppointmentStatus } from "../shared/jobLifecycle";

async function main() {
  const url = process.env.PRODURL || process.env.DATABASE_URL;
  if (!url) { console.error("Set PRODURL (or DATABASE_URL) to a read-only connection string."); process.exit(1); }
  const jsonOnly = process.argv.includes("--json");
  const c = await mysql.createConnection(url);
  const q = async (s: string) => (await c.query(s))[0] as any[];

  // SELECT-only. No INSERT/UPDATE/DELETE anywhere in this script.
  const [jobRows, apptRows, teamRows, compRows, propRows] = await Promise.all([
    q("SELECT id, jobNumber, status AS officeStatus, technicianWorkStatus, assignedToId, customerId, propertyId, completedAt FROM jobs"),
    q("SELECT id, jobId, assignedToId, customerId, propertyId, status, scheduledAt, propertyAddress FROM appointments"),
    q("SELECT id, status FROM teamMembers"),
    q("SELECT jobId, completedAt FROM jobCompletions"),
    q("SELECT id, addressLine1 FROM properties"),
  ]);
  await c.end();

  const dataset: DispatchDataset = {
    jobs: jobRows.map(j => ({ id: j.id, jobNumber: j.jobNumber ?? null, officeStatus: (j.officeStatus ?? "new") as OfficeStatus, technicianWorkStatus: (j.technicianWorkStatus ?? "assigned") as TechnicianWorkStatus, assignedToId: j.assignedToId ?? null, customerId: j.customerId ?? null, propertyId: j.propertyId ?? null, completedAt: j.completedAt ?? null })),
    appointments: apptRows.map(a => ({ id: a.id, jobId: a.jobId ?? null, assignedToId: a.assignedToId ?? null, customerId: a.customerId ?? null, propertyId: a.propertyId ?? null, status: (a.status ?? "pending") as AppointmentStatus, scheduledAt: a.scheduledAt ?? null, hasAddressText: !!(a.propertyAddress && String(a.propertyAddress).trim().length > 0) })),
    teamMembers: teamRows.map(m => ({ id: m.id, status: m.status })),
    completions: compRows.map(r => ({ jobId: r.jobId, completedAt: r.completedAt ?? null })),
    properties: propRows.map(p => ({ id: p.id, hasAddress: !!(p.addressLine1 && String(p.addressLine1).trim().length > 0) })),
  };

  const report = runDispatchReconciliation(dataset, { generatedAt: new Date().toISOString() });

  if (jsonOnly) { console.log(JSON.stringify(report, null, 2)); return; }

  const s = report.summary;
  console.log("\n# Dispatch Reconciliation Report");
  console.log(`generated: ${report.generatedAt}   read-only: ${s.readOnly}`);
  console.log(`scope: jobs=${report.scope.jobs} appointments=${report.scope.appointments} completions=${report.scope.completions} teamMembers=${report.scope.teamMembers} properties=${report.scope.properties}`);
  console.log(`verdict: ${s.boardAccuracyVerdict.toUpperCase()}   findings: ${s.totalFindings}  (high=${s.findingsBySeverity.high} medium=${s.findingsBySeverity.medium} low=${s.findingsBySeverity.low} info=${s.findingsBySeverity.info})\n`);
  console.log("## Checks");
  for (const ck of report.checks) console.log(`  [${ck.severity.padEnd(6)}] ${String(ck.count).padStart(3)}  ${ck.id}  — ${ck.title}`);
  if (report.findings.length) {
    console.log("\n## Findings");
    for (const f of report.findings) console.log(`  [${f.severity.padEnd(6)}] ${f.entity} #${f.recordId}${f.relatedId != null ? " ↔ #" + f.relatedId : ""}: ${f.problem}  → ${f.remediation}`);
  } else {
    console.log("\n(no findings — data is dispatch-consistent)");
  }
  console.log("");
}

main().catch(e => { console.error("FATAL:", e?.message ?? e); process.exit(1); });
