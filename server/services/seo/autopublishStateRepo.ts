/**
 * Singleton-row repo for `seoAutopublishState` (id always 1) — the warm-up
 * counters and circuit-breaker flag both lanes read/write (addendum §A5).
 * getState() self-heals a missing row (defensive: migration 0073 seeds it,
 * but a fresh/reset dev DB shouldn't hard-fail every autopublish check).
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { seoAutopublishState, type SeoAutopublishStateRow } from "../../../drizzle/schema";
import { WARMUP_DEFAULTS } from "./warmupConfig";

const ROW_ID = 1;

const DEFAULTS: Omit<SeoAutopublishStateRow, "id" | "updatedAt"> = {
  metaWarmupRemaining: WARMUP_DEFAULTS.meta,
  contentWarmupRemaining: WARMUP_DEFAULTS.content,
  circuitBreakerPaused: false,
  circuitBreakerReason: null,
  circuitBreakerPausedAt: null,
};

export async function getAutopublishState(): Promise<SeoAutopublishStateRow> {
  const db = await getDb();
  if (!db) {
    return { id: ROW_ID, updatedAt: new Date(), ...DEFAULTS };
  }
  const [row] = await db.select().from(seoAutopublishState).where(eq(seoAutopublishState.id, ROW_ID)).limit(1);
  if (row) return row;

  await db.insert(seoAutopublishState).values({ id: ROW_ID, ...DEFAULTS }).onDuplicateKeyUpdate({ set: {} });
  const [seeded] = await db.select().from(seoAutopublishState).where(eq(seoAutopublishState.id, ROW_ID)).limit(1);
  return seeded ?? { id: ROW_ID, updatedAt: new Date(), ...DEFAULTS };
}

export async function updateAutopublishState(
  patch: Partial<Omit<SeoAutopublishStateRow, "id" | "updatedAt">>,
): Promise<SeoAutopublishStateRow> {
  const db = await getDb();
  if (!db) return { ...(await getAutopublishState()), ...patch };
  await getAutopublishState(); // ensures the row exists before the UPDATE below
  await db.update(seoAutopublishState).set(patch).where(eq(seoAutopublishState.id, ROW_ID));
  return getAutopublishState();
}
