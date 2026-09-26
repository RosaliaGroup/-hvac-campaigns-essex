/**
 * The 20 target queries the market-intel job tracks (docs/market-intel-spec.md
 * §8 "the 20 target queries (seed from the audit)"). Used by §2.3 SERP checks,
 * §2.4 Google Trends, and as the join key for §3a "search demand" evidence.
 *
 * Owner-editable in principle (§8) — first pass is a static list; no CRM
 * editing UI exists yet (see docs/market-intel-spec.md build report — this is
 * a documented first-pass gap, same convention as shared/competitorWatchlist.ts).
 */
export const TARGET_QUERIES: string[] = [
  "commercial HVAC contractor NJ",
  "multifamily HVAC contractor NJ",
  "HVAC subcontractor NJ",
  "mechanical contractor NJ",
  "MWBE HVAC contractor NJ",
  "property management HVAC contractor NJ",
  "HVAC maintenance contracts NJ",
  "PTAC replacement NJ",
  "heat pump installation NJ",
  "central AC replacement cost NJ",
  "mini split installation NJ",
  "HVAC warranty NJ",
  "HVAC financing NJ",
  "commercial HVAC Newark NJ",
  "HVAC contractor Newark NJ",
  "HVAC Essex County",
  "emergency HVAC repair NJ",
  "PSE&G heat pump rebate",
  "NJ HVAC rebates 2026",
  "on-bill repayment HVAC NJ",
];
