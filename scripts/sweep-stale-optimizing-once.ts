import mysql from "mysql2/promise";
import { sweepStaleOptimizingPages } from "../server/services/seo/draftManagement";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const [[nowRow]]: any = await conn.query("SELECT NOW() as now");
  const dbNow = new Date(nowRow.now);
  console.log("using DB NOW() as reference time:", dbNow.toISOString());

  const [before]: any = await conn.query(
    "SELECT COUNT(*) as n FROM seoPages WHERE status='optimizing' AND updatedAt < ?",
    [new Date(dbNow.getTime() - 30 * 60 * 1000)],
  );
  console.log("stale (>30min) before sweep:", JSON.stringify(before));
  await conn.end();

  const result = await sweepStaleOptimizingPages(dbNow);
  console.log("sweep result:", JSON.stringify(result));
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
