/**
 * Record the __drizzle_migrations ledger row for 0066 after a manual apply.
 * Hash + created_at are derived by drizzle-orm's OWN readMigrationFiles (sha256 of the
 * raw .sql file content; created_at = journal `when`) — never guessed. Idempotent:
 * skips if a row with 0066's hash already exists.
 *
 *   tsx scripts/record-0066-ledger.ts --yes-write-prod
 */
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";

const WRITE = process.argv.includes("--yes-write-prod");
const JOURNAL_WHEN_0066 = 1785814913936; // meta/_journal.json idx 66, tag 0066_commercial_bid

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
  const migs = readMigrationFiles({ migrationsFolder: folder });
  const m = migs.find(x => x.folderMillis === JOURNAL_WHEN_0066);
  if (!m) throw new Error(`0066 migration not found by folderMillis=${JOURNAL_WHEN_0066}`);
  console.log(`0066 hash   = ${m.hash}`);
  console.log(`created_at  = ${m.folderMillis}`);

  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    const [existing] = (await conn.query(
      "SELECT id, hash, created_at FROM __drizzle_migrations WHERE hash = ? OR created_at = ?",
      [m.hash, m.folderMillis],
    )) as [Array<{ id: number; hash: string; created_at: number }>, unknown];
    if (existing.length > 0) {
      console.log(`↩︎ already recorded (id=${existing[0].id}) — no insert. Ledger idempotent.`);
    } else if (!WRITE) {
      console.log("  [plan] INSERT INTO __drizzle_migrations (hash, created_at) VALUES (…0066 hash…, " + m.folderMillis + ")");
      console.log("Dry run only — pass --yes-write-prod to insert.");
    } else {
      await conn.query("INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)", [m.hash, m.folderMillis]);
      console.log("✅ inserted 0066 ledger row.");
    }
    const [tail] = (await conn.query(
      "SELECT id, LEFT(hash,12) AS hash12, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 4",
    )) as [Array<{ id: number; hash12: string; created_at: number }>, unknown];
    console.log("\nlast 4 ledger rows (newest first):");
    tail.forEach(r => console.log(`   id=${r.id}  hash=${r.hash12}…  created_at=${r.created_at}`));
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("LEDGER ERR:", e instanceof Error ? e.message : e); process.exit(1); });
