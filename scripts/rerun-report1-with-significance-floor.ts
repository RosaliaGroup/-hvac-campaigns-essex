import mysql from "mysql2/promise";
import { runMarketIntelReport } from "../server/services/seo/intel/report";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const [before]: any = await conn.query("SELECT COUNT(*) as n FROM seoIntelItems WHERE reportId = 1");
  console.log("items before delete:", JSON.stringify(before));
  const [del]: any = await conn.query("DELETE FROM seoIntelItems WHERE reportId = 1");
  console.log("deleted:", del.affectedRows);
  await conn.end();

  console.log("\n=== re-running market-intel report (daily) ===");
  const result = await runMarketIntelReport({ windowKind: "daily" });
  console.log("result summary:", JSON.stringify("skipped" in result ? result : { itemCount: result.report.itemCount, executed: result.executed, summary: result.report.summary }, null, 2));

  const conn2 = await mysql.createConnection(process.env.DATABASE_URL as string);
  const [byKind]: any = await conn2.query("SELECT kind, COUNT(*) as n FROM seoIntelItems WHERE reportId = 1 GROUP BY kind ORDER BY n DESC");
  console.log("\n=== items by kind ===");
  console.log(JSON.stringify(byKind, null, 2));

  const [decaying]: any = await conn2.query("SELECT id, title, evidence FROM seoIntelItems WHERE reportId = 1 AND kind = 'decaying_page' ORDER BY id");
  console.log("\n=== decaying_page items (full section) ===");
  console.log(JSON.stringify(decaying, null, 2));

  const [rising]: any = await conn2.query("SELECT id, title, evidence FROM seoIntelItems WHERE reportId = 1 AND kind = 'rising_query' ORDER BY id");
  console.log("\n=== rising_query items (full section) ===");
  console.log(JSON.stringify(rising, null, 2));

  await conn2.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
