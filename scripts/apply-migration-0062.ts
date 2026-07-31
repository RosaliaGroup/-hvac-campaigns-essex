/**
 * apply-migration-0062.ts — hand-apply migration 0062 (Opportunity Center P1: 6
 * additive opportunity columns + opportunityEvents.actorId + stage-enum extension +
 * a (stage, sortOrder) index) to production, per drizzle/README.md (prod migrations
 * are applied by hand; db:push / drizzle-kit migrate are UNSAFE here). Reads the
 * committed drizzle/0062_opportunity_center_p1.sql so the applied DDL is exactly
 * what's in the repo, and runs each statement (split on drizzle's
 * `--> statement-breakpoint`) in order.
 *
 * DRY-RUN default: prints the statements + the current shape, changes nothing. A
 * real run requires --execute --yes-write. All statements are ADDITIVE (ADD COLUMN /
 * CREATE INDEX / enum widen via MODIFY that only appends values), so a partial
 * failure leaves earlier additive steps in place — safe and re-runnable in spirit,
 * though this script does not itself wrap them in a transaction (MySQL DDL is not
 * transactional). After applying it re-reads the shape to confirm.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0062.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0062.ts --execute --yes-write
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const EXECUTE = has("--execute");
const ACK = has("--yes-write");

if (EXECUTE && !ACK) {
  console.error("REFUSED: --execute alters production. Re-run with --execute --yes-write once approved.");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "..", "drizzle", "0062_opportunity_center_p1.sql");

// Split on drizzle's statement-breakpoint, drop `--` comment lines, keep non-empty.
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
  .filter(s => s.length > 0);

async function shape(c: mysql.Connection): Promise<unknown> {
  const [cols] = await c.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND ((TABLE_NAME='opportunities' AND COLUMN_NAME IN
             ('stage','priority','expectedCloseAt','expectedRevenue','assignedTechnicianId','sortOrder','propertyId'))
         OR (TABLE_NAME='opportunityEvents' AND COLUMN_NAME='actorId'))
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  const [idx] = await c.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='opportunities'
       AND INDEX_NAME='opportunities_stage_sortOrder_idx' LIMIT 1`,
  );
  return { columns: cols, stageSortIndexPresent: (idx as unknown[]).length > 0 };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length }));
    console.log("\n=== DDL to apply (from drizzle/0062_opportunity_center_p1.sql) ===");
    statements.forEach((s, i) => console.log(`\n[${i + 1}/${statements.length}] ${s}`));
    console.log("\n=== current shape (before) ===");
    console.log(JSON.stringify(await shape(c), null, 2));

    if (!EXECUTE) {
      console.log("\nDRY-RUN — nothing changed. Re-run with --execute --yes-write to apply.");
      return;
    }
    for (let i = 0; i < statements.length; i++) {
      console.log(`\n--- applying [${i + 1}/${statements.length}] ---`);
      await c.query(statements[i]);
    }
    console.log("\n=== shape AFTER apply (expect all 7 columns + index present, stage enum = 11 values) ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
