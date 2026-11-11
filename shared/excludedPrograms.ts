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

/**
 * Owner decision 2026-11-10: no residential rebate promotion in new copy. The 49 posts whose whole topic is
 * rebates / incentives / tax credits / utility programs stay live exactly as they are ("just leave them") —
 * the automatic writers never refresh them and the meta lane never rewrites their title/description.
 * Everywhere else, new or rewritten copy must not mention rebates, incentives, tax credits or utility programs.
 */
export const KEPT_REBATE_TOPIC_POSTS: readonly string[] = [
  "nj-heat-pump-rebates-2026",
  "nj-hvac-rebates-2026-complete-guide",
  "pseg-heat-pump-rebates-explained",
  "nj-clean-heat-program-2026",
  "hvac-rebates-essex-county-nj",
  "nj-on-bill-repayment-zero-upfront-hvac",
  "commercial-hvac-rebates-nj-2026",
  "federal-25c-tax-credit-hvac-2026",
  "is-nj-hvac-rebate-worth-it-honest-answer",
  "r22-heat-pump-upgrade-nj-rebates",
  "pseg-rebate-r22-replacement-nj",
  "r22-oil-heat-replacement-nj",
  "r22-essex-county-nj",
  "r22-hudson-county-nj",
  "r22-bergen-county-nj",
  "r22-passaic-county-nj",
  "hvac-rebates-bergen-county-nj",
  "hvac-rebates-hudson-county-nj",
  "hvac-rebates-passaic-county-nj",
  "hvac-rebates-union-county-nj",
  "hvac-rebates-middlesex-county-nj",
  "hvac-rebates-morris-county-nj",
  "hvac-rebates-somerset-county-nj",
  "hvac-rebates-mercer-county-nj",
  "hvac-rebates-monmouth-county-nj",
  "hvac-rebates-ocean-county-nj",
  "oil-to-electric-heat-nj-rebates",
  "commercial-heat-pump-rebates-nj",
  "pseg-approved-hvac-contractor-nj",
  "pseg-instant-rebate-program-nj",
  "pseg-on-bill-repayment-hvac",
  "pseg-clean-heat-program-nj",
  "pseg-rebate-application-process",
  "pseg-rebate-vs-federal-tax-credit",
  "pseg-commercial-rebates-nj",
  "pseg-rebate-income-qualified-nj",
  "hvac-tax-credits-2026-nj",
  "nj-clean-energy-program-hvac",
  "smart-thermostat-nj-rebates",
  "pseg-rebate-denied-what-to-do-nj",
  "pseg-rebate-timeline-how-long-2026",
  "nj-hvac-rebate-income-limits-2026",
  "stack-nj-hvac-rebates-maximum-savings-2026",
  "pseg-whole-house-program-nj-2026",
  "free-energy-audit-nj-pseg-2026",
  "nj-hvac-rebate-calculator-how-much-can-i-save",
  "inflation-reduction-act-hvac-nj",
  "free-hvac-system-nj-programs-2026",
  "zero-percent-financing-hvac-nj-2026",
];

/** Rebate / incentive / tax-credit / utility-program wording that new copy must not use (owner, 2026-11-10). */
export const REBATE_PROMO_RE = /\brebates?\b|\bincentives?\b|\btax credits?\b|\b25C\b|\bclean heat\b|\bon[-\s]?bill\b|\bOBR\b/i;

function normalizePath(pathOrSlug: string): string {
  return pathOrSlug.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^\/?(?:blog\/)?/, "");
}

/** True for one of the kept rebate-topic posts, given "/blog/<slug>", "blog/<slug>" or "<slug>". */
export function isKeptRebateTopicPost(pathOrSlug: string): boolean {
  return KEPT_REBATE_TOPIC_POSTS.includes(normalizePath(pathOrSlug));
}

/**
 * Pages whose title/description may still name rebates/incentives: the kept rebate-topic posts (left as-is)
 * and the commercial Direct Install / commercial pages (B2B utility programs, not residential promos).
 */
export function isRebateWordingExemptPath(pagePath: string): boolean {
  const p = pagePath.trim().replace(/[?#].*$/, "");
  if (/^\/blog\//.test(p)) return isKeptRebateTopicPost(p);
  return /^\/(?:direct-install|commercial)(?:[\/-]|$)/.test(p);
}
