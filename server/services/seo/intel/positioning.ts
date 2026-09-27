/**
 * §3c "Positioning check" (docs/market-intel-spec.md): are we still
 * differentiated, and does any of our own live copy no longer match
 * shared/verifiedFacts.ts. Pure classifier over already-collected competitor
 * diffs (server/services/seo/intel/competitorWatch.ts) + VERIFIED_FACTS —
 * no new I/O of its own.
 */
import { VERIFIED_FACTS, isPriceRangeStale, type VerifiedFacts } from "../../../../shared/verifiedFacts";
import type { CompetitorDiffFinding } from "../../../../shared/marketIntelTypes";

export type DifferentiatorMatch = { differentiator: string; competitor: string; evidence: string };
export type OurStaleClaim = { page: string; issue: string };

/** Our differentiator backlog (§3c bullet list) with a pattern that would indicate a competitor now claims the same thing. */
const DIFFERENTIATOR_PATTERNS: Array<{ key: string; label: string; re: RegExp }> = [
  { key: "warranty_10yr", label: "10-yr parts & labor", re: /\b10[\s-]?year[s]?\b.{0,20}\b(parts?|labor)\b/i },
  { key: "existing_system_coverage", label: "existing-system coverage", re: /\bexisting\s+(system|equipment|hvac)\b.{0,30}\b(coverage|warranty|eligible)\b/i },
  { key: "membership", label: "membership", re: /\bmembership\b|\bmaintenance\s+plan\b/i },
  { key: "published_price_ranges", label: "published price ranges", re: /\$[\d,]+\s?[-–—]\s?\$[\d,]+/ },
  { key: "portfolio_per_unit_pricing", label: "portfolio per-unit pricing", re: /\bper[\s-]?unit\b.{0,20}\bpric/i },
  { key: "monitoring", label: "monitoring", re: /\b24\/7\s+monitoring\b|\bremote\s+monitoring\b/i },
];

/** For each competitor diff whose new/changed text matches one of our differentiators, flag it (§3c: "does any watched competitor now claim the same?"). */
export function detectDifferentiatorMatches(diffs: CompetitorDiffFinding[]): DifferentiatorMatch[] {
  const findings: DifferentiatorMatch[] = [];
  for (const diff of diffs) {
    const text = diff.after ?? "";
    if (!text) continue;
    for (const d of DIFFERENTIATOR_PATTERNS) {
      if (d.re.test(text)) {
        findings.push({ differentiator: d.label, competitor: diff.competitor, evidence: text });
      }
    }
  }
  return findings;
}

/**
 * §3c bullet 2 — "any live page whose text no longer matches verifiedFacts.ts
 * (price range asOf > 180 days...)". First-pass scope: reuses the SAME
 * isPriceRangeStale() check server/services/seo/nightlyDraftJob.ts and
 * contentPipeline.ts already run nightly/weekly (see their
 * warnOnStalePriceRanges()) rather than re-deriving it — this just turns it
 * into a reportable item instead of a console.warn. Empty today because
 * VERIFIED_FACTS.priceRanges is empty (owner hasn't set any yet — see that
 * file's own comment), same reason those two console.warn calls are no-ops.
 * "A discount percentage that changed" / "a program figure updated in the
 * facts file but not on a page" (the rest of §3c bullet 2) would need a
 * page-content scan against VERIFIED_FACTS keyed by page — deferred (see
 * build report): no such per-page fact-to-copy mapping exists yet anywhere
 * in this codebase to reuse.
 */
export function auditOurStaleClaims(facts: VerifiedFacts = VERIFIED_FACTS, now: Date = new Date()): OurStaleClaim[] {
  const findings: OurStaleClaim[] = [];
  for (const range of facts.priceRanges) {
    if (isPriceRangeStale(range, now)) {
      findings.push({ page: range.page, issue: `Price range for "${range.item}" was last confirmed ${range.asOf}, more than 180 days ago.` });
    }
  }
  return findings;
}
