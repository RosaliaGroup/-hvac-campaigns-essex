/**
 * Singleton-row repo for `socialLaneState` (id always 1) — the circuit-
 * breaker flag the Social Lane reads/writes (docs/social-lane-spec.md §7).
 * Mirrors server/services/seo/autopublishStateRepo.ts's pattern exactly.
 * getState() self-heals a missing row so a fresh/reset dev DB doesn't
 * hard-fail every check even though migration 0076 seeds it.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { socialLaneState, type SocialLaneStateRow } from "../../../drizzle/schema";

const ROW_ID = 1;

const DEFAULTS: Omit<SocialLaneStateRow, "id" | "updatedAt"> = {
  circuitBreakerPaused: false,
  circuitBreakerReason: null,
  circuitBreakerPausedAt: null,
};

export async function getSocialLaneState(): Promise<SocialLaneStateRow> {
  const db = await getDb();
  if (!db) {
    return { id: ROW_ID, updatedAt: new Date(), ...DEFAULTS };
  }
  const [row] = await db.select().from(socialLaneState).where(eq(socialLaneState.id, ROW_ID)).limit(1);
  if (row) return row;

  await db.insert(socialLaneState).values({ id: ROW_ID, ...DEFAULTS }).onDuplicateKeyUpdate({ set: {} });
  const [seeded] = await db.select().from(socialLaneState).where(eq(socialLaneState.id, ROW_ID)).limit(1);
  return seeded ?? { id: ROW_ID, updatedAt: new Date(), ...DEFAULTS };
}

export async function updateSocialLaneState(
  patch: Partial<Omit<SocialLaneStateRow, "id" | "updatedAt">>,
): Promise<SocialLaneStateRow> {
  const db = await getDb();
  if (!db) return { ...(await getSocialLaneState()), ...patch };
  await getSocialLaneState();
  await db.update(socialLaneState).set(patch).where(eq(socialLaneState.id, ROW_ID));
  return getSocialLaneState();
}
