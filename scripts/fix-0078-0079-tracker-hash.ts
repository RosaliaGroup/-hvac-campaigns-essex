import mysql from "mysql2/promise";

const FIXES: Array<{ tag: string; badHash: string; goodHash: string; created_at: number }> = [
  { tag: "0078_seo_intel", badHash: "d41598fa93859bc8d887c179b827dbbdf66465f4df37bb93cda071b8f8e1f0bc", goodHash: "2635cd8ea809ff19adf79b151238258b79b1bbd30c4bf025fa7b1aa8ba3683f7", created_at: 1790400200000 },
  { tag: "0079_seo_intel_query_key", badHash: "391a965782aeef34ca5b0b199374c46895d0f9b28c1da6eaee34b743be2d5a06", goodHash: "2b2b4a87a73b4a787fde6fcdbaec204be8b0101a1450fce79799df2fddd5e4f1", created_at: 1790400300000 },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  for (const f of FIXES) {
    const [rows]: any = await conn.query("SELECT id FROM __drizzle_migrations WHERE hash = ?", [f.badHash]);
    if (rows.length === 0) { console.log(`${f.tag}: bad hash not found (already fixed?), skipping`); continue; }
    for (const r of rows) {
      await conn.query("DELETE FROM __drizzle_migrations WHERE id = ?", [r.id]);
      console.log(`${f.tag}: deleted bad row id=${r.id}`);
    }
    await conn.query("INSERT INTO __drizzle_migrations (`hash`, `created_at`) VALUES (?, ?)", [f.goodHash, f.created_at]);
    console.log(`${f.tag}: inserted corrected row`);
  }
  const [after]: any = await conn.query("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 6");
  console.log(JSON.stringify(after, null, 2));
  await conn.end();
}
main().catch(e => { console.error("ERROR", e); process.exit(1); });
