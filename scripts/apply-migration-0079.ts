/**
 * apply-migration-0079.ts — hand-apply migration 0079 (fix for
 * seoIntelQuerySnapshots' unique key: 0078_seo_intel.sql's composite
 * UNIQUE INDEX(siteUrl, query, snapshotDate) exceeds MySQL's 3072-byte max
 * key length under utf8mb4 and never successfully applied anywhere; see
 * drizzle/README.md's "0078_seo_intel" incident note) to production, per
 * drizzle/README.md (prod migrations are applied by hand; db:push /
 * drizzle-kit migrate are UNSAFE here).
 *
 * Additive only, and zero-risk: seoIntelQuerySnapshots has zero rows in
 * production (created by 0078, never populated), so ADD COLUMN ... NOT NULL
 * cannot violate any existing row.
 *
 * DRY-RUN default: prints the statements + the current shape, changes nothing.
 * A real run requires --execute --yes-write. Tolerates "already applied"
 * errors (1060 duplicate column, 1061 duplicate index) so a partial/re-run
 * is safe.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0079.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0079.ts --execute --yes-write
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

const TOLERATED = new Set(["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"]); // 1060 / 1061

const sqlPath = fileURLToPath(new URL("../drizzle/0079_seo_intel_query_key.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
  .filter(s => s.length > 0);

async function shape(c: mysql.Connection): Promise<unknown> {
  const [cols] = await c.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seoIntelQuerySnapshots' AND COLUMN_NAME = 'snapshotKey'`,
  );
  const [idx] = await c.query(
    `SELECT INDEX_NAME, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seoIntelQuerySnapshots' AND INDEX_NAME = 'seoIntelQuerySnapshots_key_uq'`,
  );
  const [rowCount] = await c.query(`SELECT COUNT(*) as n FROM seoIntelQuerySnapshots`);
  return { snapshotKeyColumn: cols, keyUqIndex: idx, rowCount };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: false });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length }));
    console.log("\n=== DDL to apply (from drizzle/0079_seo_intel_query_key.sql) ===");
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
    console.log("\n=== shape AFTER apply (expect snapshotKey column + unique index) ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
