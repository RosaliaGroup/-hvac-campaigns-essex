/**
 * Competitor watchlist (docs/market-intel-spec.md §2.2, §8). Owner-editable
 * "in the CRM" per spec — first pass ships this as a static, code-reviewed
 * seed list (§8's own list) with the "top 3 domains appearing above us for
 * each of our 20 target queries" auto-discovery left as a documented gap (it
 * depends on §2.3 SERP checks, which are themselves optional/config-gated —
 * see server/services/seo/intel/serpChecks.ts). No CRM add/remove UI exists
 * yet; editing this list today means a code change + PR, same as any other
 * `shared/` constant in this codebase (e.g. shared/verifiedFacts.ts).
 *
 * `domain` is deliberately left blank for every seeded name below: nothing in
 * this codebase has verified which literal domain each of these NJ HVAC
 * competitors owns, and guessing one risks the daily fetch (§2.2) silently
 * scraping the wrong company's site. `domainVerified` stays false — and
 * server/services/seo/intel/competitorWatch.ts SKIPS the fetch entirely —
 * until the owner fills in a confirmed `domain` and flips it to true. This
 * mirrors shared/verifiedFacts.ts's convention (null/empty until verified,
 * never a guessed placeholder that could be mistaken for a real fact).
 */
export type WatchedCompetitor = {
  name: string;
  /** Confirmed domain, e.g. "example.com". Empty until the owner verifies it. */
  domain: string;
  /** Must be explicitly set true by the owner after confirming `domain` — see file header. */
  domainVerified: boolean;
  /** Paths to watch daily, relative to the domain (§2.2: homepage, warranty/guarantee, financing, commercial, pricing, service-area). */
  pages: string[];
  /** Queries (from TARGET_QUERIES, or a subset) this competitor is known to compete with us on. */
  queries: string[];
  /** True once auto-discovered from a SERP check rather than seeded by hand (§2.2 "auto-discovered"). */
  autoDiscovered?: boolean;
};

export const COMPETITOR_WATCHLIST: WatchedCompetitor[] = [
  { name: "A.J. Perri", domain: "", domainVerified: false, pages: ["/"], queries: ["emergency HVAC repair NJ", "HVAC financing NJ"] },
  { name: "Gold Medal", domain: "", domainVerified: false, pages: ["/"], queries: ["HVAC warranty NJ", "central AC replacement cost NJ"] },
  { name: "Horizon", domain: "", domainVerified: false, pages: ["/"], queries: ["emergency HVAC repair NJ"] },
  { name: "Hutchinson", domain: "", domainVerified: false, pages: ["/"], queries: ["commercial HVAC contractor NJ", "multifamily HVAC contractor NJ"] },
  { name: "Reiner Group", domain: "", domainVerified: false, pages: ["/"], queries: ["commercial HVAC contractor NJ", "HVAC subcontractor NJ"] },
  { name: "Air2Cool", domain: "", domainVerified: false, pages: ["/"], queries: ["heat pump installation NJ", "mini split installation NJ"] },
  { name: "Springfield Heating & AC", domain: "", domainVerified: false, pages: ["/"], queries: ["HVAC contractor Newark NJ", "HVAC Essex County"] },
  { name: "Echelon Services", domain: "", domainVerified: false, pages: ["/"], queries: ["commercial HVAC contractor NJ"] },
  { name: "OM HVAC", domain: "", domainVerified: false, pages: ["/"], queries: ["mechanical contractor NJ", "HVAC subcontractor NJ"] },
];

/** Only the entries safe to actually fetch (§2.2's "respect robots.txt... no login walls" starts with "confirmed real domain"). */
export function fetchableCompetitors(list: WatchedCompetitor[] = COMPETITOR_WATCHLIST): WatchedCompetitor[] {
  return list.filter((c) => c.domainVerified && c.domain.trim().length > 0);
}
