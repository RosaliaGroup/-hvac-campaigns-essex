/**
 * Keeps opportunities.stageId in lockstep with the legacy `stage` enum for the
 * NON-commercial insert paths (QBO sync + CRM manual create), so a coexistence
 * row never lands with a NULL stageId. Commercial rows set stageId directly from
 * the commercial pipeline and don't use this.
 *
 * The residential pipeline seeded by migration 0065 uses the enum values as its
 * stageKeys, so the mapping is a direct stageKey lookup. Best-effort: if the
 * residential stages aren't seeded yet (code deployed before 0065 is hand-applied),
 * it returns null and the row falls back to the pre-0065 behaviour (enum only) —
 * never throws, never blocks an insert.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { opportunityStages } from "../../drizzle/schema";

type AnyDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** The pipeline the legacy `stage` enum maps onto (seeded by 0065). */
export const RESIDENTIAL_PIPELINE_KEY = "residential";

/** Resolve the residential-pipeline stageId for a `stage` enum value, or null. */
export async function deriveResidentialStageId(db: AnyDb, stage: string | null | undefined): Promise<number | null> {
  if (!stage) return null;
  try {
    const row = (
      await db
        .select({ id: opportunityStages.id })
        .from(opportunityStages)
        .where(and(eq(opportunityStages.pipelineKey, RESIDENTIAL_PIPELINE_KEY), eq(opportunityStages.stageKey, stage)))
        .limit(1)
    )[0];
    return row?.id ?? null;
  } catch {
    // Table/rows not present yet (pre-0065 apply) — fall back to enum-only.
    return null;
  }
}
