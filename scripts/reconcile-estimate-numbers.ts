/**
 * reconcile-estimate-numbers.ts — READ-ONLY reconciliation of CRM estimate numbers
 * against the QuickBooks numbering authority. Writes NOTHING. It exists to produce
 * the fix list the owner approves BEFORE any renumbering happens.
 *
 * QuickBooks is the sole numbering authority: a CRM `estimates` row's display number
 * (estimateNumber) must equal the QBO DocNumber of its linked QBO Estimate
 * (quickbooksEstimateId), or be NULL ("pending") when there is no QBO counterpart.
 * This script reports every deviation and PROPOSES the fix — it applies none.
 *
 * Buckets:
 *   A. MISMATCH — row has a quickbooksEstimateId, but its stored estimateNumber
 *      differs from the live QBO DocNumber (includes stored-NULL-but-QBO-has-one).
 *      Proposed fix: set estimateNumber = <QBO DocNumber>.
 *   B. LOCAL-NUMBER-NO-QBO — row has a non-null estimateNumber but NO
 *      quickbooksEstimateId (never pushed). These are legacy local "ME-EST-*" values
 *      that were never real QuickBooks numbers.
 *      Proposed fix: clear estimateNumber to NULL (pending) so the next push assigns
 *      the authoritative QBO number.
 *
 * Usage (read-only):
 *   railway run --service=<svc> --environment=production \
 *     npx tsx scripts/reconcile-estimate-numbers.ts [--delay 300]
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { estimates } from "../drizzle/schema";
import { quickbooksProvider } from "../server/integrations/accounting/quickbooks";

const argv = process.argv.slice(2);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const DELAY = Number(val("--delay") ?? "300") || 300;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isLocalLegacy = (n: string) => /^ME-EST-/i.test(n.trim());

async function main() {
  const db = await getDb();
  if (!db) { console.error("REFUSED: database unavailable."); process.exit(2); }

  const conn = await quickbooksProvider.getConnection().catch(() => null);
  const connected = !!conn && conn.status === "connected";
  console.log(JSON.stringify({ step: "start", mode: "READ-ONLY (no writes)", qboConnected: connected, realmId: conn?.realmId ?? null }));
  if (!connected) console.log("WARNING: QuickBooks not connected — bucket A (mismatch) cannot be evaluated; only bucket B (local-number-no-QBO) will be reported.");

  const rows = await db.select().from(estimates).orderBy(asc(estimates.id));

  const mismatch: Array<{ id: number; stored: string | null; qboDocNumber: string | null; qbId: string; proposedFix: string }> = [];
  const localNoQbo: Array<{ id: number; stored: string; proposedFix: string }> = [];
  let okCount = 0, pendingCount = 0, unresolvableQbo = 0;

  for (const e of rows) {
    const stored = e.estimateNumber?.trim() || null;

    if (e.quickbooksEstimateId) {
      // Bucket A candidate — compare to the live QBO DocNumber.
      if (!connected) { unresolvableQbo++; continue; }
      let qboDoc: string | null = null;
      try {
        qboDoc = await quickbooksProvider.fetchEstimateDocNumber(e.quickbooksEstimateId);
      } catch (err) {
        console.error(`  QBO read failed for estimate #${e.id} (qb ${e.quickbooksEstimateId}): ${(err as Error).message}`);
        unresolvableQbo++;
        continue;
      }
      const qboNorm = qboDoc?.trim() || null;
      if (qboNorm !== stored) {
        mismatch.push({ id: e.id, stored, qboDocNumber: qboNorm, qbId: e.quickbooksEstimateId, proposedFix: `set estimateNumber = ${qboNorm ?? "(QBO has none — leave/clear)"}` });
      } else {
        okCount++;
      }
      if (DELAY) await sleep(DELAY);
      continue;
    }

    // No QBO counterpart.
    if (stored) {
      localNoQbo.push({ id: e.id, stored, proposedFix: `clear estimateNumber to NULL (pending)${isLocalLegacy(stored) ? " — legacy ME-EST local number" : ""}` });
    } else {
      pendingCount++; // already NULL/pending — correct, nothing to do
    }
  }

  console.log("\n=== BUCKET A: display number ≠ QBO DocNumber ===");
  if (!mismatch.length) console.log("  (none)");
  for (const m of mismatch) console.log(`  estimate #${m.id}: stored=${m.stored ?? "NULL"} | QBO=${m.qboDocNumber ?? "NULL"} (qb ${m.qbId}) → ${m.proposedFix}`);

  console.log("\n=== BUCKET B: local number, no QBO counterpart ===");
  if (!localNoQbo.length) console.log("  (none)");
  for (const b of localNoQbo) console.log(`  estimate #${b.id}: stored=${b.stored} → ${b.proposedFix}`);

  console.log("\n" + JSON.stringify({
    step: "summary",
    totalEstimates: rows.length,
    alreadyCorrect: okCount,
    alreadyPending: pendingCount,
    mismatch: mismatch.length,
    localNumberNoQbo: localNoQbo.length,
    unresolvableQbo,
  }, null, 2));
  console.log("\nREAD-ONLY — nothing changed. Bring this fix list to the owner for approval before any renumbering.");
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
