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

export function buildLlmsTxt(facts: VerifiedFacts, base: string = LLMS_BASE): string {
  const b = facts.business;
  const w = facts.warranty;
  const counties = b.serviceCounties.map((c) => `${c} County`).join(", ");
  const lines: string[] = [];
  lines.push(`# ${b.legalName}`, "");
  lines.push(
    `> ${b.legalName} installs and services residential and commercial HVAC systems in New Jersey (${counties}). ` +
      `Optional ${w.years}-year ${w.covers} coverage is available. Phone: ${b.phone}.`,
    "",
  );
  lines.push("## Company facts", "");
  lines.push(`- [Company facts and contact details](${base}/company): legal name, phone, counties served, services, coverage`);
  lines.push(`- [${w.headline}](${base}${w.termsUrl}): optional coverage, what it covers and how it works`);
  lines.push(`- [Commercial HVAC](${base}/commercial): commercial installation and service`);
  lines.push("", "## Installation pages", "");
  for (const p of INSTALL_PAGES) lines.push(`- [${p.label}](${base}${p.path})`);
  lines.push("", "## Contact", "");
  lines.push(`- Phone: ${b.phone}`);
  if (b.address) lines.push(`- Address: ${b.address}`);
  if (b.hours) lines.push(`- Hours: ${b.hours.text}`);
  if (b.license) lines.push(`- License: ${b.license.text}`);
  lines.push("");
  return lines.join("\n");
}
