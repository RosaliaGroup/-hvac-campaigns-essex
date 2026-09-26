/**
 * apply-migration-0076.ts — hand-apply migration 0076 (Growth System:
 * speed-to-lead, follow-up cadence, review engine, CSV import, scoreboard) to
 * production, per drizzle/README.md (prod migrations are applied by hand;
 * db:push / drizzle-kit migrate are UNSAFE here). Reads the committed
 * drizzle/0076_growth_system.sql so the applied DDL is exactly what's in the
 * repo, and runs each statement (split on drizzle's `--> statement-breakpoint`)
 * in order.
 *
 * Additive only: `consentStatus` on `leads` (default 'opt_in') and
 * `leadCaptures` (default 'unknown') + `leadCaptures.formVersion`, plus 6 new
 * tables (growthCadences, growthCadenceTasks, growthTouches, reviewRequests,
 * contactImportBatches, importedContacts). No drops, no backfill.
 *
 * DRY-RUN default: prints the statements + the current shape, changes nothing.
 * A real run requires --execute --yes-write. Tolerates "already applied"
 * errors (1050 table exists, 1060 duplicate column, 1061 duplicate index) so a
 * partial/re-run is safe. After applying it re-reads the shape to confirm.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0076.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0076.ts --execute --yes-write
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const EXECUTE = has("--execute");
const ACK = has("--yes-write");

if (EXECUTE && !ACK) {
  console.error("REFUSED: --execute alters production. Re-run with --execute --yes-write once approved.");
  process.exit(2);
}

const TOLERATED = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"]); // 1050 / 1060 / 1061

const sqlPath = fileURLToPath(new URL("../drizzle/0076_growth_system.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
  .filter(s => s.length > 0);

const NEW_TABLES = ["growthCadences", "growthCadenceTasks", "growthTouches", "reviewRequests", "contactImportBatches", "importedContacts"];

async function shape(c: mysql.Connection): Promise<unknown> {
  const [cols] = await c.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND ((TABLE_NAME='leads' AND COLUMN_NAME='consentStatus')
         OR (TABLE_NAME='leadCaptures' AND COLUMN_NAME IN ('consentStatus','formVersion')))
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  const [tables] = await c.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${NEW_TABLES.map(() => "?").join(",")})
     ORDER BY TABLE_NAME`,
    NEW_TABLES,
  );
  return { columns: cols, tablesPresent: (tables as Array<{ TABLE_NAME: string }>).map(t => t.TABLE_NAME) };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: false });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length }));
    console.log("\n=== DDL to apply (from drizzle/0076_growth_system.sql) ===");
    statements.forEach((s, i) => console.log(`\n[${i + 1}/${statements.length}] ${s.replace(/\s+/g, " ").slice(0, 200)}`));
    console.log("\n=== current shape (before) ===");
    console.log(JSON.stringify(await shape(c), null, 2));

    if (!EXECUTE) {
      console.log("\nDRY-RUN — nothing changed. Re-run with --execute --yes-write to apply.");
      return;
    }
    for (let i = 0; i < statements.length; i++) {
      console.log(`\n--- applying [${i + 1}/${statements.length}] ---`);
      try {
        await c.query(statements[i]);
      } catch (e: any) {
        if (TOLERATED.has(e?.code)) {
          console.log(`  ↩︎ tolerated (${e.code}) — already applied, continuing.`);
        } else {
          throw e;
        }
      }
    }
    console.log("\n=== shape AFTER apply (expect consentStatus x2, formVersion, all 6 tables present) ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
