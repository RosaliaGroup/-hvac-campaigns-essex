/**
 * §2.4 Google Trends (docs/market-intel-spec.md) — "public endpoint,
 * best-effort". Google's public Trends endpoints require an undocumented
 * two-step token handshake (an initial `explore` call returns a per-widget
 * token that a second `multiline`/`interestOverTime` call must echo back) and
 * are not a stable, versioned public API — calling them from a production
 * server is fragile enough (frequent shape/rate-limit changes) that it
 * deserves its own spike rather than being built sight-unseen here.
 *
 * First-pass decision (reported, not silently skipped): this module is a
 * CLEARLY MARKED STUB. isTrendsAvailable() always false; collectTrends()
 * always returns "not implemented". §3a's classifySeasonality() in
 * searchDemand.ts is fully built and fixture-tested against the
 * MonthlyInterestSeries shape Trends would eventually supply — wiring a real
 * fetch in later only means implementing collectTrends() below.
 */
export type TrendsResult = { checked: boolean; reason: string; risingTerms: string[] };

export function isTrendsAvailable(): boolean {
  return false;
}

export async function collectTrends(): Promise<TrendsResult> {
  return {
    checked: false,
    reason: "Google Trends fetch not implemented in this first pass (undocumented public API — see server/services/seo/intel/trends.ts header). classifySeasonality() in searchDemand.ts is ready for it.",
    risingTerms: [],
  };
}
