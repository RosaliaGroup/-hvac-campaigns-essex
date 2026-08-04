/**
 * Hand-apply migration 0065 (Opportunity Center P2) to a database, idempotently.
 *
 * Prod is hand-reconciled — never `drizzle-kit migrate`. This runner reads the
 * reviewed drizzle/0065_opportunity_center_p2.sql, splits on `--> statement-breakpoint`,
 * and executes each statement, TOLERATING the known "already applied" errors so a
 * partial/re-run is safe:
 *   1050 table exists · 1060 duplicate column · 1061 duplicate index key.
 * The hand-written seeds/backfills are already idempotent (ON DUPLICATE KEY / NULL-only).
 * The final assertion (SIGNAL SQLSTATE '45000') is surfaced, NOT swallowed — if any
 * opportunity is left with a NULL stageId the run reports the count + offending rows
 * and exits non-zero.
 *
 * Read-only by default (dry run: prints the plan, touches nothing).
 * Pass --execute --yes-write-prod to actually apply.
 *
 * Usage:
 *   tsx scripts/apply-migration-0065.ts                       # dry run
 *   tsx scripts/apply-migration-0065.ts --execute --yes-write-prod
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const EXECUTE = process.argv.includes("--execute") && process.argv.includes("--yes-write-prod");
const TOLERATED = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"]); // 1050 / 1060 / 1061

const sqlPath = fileURLToPath(new URL("../drizzle/0065_opportunity_center_p2.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.replace(/^\s*--.*$/gm, "").trim()) // strip comment-only noise for logging (kept in exec via original)
  .map((s, i) => ({ i, raw: s }))
  .filter(s => s.raw.length > 0);

function label(sql: string): string {
  return sql.replace(/\s+/g, " ").slice(0, 90);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  console.log(`migration 0065 — ${statements.length} statements — ${EXECUTE ? "EXECUTE (writing to prod)" : "DRY RUN (no writes)"}`);
  if (!EXECUTE) {
    statements.forEach(s => console.log(`  [plan] ${label(s.raw)}`));
    console.log("Dry run only. Re-run with --execute --yes-write-prod to apply.");
    return;
  }

  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  let applied = 0, skipped = 0;
  try {
    for (const s of statements) {
      try {
        await conn.query(s.raw);
        applied++;
        console.log(`  [ok]   ${label(s.raw)}`);
      } catch (e: unknown) {
        const err = e as { code?: string; errno?: number; sqlState?: string; sqlMessage?: string };
        if (err.code && TOLERATED.has(err.code)) {
          skipped++;
          console.log(`  [skip] already applied (${err.code}): ${label(s.raw)}`);
          continue;
        }
        if (err.sqlState === "45000") {
          // The stageId assertion fired — surface the detail, do NOT continue.
          const [rows] = await conn.query(
            "SELECT id, stage, recordType FROM opportunities WHERE stageId IS NULL ORDER BY id",
          );
          const list = rows as Array<{ id: number; stage: string; recordType: string }>;
          console.error(`\n🔴 ASSERTION FIRED: ${err.sqlMessage}`);
          console.error(`   null_stage count: ${list.length}`);
          list.slice(0, 50).forEach(r => console.error(`     id=${r.id} stage=${r.stage} recordType=${r.recordType}`));
          process.exitCode = 2;
          return;
        }
        console.error(`  [FAIL] ${err.code ?? ""} ${err.sqlMessage ?? String(e)}\n         ${label(s.raw)}`);
        process.exitCode = 1;
        return;
      }
    }
    const [[nz]] = (await conn.query("SELECT COUNT(*) AS n FROM opportunities WHERE stageId IS NULL")) as [Array<{ n: number }>, unknown];
    const [[tot]] = (await conn.query("SELECT COUNT(*) AS n FROM opportunities")) as [Array<{ n: number }>, unknown];
    console.log(`\n✅ 0065 applied: ${applied} executed, ${skipped} already-present.`);
    console.log(`   assertion PASSED (SIGNAL did not fire).`);
    console.log(`   null_stage = ${nz.n}   (of ${tot.n} opportunities)`);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("ERR:", e instanceof Error ? e.message : e); process.exit(1); });
