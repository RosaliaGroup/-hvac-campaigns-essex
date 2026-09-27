import mysql from "mysql2/promise";

const ROWS: Array<{ tag: string; hash: string; created_at: number }> = [
  { tag: "0074_seo_nightly_candidate_tag", hash: "563db925b08804eeae59700375d314b7f27db8681723c5343b8f3af5cde1c285", created_at: 1790389500000 },
  { tag: "0075_seo_autopublish_hold", hash: "d35de624098d8cec822b675c1d4c3f3cb83f0b6e25792bf6faeebe63a0955f76", created_at: 1790389600000 },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  for (const row of ROWS) {
    const [existing]: any = await conn.query("SELECT id FROM __drizzle_migrations WHERE hash = ?", [row.hash]);
    if (existing.length > 0) { console.log(`SKIP ${row.tag}: already at id=${existing[0].id}`); continue; }
    await conn.query("INSERT INTO __drizzle_migrations (`hash`, `created_at`) VALUES (?, ?)", [row.hash, row.created_at]);
    console.log(`INSERTED ${row.tag}`);
  }
  const [after]: any = await conn.query("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 4");
  console.log(JSON.stringify(after, null, 2));
  await conn.end();
}
main().catch(e => { console.error("ERROR", e); process.exit(1); });
