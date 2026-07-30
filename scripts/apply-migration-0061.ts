/**
 * apply-migration-0061.ts — hand-apply migration 0061 (estimates.estimateNumber →
 * NULLABLE) to production, per drizzle/README.md (prod migrations are applied by
 * hand; db:push / drizzle-kit migrate are UNSAFE here). Reads the committed
 * drizzle/0061_estimate_number_nullable.sql so the applied DDL is exactly what's in
 * the repo.
 *
 * DRY-RUN default: prints the statement + the current column definition, changes
 * nothing. A real run requires --execute --yes-write. After applying it re-reads the
 * column definition to confirm NULL is now allowed.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0061.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0061.ts --execute --yes-write
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
const sqlPath = join(here, "..", "drizzle", "0061_estimate_number_nullable.sql");
// Strip -- comments and blank lines to get the executable DDL.
const ddl = readFileSync(sqlPath, "utf8")
  .split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();

async function columnDef(c: mysql.Connection): Promise<unknown> {
  const [rows] = await c.query(
    "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='estimates' AND COLUMN_NAME='estimateNumber' AND TABLE_SCHEMA = DATABASE()",
  );
  return (rows as unknown[])[0];
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: true });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (ALTER)" : "DRY-RUN (no writes)" }));
    console.log("\n=== DDL to apply (from drizzle/0061_estimate_number_nullable.sql) ===\n" + ddl);
    console.log("\n=== current column definition ===");
    console.log(JSON.stringify(await columnDef(c)));

    if (!EXECUTE) {
      console.log("\nDRY-RUN — nothing changed. Re-run with --execute --yes-write to apply.");
      return;
    }
    await c.query(ddl);
    console.log("\n=== column definition AFTER apply (expect IS_NULLABLE=YES) ===");
    console.log(JSON.stringify(await columnDef(c)));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
