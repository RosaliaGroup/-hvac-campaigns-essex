import mysql from "mysql2/promise";
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const [before]: any = await conn.query("SELECT COUNT(*) as n FROM seoContentQueue");
  console.log("before:", JSON.stringify(before));

  const [groups]: any = await conn.query(
    "SELECT refreshesSlug, source, MIN(id) as keepId, COUNT(*) as n FROM seoContentQueue WHERE refreshesSlug IS NOT NULL GROUP BY refreshesSlug, source HAVING n > 1"
  );
  console.log("duplicate groups:", JSON.stringify(groups));

  let deleted = 0;
  for (const g of groups) {
    const [result]: any = await conn.query(
      "DELETE FROM seoContentQueue WHERE refreshesSlug = ? AND source = ? AND id != ?",
      [g.refreshesSlug, g.source, g.keepId],
    );
    console.log(`  ${g.refreshesSlug}: kept id=${g.keepId}, deleted ${result.affectedRows}`);
    deleted += result.affectedRows;
  }

  const [after]: any = await conn.query("SELECT COUNT(*) as n FROM seoContentQueue");
  console.log("after:", JSON.stringify(after), "total deleted:", deleted);
  await conn.end();
}
main().catch(e => { console.error("ERROR", e); process.exit(1); });
