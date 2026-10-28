/** November 2026 B2B organic posts: heating-season service, maintenance agreements and
 * property-manager consultations. Draft templates for review in the scheduler, NOT
 * published or scheduled records. Every link is a live commercial page or guide; no
 * rebate, incentive or financing content (owner direction, Oct 28 2026).
 */
export const NOVEMBER_B2B_SOCIAL_POSTS = [
  { key: "nov_noheat", label: "Multifamily — no-heat checklist", text: "No heat in a NJ multifamily building is urgent for residents and for you. Our checklist covers what to document before the technician arrives so the first visit fixes more:", url: "/blog/nj-multifamily-no-heat-hvac-service-checklist" },
  { key: "nov_heating_service", label: "Buildings — heating plant service", text: "Heating season is here. If your building's boilers or heating plant haven't had their fall service yet, book it now, before the first cold snap turns a tune-up into an emergency call. Request service for your NJ property:", url: "/commercial-hvac-service-nj" },
  { key: "nov_rtu", label: "Retail & office — RTU service", text: "Rooftop units that heat retail and office space work hardest in December. Book an RTU service visit to check heat exchangers, ignition, belts and controls before peak season:", url: "/commercial-rtu-service-nj" },
  { key: "nov_pm_agreement", label: "Property managers — maintenance plans", text: "Property managers: a preventive maintenance agreement turns surprise breakdowns into scheduled visits, with a written equipment record for every building. Ask about a maintenance plan for your NJ portfolio:", url: "/commercial-hvac-maintenance-nj" },
  { key: "nov_sla", label: "Facility teams — response agreements", text: "What should a commercial HVAC response agreement spell out? Response windows, after-hours contacts, who calls whom, and how repairs get approved. Our checklist:", url: "/blog/commercial-hvac-response-sla-checklist" },
  { key: "nov_repair_request", label: "Facility teams — RTU repair requests", text: "Faster rooftop HVAC repairs start with a better service request: unit location, model and serial, symptoms, access details and a roof contact. Here's what to include:", url: "/blog/commercial-rooftop-hvac-repair-request-nj" },
  { key: "nov_portfolio", label: "Portfolios — service contracts", text: "Managing several buildings? One service contract across your portfolio means one contact, consistent maintenance records and planned replacements instead of emergency ones. Ask about portfolio service contracts:", url: "/commercial/hvac-service-contracts" },
  { key: "nov_replace_quotes", label: "Owners — RTU replacement quotes", text: "Getting quotes to replace rooftop HVAC equipment? Compare scope, crane and roof access, permits, startup and removal of old units, not just the equipment price. Owner checklist:", url: "/blog/rooftop-hvac-replacement-quote-checklist-nj" },
  { key: "nov_emergency", label: "All buildings — emergency repair", text: "When heat or cooling fails in an occupied building, call (862) 423-9396. Mechanical Enterprise handles emergency HVAC repair for NJ commercial and multifamily properties:", url: "/emergency-hvac-repair-nj" },
  { key: "nov_closed_loop", label: "Building engineers — pump rotation", text: "Building engineers: rotating lead and lag pumps on closed-loop heating systems spreads wear and catches problems early. Our rotation checklist for NJ buildings:", url: "/blog/closed-loop-pump-rotation-checklist-nj" },
  { key: "nov_capital_plan", label: "Owners — 2027 capital planning", text: "Planning your 2027 capital budget? Bring us your equipment list. We'll help separate repairs that can wait from replacements that shouldn't, so the plan is based on condition, not guesswork:", url: "/commercial/for-property-management" },
  { key: "nov_consult", label: "Property managers — walkthrough", text: "NJ property managers in Essex, Hudson and Bergen counties: tell us about your buildings and current HVAC problems, and we'll set up a walkthrough. Request a consultation:", url: "/commercial/for-property-management" },
] as const;

export type NovemberPost = typeof NOVEMBER_B2B_SOCIAL_POSTS[number];

export function buildNovemberSocialContent(post: NovemberPost, platform: "facebook" | "instagram") {
  const url = new URL(post.url, "https://mechanicalenterprise.com");
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "me_b2b_nov2026");
  url.searchParams.set("utm_content", post.key);
  return `${post.text}\n${url.toString()}`;
}

/** Three posts a week (Mon / Wed / Fri pattern from the chosen start): day offsets for post i. */
export function novemberDayOffset(i: number): number {
  return Math.floor(i / 3) * 7 + [0, 2, 4][i % 3];
}
