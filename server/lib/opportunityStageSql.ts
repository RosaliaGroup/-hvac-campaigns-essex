/**
 * Server SQL fragments for opportunity stages, built from the single source of truth
 * (shared/stageMeta.ts via opportunityDashboard). Keeps weighted-pipeline SQL and
 * stage ordering in sync with STAGE_META so the A1-added stages are never dropped or
 * zero-weighted in the DB path.
 */
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { STAGE_DEFAULT_PROBABILITY, STAGE_ORDER, isParkedStage } from "@shared/opportunityDashboard";

/**
 * `CASE <stageCol> WHEN 'stage' THEN <default probability> ... ELSE 0 END` for every
 * NON-parked enum member — so weighted pipeline value counts the A1-added open stages
 * with their funnel default, instead of the old hardcoded CASE that fell through to 0.
 *
 * PARKED stages (follow_up_later) are deliberately omitted: a parked deal is not open
 * pipeline and must contribute ZERO to weighted value, so it falls through to ELSE 0.
 * Mirrors the parked short-circuit in weightedValue() on the JS side.
 */
export function stageDefaultProbabilityCase(stageCol: SQLWrapper): SQL {
  const whens = STAGE_ORDER
    .filter(s => !isParkedStage(s))
    .map(s => sql`WHEN ${s} THEN ${STAGE_DEFAULT_PROBABILITY[s]}`);
  return sql`CASE ${stageCol} ${sql.join(whens, sql` `)} ELSE 0 END`;
}

/** `FIELD(<stageCol>, ...)` in board/funnel order — for ORDER BY stage. */
export function stageFieldOrder(stageCol: SQLWrapper): SQL {
  return sql`FIELD(${stageCol}, ${sql.join(STAGE_ORDER.map(s => sql`${s}`), sql`, `)})`;
}
