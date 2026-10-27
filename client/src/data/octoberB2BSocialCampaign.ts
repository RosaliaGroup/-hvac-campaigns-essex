/** Approved-for-review organic content from docs/marketing/october-2026-b2b-distribution-calendar.md.
 * These are draft templates, NOT published or scheduled records.
 */
export const OCTOBER_B2B_SOCIAL_POSTS = [
  { key: "pm_fall", label: "Property managers — fall HVAC", text: "Is your NJ building portfolio ready for heating season? Start with an equipment inventory, recurring service issues and a clear priority list for repairs. Mechanical Enterprise works with property managers on commercial HVAC maintenance and replacement planning. Request a portfolio review:", url: "/commercial/for-property-management" },
  { key: "condo_ptac", label: "Condo boards — PTAC planning", text: "Replacing aging PTACs across a condo building? Confirm sleeve fit, electrical requirements and resident scheduling before choosing equipment. Our planning guide explains how to phase work in occupied properties:", url: "/blog/nj-condo-ptac-replacement-planning" },
  { key: "gc_bid", label: "General contractors — HVAC bids", text: "NJ GCs and developers: Have an upcoming HVAC installation, RTU replacement or multifamily mechanical scope? Mechanical Enterprise can review drawings, schedule and project requirements before bidding. Share your project:", url: "/commercial/for-contractors-developers" },
  { key: "facility_review", label: "Facility managers — condition reviews", text: "Repeated rooftop-unit or heat-pump breakdowns? A documented condition review can help separate urgent repairs from capital replacements. Start with equipment age, service history and operational risk:", url: "/commercial/for-commercial-partners" },
  { key: "fall_checklist", label: "Multifamily owners — maintenance", text: "Winter HVAC preparation is easier when every building has a clear equipment list, preventive maintenance schedule and repair priorities. Read our NJ property manager checklist:", url: "/blog/fall-hvac-maintenance-nj-property-managers" },
  { key: "broker_diligence", label: "Commercial brokers — due diligence", text: "Before acquiring or leasing a commercial property, review mechanical equipment age, service history and near-term capital needs. Here's our HVAC due diligence checklist:", url: "/blog/commercial-property-hvac-due-diligence-nj" },
  { key: "hoa_budget", label: "Condo boards — capital budgets", text: "Planning an HVAC capital budget? Compare repeated repairs, compatibility requirements, resident disruption and replacement phasing—not just unit purchase prices. Discuss your NJ property:", url: "/commercial/for-property-management" },
  { key: "partner_intro", label: "Commercial partners — introductions", text: "Commercial brokers, property managers and facility teams: Need an HVAC resource for building assessments, maintenance planning or equipment replacement? Tell us about your NJ property or client:", url: "/commercial/for-commercial-partners" },
] as const;

export function buildOctoberSocialContent(post: typeof OCTOBER_B2B_SOCIAL_POSTS[number], platform: "facebook" | "instagram") {
  const url = new URL(post.url, "https://mechanicalenterprise.com");
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "me_b2b_oct2026");
  url.searchParams.set("utm_content", post.key);
  return `${post.text}\n${url.toString()}`;
}
