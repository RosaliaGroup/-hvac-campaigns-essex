/**
 * apply-migration-0073.ts — hand-apply migration 0073 (SEO autopublish:
 * seoContentQueue + seoAutopublishState) to production, per drizzle/README.md.
 *
 * ⚠️ DEVIATION FROM THE COMMITTED FILE, on purpose: 0073's first statement
 * (ALTER TABLE seoAuditLog MODIFY COLUMN action — widening it to 16 values)
 * is SKIPPED. Migration 0078 (already applied to production this session,
 * out of the original numbering order) widened the SAME column to a 20-value
 * SUPERSET that includes every one of 0073's 16 plus 0078's own 4
 * market_intel_* values. Running 0073's narrower 16-value version now would
 * NARROW that column back down, silently dropping the 4 market_intel_*
 * values the intel job needs to write — i.e. it would re-break the exact
 * bug 0079 just fixed, without touching any data (verified zero rows
 * currently use those 4 values — this is a definition-narrowing risk, not a
 * data-loss risk, but still not what "apply 0073" should do to a database
 * that already has 0078 applied). Statements 2+ (the two new tables + seed
 * row) are unaffected by 0078 and run normally.
 *
 * DRY-RUN default: prints all statements (marking the skipped one) + current
 * shape, changes nothing. A real run requires --execute --yes-write.
 * Tolerates "already applied" errors (1050 table exists) for safe re-runs.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0073.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0073.ts --execute --yes-write
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

const TOLERATED = new Set(["ER_TABLE_EXISTS_ERROR"]); // 1050

const sqlPath = fileURLToPath(new URL("../drizzle/0073_seo_autopublish.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
  .filter(s => s.length > 0);

const SKIP_INDEX = statements.findIndex(s => /ALTER TABLE `seoAuditLog` MODIFY COLUMN `action`/.test(s));

async function shape(c: mysql.Connection): Promise<unknown> {
  const [actionEnum] = await c.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seoAuditLog' AND COLUMN_NAME = 'action'`,
  );
  const [tables] = await c.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('seoContentQueue','seoAutopublishState')`,
  );
  const [stateRow] = await c.query(`SELECT * FROM seoAutopublishState WHERE id = 1`).catch(() => [[]]);
  return { actionEnum, tablesPresent: (tables as Array<{ TABLE_NAME: string }>).map(t => t.TABLE_NAME), autopublishStateRow: stateRow };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: false });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length, skippedIndex: SKIP_INDEX }));
    console.log("\n=== DDL to apply (from drizzle/0073_seo_autopublish.sql) ===");
    statements.forEach((s, i) => {
      const skip = i === SKIP_INDEX ? "  [SKIPPED — see file header, superseded by 0078's wider enum]" : "";
      console.log(`\n[${i + 1}/${statements.length}]${skip} ${s.replace(/\s+/g, " ").slice(0, 200)}`);
    });
    console.log("\n=== current shape (before) ===");
    console.log(JSON.stringify(await shape(c), null, 2));

    if (!EXECUTE) {
      console.log("\nDRY-RUN — nothing changed. Re-run with --execute --yes-write to apply.");
      return;
    }
    for (let i = 0; i < statements.length; i++) {
      if (i === SKIP_INDEX) {
        console.log(`\n--- skipping [${i + 1}/${statements.length}] (see file header) ---`);
        continue;
      }
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
    console.log("\n=== shape AFTER apply ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
