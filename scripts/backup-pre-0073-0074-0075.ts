import mysql from "mysql2/promise";
import { writeFileSync } from "node:fs";

async function dumpTable(conn: mysql.Connection, table: string) {
  const [rows]: any = await conn.query(`SELECT * FROM \`${table}\` ORDER BY id ASC`);
  const [createTable]: any = await conn.query(`SHOW CREATE TABLE \`${table}\``);
  return { table, rowCount: rows.length, createTableDDL: createTable[0]["Create Table"], rows };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const tables = ["seoPageTags", "seoApprovalBatches", "seoAuditLog"];
  const dumps = [];
  for (const t of tables) dumps.push(await dumpTable(conn, t));
  const payload = {
    takenAt: new Date().toISOString(),
    purpose: "pre-0073/0074/0075 backup: seoPageTags (0074 target), seoApprovalBatches (0075 target), seoAuditLog (0073's enum statement will be SKIPPED as redundant/regressive vs 0078's already-wider enum, but backed up anyway for completeness)",
    dumps,
  };
  const path = "tmp/railway-pre0073-0074-0075.json";
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log("wrote backup to", path);
  for (const d of dumps) console.log(d.table, "rows:", d.rowCount);
  await conn.end();
}
main().catch(e => { console.error("ERROR", e); process.exit(1); });
