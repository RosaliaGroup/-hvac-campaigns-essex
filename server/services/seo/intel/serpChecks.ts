/**
 * §2.3 SERP checks (docs/market-intel-spec.md). Optional-config-gated exactly
 * as the spec requires: "if SEO_SERP_PROVIDER configured... otherwise
 * skipped." No provider integration is built in this first pass (SerpAPI /
 * DataForSEO / Ahrefs each need a real account + API contract decision the
 * spec leaves to the owner) — this module is the guard + the shape the report
 * expects, ready for a real provider call to be dropped in behind
 * isSerpConfigured() without touching any caller.
 */
export type SerpCheckResult = { checked: boolean; reason: string; risingEntrants: string[]; aboveUs: string[] };

export function isSerpConfigured(): boolean {
  return !!process.env.SEO_SERP_PROVIDER?.trim();
}

/**
 * Real I/O placeholder: returns "not configured" unless SEO_SERP_PROVIDER is
 * set, in which case it still reports "not implemented" rather than silently
 * pretending to have real data — first-pass scope decision, see build report.
 */
export async function collectSerpChecks(): Promise<SerpCheckResult> {
  if (!isSerpConfigured()) {
    return { checked: false, reason: "SEO_SERP_PROVIDER not set — SERP section skipped (report relies on GSC).", risingEntrants: [], aboveUs: [] };
  }
  return {
    checked: false,
    reason: `SEO_SERP_PROVIDER="${process.env.SEO_SERP_PROVIDER}" is configured, but no provider integration is implemented yet (first-pass gap — see market-intel PR description).`,
    risingEntrants: [],
    aboveUs: [],
  };
}
