import { sql } from "drizzle-orm";
import { getDb } from "../../db";

export function dailyResearchLimit(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.CRM_PROFILE_DAILY_LIMIT ?? 10);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 10;
}

/** Unique day/slot reservations survive restarts and serialize concurrent workers. */
export async function reserveProfileResearch(now = new Date()): Promise<boolean> {
  const limit = dailyResearchLimit();
  if (limit === 0) return false;
  const db = await getDb();
  if (!db) throw new Error("Profile research budget unavailable");
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmProfileResearchBudget (
    day date NOT NULL, slot int NOT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, slot)
  )`);
  const day = now.toISOString().slice(0, 10);
  for (let slot = 1; slot <= limit; slot++) {
    const result = await db.execute(sql`INSERT IGNORE INTO crmProfileResearchBudget (day, slot) VALUES (${day}, ${slot})`);
    if (Number((result as any)?.[0]?.affectedRows ?? 0) === 1) return true;
  }
  return false;
}

/** Research slots still free today (0 when the allowance is used up or the table is missing). */
export async function profileResearchRemaining(now = new Date()): Promise<number> {
  const limit = dailyResearchLimit();
  if (limit === 0) return 0;
  const db = await getDb();
  if (!db) return 0;
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS n FROM crmProfileResearchBudget WHERE day = ${now.toISOString().slice(0, 10)}`);
    return Math.max(0, limit - Number((r as any)?.[0]?.[0]?.n ?? 0));
  } catch {
    return limit; // table not created yet: nothing used today
  }
}
