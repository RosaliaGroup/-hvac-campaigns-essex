/**
 * Shared constants/helpers for the opportunity 3-day close loop.
 *
 * The loop materialises (see server/integrations/accounting/followups.ts):
 *   - a same-day `call` task (loopStep 0),
 *   - `email` + `text` touches on a 0 / 1 / 3-day cadence,
 *   - a day-3 `call` "forced decision" task (loopStep 3) — the prompt to
 *     disposition the deal (Won / Lost / Follow-up-later) once the touches run out.
 *
 * The decision task is identified STRUCTURALLY by (type=call, loopStep=3) rather
 * than by a new enum value, so it needs no schema migration. The same-day call is
 * loopStep 0, and the day-3 email/text touches are not `call`, so this pair is
 * unambiguous. Both server (builder) and client (banner) import from here so the
 * marker never drifts between them.
 */
export const DECISION_TASK_LOOP_STEP = 3;

/** True for the day-3 forced-decision call task. */
export function isDecisionTask(t: { type: string; loopStep: number }): boolean {
  return t.type === "call" && t.loopStep === DECISION_TASK_LOOP_STEP;
}
