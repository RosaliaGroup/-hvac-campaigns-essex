import { runMarketIntelReport } from "../server/services/seo/intel/report";
import mysql from "mysql2/promise";

async function main() {
  console.log("=== running market-intel report (daily) ===");
  const result = await runMarketIntelReport({ windowKind: "daily" });
  console.log("result:", JSON.stringify(result, null, 2));

  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const [state]: any = await conn.query("SELECT * FROM seoAutopublishState WHERE id = 1");
  console.log("\n=== seoAutopublishState (warm-up counters) after run ===");
  console.log(JSON.stringify(state, null, 2));
  const [reports]: any = await conn.query("SELECT id, date, windowKind, itemCount, createdAt FROM seoIntelReports ORDER BY id DESC LIMIT 3");
  console.log("\n=== seoIntelReports after run ===");
  console.log(JSON.stringify(reports, null, 2));
  await conn.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
