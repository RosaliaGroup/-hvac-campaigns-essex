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
import { SERVICE_TYPES } from "./appointmentTypes";

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
  };
  /** Owner-maintained. Empty until the owner verifies at least one current incentive figure. */
  incentives: VerifiedIncentive[];
  /** What the business actually sells, from shared/appointmentTypes.ts's SERVICE_TYPES (the booking form's own service list) — excludes the "General"/"Other" catch-alls. */
  services: string[];
  /** Empty until certification documentation is provided (spec: "all certification wording BLOCKS" until then). */
  certifications: VerifiedCertification[];
  /** Empty until verified, consented project descriptions exist. */
  projects: VerifiedProject[];
};

export const VERIFIED_FACTS: VerifiedFacts = {
  business: {
    // client/src/components/DashboardFooter.tsx, client/src/pages/BlogPost.tsx JSON-LD, AIAssistantPrompts.tsx
    legalName: "Mechanical Enterprise LLC",
    // shared/business.ts — the single canonical number (two were in use; this is the correct, live one).
    phone: PHONE_DISPLAY,
    address: null,
    serviceCounties: CITY_REGISTRY_COUNTIES,
    // client/src/pages/About.tsx, Services.tsx, MaintenanceSubscription.tsx all say "over 20 years"
    // of combined/team HVAC experience — this is team experience, not a company founding date.
    yearsInBusiness: 20,
    founded: null,
  },
  incentives: [],
  services: SERVICE_TYPES.map((t) => t.label).filter((label) => label !== "General" && label !== "Other"),
  certifications: [],
  projects: [],
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
