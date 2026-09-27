/**
 * Record the __drizzle_migrations ledger rows for 0078 and 0079 after their
 * manual apply. Hash + created_at are derived by drizzle-orm's OWN
 * readMigrationFiles (sha256 of the raw .sql file content; created_at =
 * journal `when`) — never guessed. Idempotent: skips any migration whose hash
 * or created_at is already present.
 *
 * Both are now fully applied and verified (information_schema-confirmed
 * 2026-09-26): 0078's seoAuditLog enum widen + 4 new seoIntel* tables, and
 * 0079's fix for 0078's unique-index bug (seoIntelQuerySnapshots.snapshotKey
 * + seoIntelQuerySnapshots_key_uq).
 *
 *   tsx scripts/record-0078-0079-ledger.ts --yes-write-prod
 */
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";

const WRITE = process.argv.includes("--yes-write-prod");
const TARGETS: Array<{ tag: string; folderMillis: number }> = [
  { tag: "0078_seo_intel", folderMillis: 1790400200000 },
  { tag: "0079_seo_intel_query_key", folderMillis: 1790400300000 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
  const migs = readMigrationFiles({ migrationsFolder: folder });

  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    for (const target of TARGETS) {
      const m = migs.find(x => x.folderMillis === target.folderMillis);
      if (!m) throw new Error(`${target.tag} migration not found by folderMillis=${target.folderMillis}`);
      console.log(`\n${target.tag}: hash=${m.hash}  created_at=${m.folderMillis}`);

      const [existing] = (await conn.query(
        "SELECT id, hash, created_at FROM __drizzle_migrations WHERE hash = ? OR created_at = ?",
        [m.hash, m.folderMillis],
      )) as [Array<{ id: number; hash: string; created_at: number }>, unknown];

      if (existing.length > 0) {
        console.log(`  ↩︎ already recorded (id=${existing[0].id}) — no insert.`);
      } else if (!WRITE) {
        console.log(`  [plan] INSERT INTO __drizzle_migrations (hash, created_at) VALUES (…${target.tag} hash…, ${m.folderMillis})`);
      } else {
        await conn.query("INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)", [m.hash, m.folderMillis]);
        console.log(`  ✅ inserted ${target.tag} ledger row.`);
      }
    }
    if (!WRITE) console.log("\nDry run only — pass --yes-write-prod to insert.");

    const [tail] = (await conn.query(
      "SELECT id, LEFT(hash,12) AS hash12, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5",
    )) as [Array<{ id: number; hash12: string; created_at: number }>, unknown];
    console.log("\nlast 5 ledger rows (newest first):");
    tail.forEach(r => console.log(`   id=${r.id}  hash=${r.hash12}…  created_at=${r.created_at}`));
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("LEDGER ERR:", e instanceof Error ? e.message : e); process.exit(1); });
