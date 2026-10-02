/**
 * The autopublish fact firewall (docs/seo-automation-addendum-autopublish.md
 * §A3). The model is never the source of any number, name, program, date or
 * credential — it may only use facts from THIS file. Everything below is
 * either lifted from an already-verified, already-published source elsewhere
 * in this codebase (cited per field), or deliberately left empty/null with a
 * comment explaining why, matching the existing convention in
 * client/src/pages/SeoLandingPage.tsx ("documented placeholders... must be
 * supplied before any ... claim is added").
 *
 * `incentives`, `certifications` and `projects` are the owner's to fill in —
 * nothing here invents a dollar figure, a credential or a client name. Both
 * autopublish lanes stay off (see isFactsConfigured()) until `incentives` has
 * at least one entry with a `verifiedOn` date.
 */
import { PHONE_DISPLAY, PHONE_E164 } from "./business";

/**
 * Mirrors the county keys in client/src/data/njCounties.ts (the city-page
 * registry — every county actually backed by a dedicated `/hvac-<city>-nj`
 * page). Inlined rather than imported: `shared/` is meant to be the lowest
 * layer both client and server depend on, and reaching from here back into
 * `client/src/` would invert that. If the registry gains or loses a county,
 * update this list too — shared/verifiedFacts.test.ts checks the two stay
 * in sync.
 */
const CITY_REGISTRY_COUNTIES = ["Essex", "Hudson", "Bergen", "Passaic", "Union", "Middlesex", "Morris", "Sussex", "Somerset"];

export type VerifiedIncentive = {
  program: string;
  amountText: string;
  /** ISO date the owner last confirmed this figure is current. */
  verifiedOn: string;
  source: string;
};

export type VerifiedCertification = {
  name: string;
  verifiedOn: string;
  source: string;
};

export type VerifiedProject = {
  /** Kept deliberately generic (no client name) unless the owner has consent on file. */
  description: string;
  verifiedOn: string;
};

export type VerifiedWarranty = {
  headline: string;
  years: number;
  covers: string;
  deductible: number;
  included: boolean;
  availableFor: string[];
  brands: string;
  administration: string;
  eligibilityNote: string;
  termsUrl: string;
  verifiedOn: string;
  source: string;
};

export type VerifiedMembership = {
  name: string;
  includes: string[];
  billing: string;
  /** No price appears anywhere on the site until the owner sets this. */
  priceText: string | null;
  verifiedOn: string | null;
};

export type VerifiedPriceRange = {
  /** Page path this range applies to, e.g. "/heat-pump-installation-nj". */
  page: string;
  item: string;
  low: number;
  high: number;
  /** ISO date the range was last confirmed — checked for 180-day staleness (isPriceRangeStale()). */
  asOf: string;
  notes: string;
};

export type VerifiedReplacementCredit = {
  /** No percentage appears anywhere on the site until the owner sets this. */
  percentOfPremiums: number | null;
  cap: number | null;
  conditions: string[];
};

export type VerifiedPortfolioSla = {
  /** No SLA-hour claim appears anywhere on the site until the owner sets this. */
  responseHours: number | null;
  reportingCadence: string;
  unitTypes: string[];
  pricingBasis: string;
};

export type VerifiedMonitoring = {
  /** The model can't name a thermostat brand that isn't listed here. */
  thermostatBrands: string[];
  included: string;
  optIn: boolean;
  /** "24/7 monitoring" may only be claimed once the owner sets this true (spec §9e). */
  is24x7: boolean;
};

export type VerifiedServiceHours = {
  /** "24/7", "around the clock" emergency service may only be claimed once the owner sets this true. */
  emergency24x7: boolean;
  /** "same-day" service may only be claimed once the owner sets this true. */
  sameDay: boolean;
};

export type VerifiedFacts = {
  business: {
    legalName: string;
    phone: string;
    /**
     * No verified street address exists anywhere in this codebase today —
     * see client/src/pages/SeoLandingPage.tsx's own placeholder note. Stays
     * null until the owner supplies one; nothing may claim an address until then.
     */
    address: string | null;
    /**
     * From the city-page registry (client/src/data/njCounties.ts) — every
     * county actually backed by a dedicated `/hvac-<city>-nj` page. NOTE:
     * marketing copy elsewhere (e.g. AIAssistantPrompts.tsx) claims "15
     * counties" served; only these are backed by structural content. The
     * fact firewall uses the provable, narrower list.
     */
    serviceCounties: string[];
    /** Not a founding date — no verified founding year exists in the codebase (see `founded`). */
    yearsInBusiness: number;
    /** Deliberately null: no verified founding year exists anywhere in the codebase. Owner-supplied only. */
    founded: number | null;
    /**
     * NJ HVAC contractor license, as the owner wants it stated (type + number). Null until the owner supplies it —
     * nothing renders a license claim until then (the /company entity page and llms.txt omit the line).
     */
    license: { text: string; verifiedOn: string; source: string } | null;
    /** Business hours, plain text (e.g. "Mon–Fri 8am–5pm"). Null until the owner supplies it — nothing renders hours until then. */
    hours: { text: string; verifiedOn: string; source: string } | null;
  };
  /** Owner-maintained. Empty until the owner verifies at least one current incentive figure. */
  incentives: VerifiedIncentive[];
  /** The live, individually-routed service pages (client/src/App.tsx's ServicePage routes) — excludes the two rebate/financing landing pages on the same template ("Heat Pump Rebates NJ", "HVAC Financing"), which describe incentives, not a service performed. */
  services: string[];
  /** Empty until certification documentation is provided (spec: "all certification wording BLOCKS" until then). */
  certifications: VerifiedCertification[];
  /** Empty until verified, consented project descriptions exist. */
  projects: VerifiedProject[];
  /**
   * docs/positioning-warranty-spec.md §1. The administrator/insurer names are
   * deliberately NOT here — the spec keeps them out of marketing copy,
   * naming them only in the written agreement and the /warranty terms
   * disclosure line (which is hand-authored, not model-drafted).
   */
  warranty: VerifiedWarranty;
  /** docs/positioning-warranty-spec.md §9a. `priceText` stays null until the owner sets it — no price renders until then. */
  membership: VerifiedMembership;
  /** docs/positioning-warranty-spec.md §9b. Empty until the owner supplies real ranges — nothing here is model- or Claude-invented. */
  priceRanges: VerifiedPriceRange[];
  /** docs/positioning-warranty-spec.md §9c. Both fields null until the owner sets them — no percentage renders until then. */
  replacementCredit: VerifiedReplacementCredit;
  /** docs/positioning-warranty-spec.md §9d. `responseHours` null until the owner sets it — no SLA-hour claim renders until then. */
  portfolioSla: VerifiedPortfolioSla;
  /** docs/positioning-warranty-spec.md §9e. */
  monitoring: VerifiedMonitoring;
  /** Service-hours claims (24/7, around the clock, same-day) — all false until the owner confirms them. */
  serviceHours: VerifiedServiceHours;
};

export const VERIFIED_FACTS: VerifiedFacts = {
  business: {
    // client/src/components/DashboardFooter.tsx, client/src/pages/BlogPost.tsx JSON-LD, AIAssistantPrompts.tsx
    legalName: "Mechanical Enterprise LLC",
    // shared/business.ts — the single canonical number (two were in use; this is the correct, live one).
    phone: PHONE_DISPLAY,
    // shared/business.ts has no address field — no verified street address exists
    // anywhere in this codebase (see the field comment above). Stays null; this
    // was asked to be sourced from shared/business.ts alongside phone, but that
    // file only has phone constants — flagging the mismatch rather than inventing one.
    address: null,
    serviceCounties: CITY_REGISTRY_COUNTIES,
    // client/src/pages/About.tsx, Services.tsx, MaintenanceSubscription.tsx all say "over 20 years"
    // of combined/team HVAC experience — this is team experience, not a company founding date.
    yearsInBusiness: 20,
    founded: null,
    // Owner-supplied only — see the field comments. Both stay null until the owner provides them.
    license: null,
    hours: null,
  },
  // Owner-attested as factual on 2026-09-26, standardized site-wide by commit
  // 1b8bf71 ("Standardize rebate claims: $16K residential, 80% commercial,
  // remove expired federal credit") and consistently stated across
  // AIAssistantPrompts.tsx, CityPage.tsx, and the blog. Deliberately excludes:
  // the federal 25C credit and HEAR/HOMES rebates (both named in 1b8bf71 as
  // expired/unverified — the whole point of that commit), the $18,000
  // income-qualified/LMI tier (not requested here — only the standard $16K
  // tier), and every illustrative worked-example figure ($23,500/$29,800/
  // case-study numbers in blogPosts.ts) — those are hypotheticals, not facts.
  incentives: [
    {
      program: "PSE&G / NJ Clean Energy residential HVAC rebate",
      amountText: "Up to $16,000",
      verifiedOn: "2026-09-26",
      source: "owner-attested; site copy",
    },
    {
      program: "PSE&G Direct Install (commercial)",
      amountText: "Up to 80% of project cost covered",
      verifiedOn: "2026-09-26",
      source: "owner-attested; site copy",
    },
    {
      program: "PSE&G On-Bill Repayment (OBR)",
      amountText: "0% interest financing for the remaining balance after rebates, repaid through the monthly utility bill",
      verifiedOn: "2026-09-26",
      source: "owner-attested; site copy",
    },
  ],
  // client/src/App.tsx's ServicePage routes — the live, individually-indexed
  // service pages (/heat-pump-installation-nj, etc.). "Heat Pump Rebates NJ"
  // and "HVAC Financing" use the same page template but describe incentives,
  // not a service performed, so they're excluded here.
  services: ["Heat Pump", "Central AC", "Ductless Mini-Split", "Full HVAC System Replacement", "Commercial HVAC", "VRV/VRF System"],
  certifications: [],
  projects: [],
  // docs/positioning-warranty-spec.md §1 — owner-attested 2026-09-26.
  warranty: {
    headline: "10-Year Parts & Labor Coverage",
    years: 10,
    covers: "parts and labor",
    deductible: 0,
    included: false,
    availableFor: ["new HVAC installations by Mechanical Enterprise", "existing systems that pass an eligibility inspection"],
    brands: "all major brands",
    administration: "third-party extended service agreement, backed by A-rated insurers",
    eligibilityNote: "existing equipment subject to inspection and program criteria",
    termsUrl: "/warranty",
    verifiedOn: "2026-09-26",
    source: "owner-attested; provider contractor program",
  },
  // docs/positioning-warranty-spec.md §9a — priceText/verifiedOn stay null until the owner sets a real price.
  membership: {
    name: "Comfort Membership",
    includes: ["parts & labor coverage for the chosen term (3/5/10 years)", "two maintenance visits per year", "priority scheduling", "replacement credit toward your next system"],
    billing: "monthly",
    priceText: null,
    verifiedOn: null,
  },
  // docs/positioning-warranty-spec.md §9b — owner supplies each entry; empty until then.
  priceRanges: [],
  // docs/positioning-warranty-spec.md §9c — both null until the owner sets them.
  replacementCredit: {
    percentOfPremiums: null,
    cap: null,
    conditions: ["coverage and membership payments count toward your next system with Mechanical Enterprise"],
  },
  // docs/positioning-warranty-spec.md §9d — responseHours null until the owner sets it.
  portfolioSla: {
    responseHours: null,
    reportingCadence: "quarterly",
    unitTypes: ["PTAC", "mini-split", "RTU", "split"],
    pricingBasis: "per unit per year, quoted by portfolio",
  },
  // docs/positioning-warranty-spec.md §9e — is24x7 stays false until the owner confirms it.
  monitoring: {
    thermostatBrands: [],
    included: "membership",
    optIn: true,
    is24x7: false,
  },
  // Owner has NOT confirmed 24/7 emergency or same-day service — every such claim BLOCKs until they do.
  serviceHours: {
    emergency24x7: false,
    sameDay: false,
  },
};

// Phone constant re-exported for callers that need the raw E.164 form alongside the display form.
export { PHONE_E164 };

/**
 * Gate for BOTH autopublish lanes (mirrors isGithubConfigured() in
 * server/services/seo/github.ts). False until the owner has verified at
 * least one incentive figure — an empty `incentives` array means there is
 * nothing safe for the model to say about pricing/savings, which is most of
 * what B2B and title/meta copy would otherwise want to lead with.
 */
export function isFactsConfigured(facts: VerifiedFacts = VERIFIED_FACTS): boolean {
  return facts.incentives.some((i) => !!i.verifiedOn?.trim());
}

const PRICE_RANGE_STALE_DAYS = 180;

/** docs/positioning-warranty-spec.md §9b — "asOf older than 180 days -> WARN". Pure; caller supplies `now` for testability. */
export function isPriceRangeStale(range: VerifiedPriceRange, now: Date = new Date()): boolean {
  const asOf = new Date(range.asOf);
  if (Number.isNaN(asOf.getTime())) return true;
  const ageDays = (now.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > PRICE_RANGE_STALE_DAYS;
}
