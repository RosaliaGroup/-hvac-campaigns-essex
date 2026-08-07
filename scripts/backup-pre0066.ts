/**
 * Pre-0066 backup. Snapshots every table migration 0066 ALTERs into an in-DB
 * `<table>_backup_pre0066` copy (data-only CREATE TABLE ... AS SELECT), matching the
 * repo precedent (`opportunities_backup_pre0062`). Refuses to overwrite an existing
 * backup, and verifies row-count parity for each. numberSequences is NOT backed up —
 * 0066 CREATEs it fresh (no prior data).
 *
 * Requires --yes-write-prod to actually create the backup tables.
 *   tsx scripts/backup-pre0066.ts --yes-write-prod
 */
import mysql from "mysql2/promise";

const WRITE = process.argv.includes("--yes-write-prod");
const TABLES = ["opportunities", "opportunityDocuments", "opportunityStages"];
const SUFFIX = "_backup_pre0066";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    const results: Array<{ table: string; backup: string; srcRows: number; bakRows: number }> = [];
    for (const t of TABLES) {
      const bak = `${t}${SUFFIX}`;
      const [[exists]] = (await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [bak],
      )) as [Array<{ n: number }>, unknown];
      if (Number(exists.n) > 0) {
        throw new Error(`backup table ${bak} ALREADY EXISTS — refusing to overwrite. Resolve before proceeding.`);
      }
      const [[src]] = (await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``)) as [Array<{ n: number }>, unknown];
      if (!WRITE) {
        console.log(`  [plan] CREATE TABLE \`${bak}\` AS SELECT * FROM \`${t}\`   (source rows: ${src.n})`);
        continue;
      }
      await conn.query(`CREATE TABLE \`${bak}\` AS SELECT * FROM \`${t}\``);
      const [[bakc]] = (await conn.query(`SELECT COUNT(*) AS n FROM \`${bak}\``)) as [Array<{ n: number }>, unknown];
      if (Number(bakc.n) !== Number(src.n)) {
        throw new Error(`ROW PARITY MISMATCH for ${bak}: source=${src.n} backup=${bakc.n}`);
      }
      results.push({ table: t, backup: bak, srcRows: Number(src.n), bakRows: Number(bakc.n) });
      console.log(`  [ok]   ${bak}  (${bakc.n} rows, parity OK)`);
    }
    if (!WRITE) { console.log("Dry run only — pass --yes-write-prod to create backups."); return; }
    console.log("\n✅ pre-0066 backup complete (in-DB tables in the prod `railway` database):");
    results.forEach(r => console.log(`   ${r.backup} = ${r.bakRows} rows (copy of ${r.table})`));
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("BACKUP ERR:", e instanceof Error ? e.message : e); process.exit(1); });
