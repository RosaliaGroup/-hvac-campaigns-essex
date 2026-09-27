/**
 * apply-migration-0077.ts — hand-apply migration 0077 (Social Lane) to
 * production. Local/uncommitted per owner instruction (no more direct pushes
 * to main this session). Reads drizzle/0077_social_lane.sql — plain
 * semicolon-separated SQL (no drizzle statement-breakpoint markers) — and runs
 * each statement in order.
 *
 * Additive only: socialPosts.status enum widened (+held/vetoed/reverted) +
 * contentSource/holdUntil/vetoedAt/revertedAt/utmCampaign columns; jobs.photoConsent
 * (default false); new jobPhotos + socialLaneState (circuit-breaker singleton) tables.
 *
 * DRY-RUN default: prints statements + current shape, changes nothing.
 * --execute --yes-write to actually apply. Tolerates "already applied" errors
 * (1050 table exists, 1060 dup column, 1061 dup index, 1062 dup row on the
 * singleton insert).
 *
 * Usage:
 *   railway run --service=<svc> --environment=production npx tsx <path>/apply-migration-0077.ts
 *   railway run --service=<svc> --environment=production npx tsx <path>/apply-migration-0077.ts --execute --yes-write
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

const TOLERATED = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_DUP_ENTRY"]); // 1050/1060/1061/1062

const sqlPath = fileURLToPath(new URL("../drizzle/0077_social_lane.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf8")
  .split("\n")
  .filter(l => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0);

async function shape(c: mysql.Connection): Promise<unknown> {
  const [statusCol] = await c.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='socialPosts' AND COLUMN_NAME='status'`,
  );
  const [newCols] = await c.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
       AND ((TABLE_NAME='socialPosts' AND COLUMN_NAME IN ('contentSource','holdUntil','vetoedAt','revertedAt','utmCampaign'))
         OR (TABLE_NAME='jobs' AND COLUMN_NAME='photoConsent'))
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  const [tables] = await c.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('jobPhotos','socialLaneState')
     ORDER BY TABLE_NAME`,
  );
  let stateRow: unknown = null;
  if ((tables as Array<{ TABLE_NAME: string }>).some(t => t.TABLE_NAME === "socialLaneState")) {
    const [rows] = await c.query(`SELECT * FROM socialLaneState WHERE id=1`);
    stateRow = (rows as unknown[])[0] ?? null;
  }
  return {
    socialPostsStatusEnum: (statusCol as Array<{ COLUMN_TYPE: string }>)[0]?.COLUMN_TYPE ?? null,
    newColumns: newCols,
    tablesPresent: (tables as Array<{ TABLE_NAME: string }>).map(t => t.TABLE_NAME),
    socialLaneStateRow: stateRow,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error("REFUSED: DATABASE_URL not set."); process.exit(2); }
  const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z", multipleStatements: false });
  try {
    console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (DDL)" : "DRY-RUN (no writes)", statements: statements.length }));
    console.log("\n=== DDL to apply (from drizzle/0077_social_lane.sql) ===");
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
    console.log("\n=== shape AFTER apply ===");
    console.log(JSON.stringify(await shape(c), null, 2));
    console.log(JSON.stringify({ step: "done", applied: true }));
  } finally {
    await c.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
