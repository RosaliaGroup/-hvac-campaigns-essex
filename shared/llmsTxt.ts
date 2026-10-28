/**
 * /llms.txt — the plain-text index AI search/answer engines read (llmstxt.org format:
 * H1 name, blockquote summary, then sections of links). Generated from VERIFIED_FACTS
 * (scripts/generate-llms-txt.ts writes client/public/llms.txt; a test fails if the
 * committed file drifts) so it can never state anything the fact firewall doesn't hold.
 * Lines for facts that are still null (address, license, hours) are omitted, not guessed.
 */
import type { VerifiedFacts } from "./verifiedFacts";

export const LLMS_BASE = "https://mechanicalenterprise.com";

/** The five install pages (docs/positioning-warranty-spec.md §4). */
export const INSTALL_PAGES: ReadonlyArray<{ path: string; label: string }> = [
  { path: "/residential", label: "Residential HVAC installation" },
  { path: "/heat-pump-installation-nj", label: "Heat pump installation" },
  { path: "/central-ac-installation-nj", label: "Central AC installation" },
  { path: "/ductless-mini-split-installation-nj", label: "Ductless mini-split installation" },
  { path: "/vrv-vrf-installation-nj", label: "VRV/VRF system installation" },
];

/**
 * Commercial / property-management service pages. Listed so AI answer engines
 * (ChatGPT, Perplexity, Google AI Overviews) can cite the right page when someone
 * asks for commercial HVAC repair, RTU service or maintenance contracts in NJ.
 * Page descriptions only; no figures or credentials (fact firewall).
 */
export const COMMERCIAL_SERVICE_PAGES: ReadonlyArray<{ path: string; label: string; note: string }> = [
  { path: "/commercial/for-property-management", label: "HVAC for NJ property managers", note: "repairs, maintenance and replacement planning for managed buildings" },
  { path: "/commercial-hvac-service-nj", label: "Commercial HVAC service and repair", note: "service calls for commercial and multifamily buildings" },
  { path: "/commercial-rtu-service-nj", label: "Rooftop unit (RTU) service and repair", note: "commercial rooftop equipment" },
  { path: "/commercial-hvac-maintenance-nj", label: "Commercial HVAC maintenance agreements", note: "preventive maintenance plans" },
  { path: "/commercial/hvac-service-contracts", label: "Portfolio HVAC service contracts", note: "multi-property service agreements" },
  { path: "/emergency-hvac-repair-nj", label: "Emergency HVAC repair", note: "no heat / no cooling calls" },
];

/** Planning guides written for property managers and building owners. */
export const PROPERTY_MANAGER_GUIDES: ReadonlyArray<{ path: string; label: string }> = [
  { path: "/blog/nj-multifamily-no-heat-hvac-service-checklist", label: "No heat in a NJ multifamily building: service checklist" },
  { path: "/blog/commercial-rooftop-hvac-repair-request-nj", label: "Commercial rooftop HVAC repair: what to include in a service request" },
  { path: "/blog/commercial-hvac-response-sla-checklist", label: "What a commercial HVAC response SLA should include" },
  { path: "/blog/fall-hvac-maintenance-nj-property-managers", label: "Fall HVAC maintenance checklist for NJ property managers" },
  { path: "/blog/rooftop-hvac-replacement-quote-checklist-nj", label: "Rooftop HVAC replacement quotes: owner checklist" },
  { path: "/blog/nj-cooling-tower-shutdown-planning", label: "NJ cooling tower shutdown planning" },
];

export function buildLlmsTxt(facts: VerifiedFacts, base: string = LLMS_BASE): string {
  const b = facts.business;
  const w = facts.warranty;
  const counties = b.serviceCounties.map((c) => `${c} County`).join(", ");
  const lines: string[] = [];
  lines.push(`# ${b.legalName}`, "");
  lines.push(
    `> ${b.legalName} installs and services residential and commercial HVAC systems in New Jersey (${counties}). ` +
      `Commercial work includes HVAC repair, rooftop unit service, maintenance agreements and replacement planning for property managers, building owners and multifamily operators. ` +
      `Optional ${w.years}-year ${w.covers} coverage is available. Phone: ${b.phone}.`,
    "",
  );
  lines.push("## Company facts", "");
  lines.push(`- [Company facts and contact details](${base}/company): legal name, phone, counties served, services, coverage`);
  lines.push(`- [${w.headline}](${base}${w.termsUrl}): optional coverage, what it covers and how it works`);
  lines.push(`- [Commercial HVAC](${base}/commercial): commercial installation and service`);
  lines.push("", "## Commercial and property-management services", "");
  for (const p of COMMERCIAL_SERVICE_PAGES) lines.push(`- [${p.label}](${base}${p.path}): ${p.note}`);
  lines.push("", "## Installation pages", "");
  for (const p of INSTALL_PAGES) lines.push(`- [${p.label}](${base}${p.path})`);
  lines.push("", "## Guides for property managers", "");
  for (const g of PROPERTY_MANAGER_GUIDES) lines.push(`- [${g.label}](${base}${g.path})`);
  lines.push("", "## Contact", "");
  lines.push(`- Phone: ${b.phone}`);
  if (b.address) lines.push(`- Address: ${b.address}`);
  if (b.hours) lines.push(`- Hours: ${b.hours.text}`);
  if (b.license) lines.push(`- License: ${b.license.text}`);
  lines.push("");
  return lines.join("\n");
}
