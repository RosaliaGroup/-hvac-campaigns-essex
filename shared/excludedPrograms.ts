/**
 * Programs the owner has excluded from all marketing copy (owner decision 2026-10-30: "not PSE&G OBR").
 * The program is still a verified fact (VERIFIED_FACTS.incentives), so the critic and the site's own pages
 * keep it; but the content writers never see it and the content linter blocks any new draft that names it.
 */
import type { VerifiedFacts } from "./verifiedFacts";

export const EXCLUDED_PROGRAM_RE = /\bon[-\s]?bill\b|\bOBR\b/i;

/** VERIFIED_FACTS minus excluded programs — what the drafting prompts are given. */
export function factsForWriters<T extends Pick<VerifiedFacts, "incentives">>(facts: T): T {
  return { ...facts, incentives: facts.incentives.filter((i) => !EXCLUDED_PROGRAM_RE.test(`${i.program} ${i.amountText}`)) };
}
