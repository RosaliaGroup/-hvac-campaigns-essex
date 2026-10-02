/**
 * The /company entity page, as data. Everything here comes from VERIFIED_FACTS — no prose of
 * its own beyond labels — so the page states plainly what the firewall holds and nothing else.
 * A fact that is still null (street address, license, hours) yields NO row and NO JSON-LD field.
 */
import type { VerifiedFacts } from "./verifiedFacts";

export const COMPANY_BASE = "https://mechanicalenterprise.com";

export type EntityRow = { label: string; value: string; href?: string };

export function buildEntityRows(facts: VerifiedFacts): EntityRow[] {
  const b = facts.business;
  const w = facts.warranty;
  const rows: EntityRow[] = [];
  rows.push({ label: "Legal name", value: b.legalName });
  if (b.license) rows.push({ label: "License", value: b.license.text });
  if (b.address) rows.push({ label: "Address", value: b.address });
  rows.push({ label: "Phone", value: b.phone, href: `tel:+1${b.phone.replace(/\D/g, "").slice(-10)}` });
  if (b.hours) rows.push({ label: "Hours", value: b.hours.text });
  rows.push({ label: "Counties served", value: b.serviceCounties.map((c) => `${c} County`).join(", ") + ", New Jersey" });
  rows.push({ label: "Services", value: facts.services.join(", ") });
  rows.push({
    label: "Coverage",
    value: `Optional ${w.years}-year ${w.covers} coverage (not included by default; ${w.availableFor.join(" or ")}).`,
    href: w.termsUrl,
  });
  rows.push({ label: "Team experience", value: `Over ${b.yearsInBusiness} years of combined team HVAC experience` });
  return rows;
}

/** schema.org HVACBusiness JSON-LD. Only verified fields; null facts are omitted, never guessed. */
export function buildEntityJsonLd(facts: VerifiedFacts, base: string = COMPANY_BASE): Record<string, unknown> {
  const b = facts.business;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HVACBusiness",
    "@id": `${base}/company#business`,
    name: b.legalName,
    legalName: b.legalName,
    url: base,
    telephone: `+1${b.phone.replace(/\D/g, "").slice(-10)}`,
    areaServed: b.serviceCounties.map((c) => ({ "@type": "AdministrativeArea", name: `${c} County, New Jersey` })),
    makesOffer: facts.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
  };
  if (b.address) ld.address = { "@type": "PostalAddress", streetAddress: b.address };
  if (b.hours) ld.openingHours = b.hours.text;
  if (b.license) ld.hasCredential = { "@type": "EducationalOccupationalCredential", name: b.license.text };
  return ld;
}
