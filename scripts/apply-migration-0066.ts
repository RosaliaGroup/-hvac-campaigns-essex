/**
 * Hand-apply migration 0066 (commercial-bid additions) to a database, idempotently.
 *
 * Prod is hand-reconciled — never `drizzle-kit migrate`. This runner reads the
 * reviewed drizzle/0066_commercial_bid.sql, splits on `--> statement-breakpoint`,
 * and executes each statement, TOLERATING the known "already applied" errors so a
 * partial/re-run is safe:
 *   1050 table exists · 1060 duplicate column · 1061 duplicate index key.
 * The stored-procedure guards in 0066 (`_mig0066_add_priorityscore`,
 * `_mig0066_uniq_oppnum`) are themselves idempotent (information_schema checks), so
 * they no-op where prod has already drifted; `multipleStatements:false` is correct
 * because each CREATE PROCEDURE / CALL / DROP is its own statement-breakpoint chunk
 * (no client-side DELIMITER needed).
 *
 * Read-only by default. In DRY RUN it still connects to run the GUARD PROBE
 * (SELECT-only) so we can confirm, against the live target, exactly what each guard
 * will do — but it writes NOTHING. Pass --execute --yes-write-prod to actually apply.
 *
 * Usage:
 *   tsx scripts/apply-migration-0066.ts                       # dry run: probe + plan, no writes
 *   tsx scripts/apply-migration-0066.ts --execute --yes-write-prod
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const EXECUTE = process.argv.includes("--execute") && process.argv.includes("--yes-write-prod");
const TOLERATED = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"]); // 1050 / 1060 / 1061

const sqlPath = fileURLToPath(new URL("../drizzle/0066_commercial_bid.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("--> statement-breakpoint")
  .map(s => s.replace(/^\s*--.*$/gm, "").trim()) // strip comment-only noise; body statements are unaffected
  .map((s, i) => ({ i, raw: s }))
  .filter(s => s.raw.length > 0);

function label(sql: string): string {
  return sql.replace(/\s+/g, " ").slice(0, 90);
}

type Row = Record<string, unknown>;

/**
 * READ-ONLY probe of the live target. Reports the current state of every object the
 * two guards depend on, and states precisely what each guard WILL do on apply.
 * Returns whether each guard is a true no-op and whether the unique index applies cleanly.
 */
async function probeGuards(conn: mysql.Connection) {
  const [[ps]] = (await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'priorityScore'`,
  )) as [Array<{ n: number }>, unknown];
  const priorityScorePresent = Number(ps.n) > 0;

  const [idx] = (await conn.query(
    `SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opportunities'
         AND INDEX_NAME IN ('opportunities_opportunityNumber_idx','opportunities_opportunityNumber_uq')
       GROUP BY INDEX_NAME, NON_UNIQUE`,
  )) as [Row[], unknown];
  const names = new Set(idx.map(r => String(r.INDEX_NAME)));
  const nonUniqueIdxPresent = names.has("opportunities_opportunityNumber_idx");
  const uniqueIdxPresent = names.has("opportunities_opportunityNumber_uq");

  const [[cnt]] = (await conn.query(
    `SELECT COUNT(*) AS total,
            SUM(opportunityNumber IS NULL) AS nulls,
            COUNT(opportunityNumber) - COUNT(DISTINCT opportunityNumber) AS dup_nonnull
       FROM opportunities`,
  )) as [Array<{ total: number; nulls: number; dup_nonnull: number }>, unknown];
  const total = Number(cnt.total), nulls = Number(cnt.nulls), dupNonNull = Number(cnt.dup_nonnull);

  // Guard verdicts.
  const guard1NoOp = priorityScorePresent;
  const uniqueAppliesCleanly = dupNonNull === 0;
  const guard2NoOp = uniqueIdxPresent && !nonUniqueIdxPresent; // already swapped

  console.log("── GUARD PROBE (read-only, live target) ─────────────────────────────");
  console.log(`  priorityScore column present            : ${priorityScorePresent ? "YES" : "NO"}`);
  console.log(`  opportunities_opportunityNumber_idx     : ${nonUniqueIdxPresent ? "PRESENT (non-unique)" : "absent"}`);
  console.log(`  opportunities_opportunityNumber_uq      : ${uniqueIdxPresent ? "PRESENT (unique)" : "absent"}`);
  console.log(`  opportunityNumber rows                  : total=${total}  null=${nulls}  duplicate-non-null=${dupNonNull}`);
  console.log("  ---");
  console.log(`  GUARD 1 (priorityScore ADD)  → ${guard1NoOp
    ? "NO-OP (IF NOT EXISTS skips; column already present)"
    : "WILL ADD COLUMN (column absent) — NOT a no-op"}`);
  if (guard2NoOp) {
    console.log(`  GUARD 2 (unique index swap)  → NO-OP (unique index already present, non-unique already gone)`);
  } else {
    const action = [
      nonUniqueIdxPresent ? "DROP non-unique idx" : null,
      uniqueIdxPresent ? null : "CREATE unique idx",
    ].filter(Boolean).join(" + ");
    console.log(`  GUARD 2 (unique index swap)  → WILL ${action} — a real CHANGE, NOT a no-op`);
    console.log(`                                 applies cleanly? ${uniqueAppliesCleanly
      ? "YES (0 duplicate non-null values)"
      : `NO — ${dupNonNull} duplicate non-null opportunityNumber value(s) would break UNIQUE`}`);
  }
  console.log("─────────────────────────────────────────────────────────────────────");

  return { guard1NoOp, guard2NoOp, uniqueAppliesCleanly, priorityScorePresent, nonUniqueIdxPresent, uniqueIdxPresent, total, nulls, dupNonNull };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  console.log(`migration 0066 — ${statements.length} statements — ${EXECUTE ? "EXECUTE (writing to prod)" : "DRY RUN (no writes)"}`);

  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    const probe = await probeGuards(conn);

    if (!EXECUTE) {
      console.log("\n── PLAN (ordered statements) ────────────────────────────────────────");
      statements.forEach(s => console.log(`  [plan] ${label(s.raw)}`));
      console.log("─────────────────────────────────────────────────────────────────────");
      console.log("Dry run only. Nothing was written. Re-run with --execute --yes-write-prod to apply.");
      return;
    }

    let applied = 0, skipped = 0;
    for (const s of statements) {
      try {
        await conn.query(s.raw);
        applied++;
        console.log(`  [ok]   ${label(s.raw)}`);
      } catch (e: unknown) {
        const err = e as { code?: string; sqlState?: string; sqlMessage?: string };
        if (err.code && TOLERATED.has(err.code)) {
          skipped++;
          console.log(`  [skip] already applied (${err.code}): ${label(s.raw)}`);
          continue;
        }
        console.error(`  [FAIL] ${err.code ?? ""} ${err.sqlMessage ?? String(e)}\n         ${label(s.raw)}`);
        process.exitCode = 1;
        return;
      }
    }
    const [[nz]] = (await conn.query("SELECT COUNT(*) AS n FROM opportunities WHERE stageId IS NULL")) as [Array<{ n: number }>, unknown];
    const [[tot]] = (await conn.query("SELECT COUNT(*) AS n FROM opportunities")) as [Array<{ n: number }>, unknown];
    console.log(`\n✅ 0066 applied: ${applied} executed, ${skipped} already-present.`);
    console.log(`   null_stage = ${nz.n}   (of ${tot.n} opportunities)`);
    void probe;
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("ERR:", e instanceof Error ? e.message : e); process.exit(1); });
