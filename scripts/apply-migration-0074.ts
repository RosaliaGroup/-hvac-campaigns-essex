/**
 * apply-migration-0074.ts — hand-apply migration 0074 (widen seoPageTags.tag
 * to add 'nightly-candidate') to production, per drizzle/README.md.
 * Pure additive enum widen — all 4 existing values kept, 1 new value added.
 * seoPageTags has 0 rows in production (verified before writing this
 * script), so there is zero risk of narrowing or data loss either way.
 *
 * DRY-RUN default: prints the statement + current shape, changes nothing.
 * A real run requires --execute --yes-write.
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0074.ts
 *   railway run --service=<svc> --environment=production npx tsx scripts/apply-migration-0074.ts --execute --yes-write
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

const sqlPath = fileURLToPath(new URL("../drizzle/0074_seo_nightly_candidate_tag.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
  .filter(s => s.length > 0);

async function shape(c: mysql.Connection): Promise<unknown> {
  const [tagEnum] = await c.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seoPageTags' AND COLUMN_NAME = 'tag'`,
  );
  return { tagEnum };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: false });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length }));
    console.log("\n=== DDL to apply (from drizzle/0074_seo_nightly_candidate_tag.sql) ===");
    statements.forEach((s, i) => console.log(`\n[${i + 1}/${statements.length}] ${s.replace(/\s+/g, " ").slice(0, 200)}`));
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
    console.log("\n=== shape AFTER apply ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
