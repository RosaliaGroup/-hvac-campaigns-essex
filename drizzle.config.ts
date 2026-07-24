// ⚠️ PRODUCTION MIGRATIONS ARE MANUAL-ONLY — never run `db:push` / `drizzle-kit migrate`
// against production (tracker is hand-reconciled; head 0054 while journal is 0056).
// See ./drizzle/README.md before touching the database.
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
