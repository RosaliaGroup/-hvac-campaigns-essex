/**
 * apply-estimate-number-reconciliation.ts — apply the Bucket-B fix from
 * scripts/reconcile-estimate-numbers.ts: clear the legacy local estimate number
 * (e.g. "ME-EST-2026-0004") to NULL ("pending") on CRM estimates that have NO
 * QuickBooks counterpart (quickbooksEstimateId IS NULL). Those rows never had a
 * real QuickBooks number; NULL-ing them lets the next push assign the authoritative
 * QBO DocNumber. Run ONLY after migration 0061 (estimateNumber must be NULLABLE).
 *
 * SCOPE: Bucket B only (local number, no QBO counterpart). Bucket A (stored number
 * ≠ live QBO DocNumber) is intentionally NOT handled here — the report flags it and
 * it needs its own decision. In the current prod data Bucket A is empty.
 *
 * DRY-RUN IS THE DEFAULT: prints the EXACT UPDATE statements it would run and
 * changes nothing. A real run requires BOTH --execute and --yes-write. Each UPDATE
 * is guarded (id + exact current value + still-no-QBO) so it is a safe no-op if the
 * row changed since the report.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-estimate-number-reconciliation.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-estimate-number-reconciliation.ts --execute --yes-write
 */
import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "../server/db";
import { estimates } from "../drizzle/schema";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const EXECUTE = has("--execute");
const ACK = has("--yes-write");

if (EXECUTE && !ACK) {
  console.error("REFUSED: --execute mutates production. Re-run with --execute --yes-write once the statements below are approved.");
  process.exit(2);
}

const sqlLiteral = (id: number, current: string) =>
  `UPDATE \`estimates\` SET \`estimateNumber\` = NULL WHERE \`id\` = ${id} AND \`estimateNumber\` = ${JSON.stringify(current)} AND \`quickbooksEstimateId\` IS NULL;`;

async function main() {
  const db = await getDb();
  if (!db) { console.error("REFUSED: database unavailable."); process.exit(2); }

  // Bucket B: a stored number but no QBO counterpart.
  const rows = await db
    .select()
    .from(estimates)
    .where(and(isNotNull(estimates.estimateNumber), isNull(estimates.quickbooksEstimateId)))
    .orderBy(asc(estimates.id));

  console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (no writes)", bucketBrows: rows.length }));
  console.log("\n=== EXACT UPDATE STATEMENTS ===");
  if (!rows.length) console.log("  (none — nothing to reconcile)");
  for (const r of rows) console.log("  " + sqlLiteral(r.id, r.estimateNumber as string));

  if (!EXECUTE) {
    console.log("\nDRY-RUN — nothing changed. Re-run with --execute --yes-write to apply the statements above.");
    return;
  }

  let updated = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .update(estimates)
        .set({ estimateNumber: null })
        .where(and(
          eq(estimates.id, r.id),
          eq(estimates.estimateNumber, r.estimateNumber as string),
          isNull(estimates.quickbooksEstimateId),
        ));
      updated++;
      console.log(`  applied: estimate #${r.id} "${r.estimateNumber}" → NULL (pending)`);
    }
  });
  console.log("\n" + JSON.stringify({ step: "done", updated }));
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
