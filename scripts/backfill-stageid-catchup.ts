/**
 * Catch-up stage/status backfill for NON-COMMERCIAL opportunities created after 0065's
 * backfill ran (e.g. new rows with NULL stageId). Statements are verbatim from
 * drizzle/0065_opportunity_center_p2.sql (NULL-only + recordType<>'commercial' guards —
 * can never overwrite a commercial row's own stageId). Then HARD-ASSERTS null_stage = 0;
 * non-zero → prints offending rows and exits non-zero (abort).
 *
 *   tsx scripts/backfill-stageid-catchup.ts --yes-write-prod
 */
import mysql from "mysql2/promise";

const WRITE = process.argv.includes("--yes-write-prod");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    const [[before]] = (await conn.query(
      "SELECT COUNT(*) AS n FROM opportunities WHERE stageId IS NULL AND recordType <> 'commercial'",
    )) as [Array<{ n: number }>, unknown];
    console.log(`non-commercial rows with NULL stageId (before): ${before.n}`);

    if (!WRITE) { console.log("Dry run — pass --yes-write-prod to backfill."); return; }

    const [stageRes] = (await conn.query(
      `UPDATE \`opportunities\` o
         JOIN \`opportunityStages\` s ON s.\`pipelineKey\`='residential' AND s.\`stageKey\`=o.\`stage\`
          SET o.\`stageId\`=s.\`id\`
        WHERE o.\`stageId\` IS NULL AND o.\`recordType\` <> 'commercial'`,
    )) as [mysql.ResultSetHeader, unknown];
    console.log(`  [stageId backfill] rows affected: ${stageRes.affectedRows}`);

    const [statusRes] = (await conn.query(
      `UPDATE \`opportunities\`
          SET \`status\` = CASE
                WHEN \`stage\`='won'             THEN 'awarded'
                WHEN \`stage\`='lost'            THEN 'lost'
                WHEN \`stage\`='follow_up_later' THEN 'on_hold'
                ELSE 'open'
              END
        WHERE \`status\` IS NULL AND \`recordType\` <> 'commercial'`,
    )) as [mysql.ResultSetHeader, unknown];
    console.log(`  [status backfill]  rows affected: ${statusRes.affectedRows}`);

    // HARD ASSERTION — mirrors 0065's _assert_0065_stage_backfill.
    const [nulls] = (await conn.query(
      "SELECT id, stage, recordType FROM opportunities WHERE stageId IS NULL ORDER BY id",
    )) as [Array<{ id: number; stage: string; recordType: string }>, unknown];
    const [[tot]] = (await conn.query("SELECT COUNT(*) AS n FROM opportunities")) as [Array<{ n: number }>, unknown];
    if (nulls.length > 0) {
      console.error(`\n🔴 ASSERTION FAILED: null_stage = ${nulls.length} (of ${tot.n}). ABORTING.`);
      nulls.forEach(r => console.error(`   id=${r.id} stage=${r.stage} recordType=${r.recordType}`));
      process.exitCode = 2;
      return;
    }
    console.log(`\n✅ backfill complete. null_stage = 0 (of ${tot.n} opportunities). Assertion PASSED.`);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("BACKFILL ERR:", e instanceof Error ? e.message : e); process.exit(1); });
