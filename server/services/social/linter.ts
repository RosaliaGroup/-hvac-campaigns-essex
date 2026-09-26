/**
 * Social Lane linter + critic pass (docs/social-lane-spec.md §3), reusing the
 * SAME rule set the autopublish addendum's content lane enforces (superlatives,
 * expired credits, competitor names, provider names, off-facts prices,
 * "free"/"included" claims about coverage, non-canonical phone numbers,
 * customer full names/addresses). The SEO lane enforces these as *prompt
 * instructions* to the drafting model (server/services/seo/contentDrafting.ts)
 * rather than as a standalone callable function, so there is no shared
 * function to import — this is a pure, unit-testable reimplementation of the
 * same rule list, scoped to social copy. A post that fails ANY rule is
 * blocked from ever reaching `publishSocialPost` (see holdAndPublish.ts).
 */
import { PHONE_DISPLAY, PHONE_E164 } from "@shared/business";
import { VERIFIED_FACTS, type VerifiedFacts } from "@shared/verifiedFacts";

export interface LintResult {
  blocked: boolean;
  reasons: string[];
}

const SUPERLATIVES = ["#1", "best", "award-winning", "award winning", "top-rated", "top rated", "leading", "unmatched", "number one"];

// No real competitor names are recorded anywhere in this codebase (there is
// no verified/approved competitor list to draw from) — this starts as a
// deliberately small, owner-editable placeholder. Extend as the owner
// supplies real names; the point is the mechanism, not this seed list.
export const COMPETITOR_NAME_DENYLIST: string[] = [];

const EXPIRED_CREDIT_TERMS = ["25c", "25(c)", "ira tax credit", "inflation reduction act credit", "hear rebate", "homes rebate"];

const COVERAGE_FREE_WORDS = ["free", "included", "no cost", "at no charge"];

/** Very small heuristic: two consecutive Capitalized words that aren't a known safe phrase (e.g. "Heat Pump", "New Jersey"). Flags likely customer full names / street addresses. */
const SAFE_CAPITALIZED_PHRASES = new Set([
  "Heat Pump", "Central Air", "Mini Split", "New Jersey", "Comfort Membership",
  "Direct Install", "On-Bill", "Clean Energy", "Mechanical Enterprise",
]);

/** Every adjacent Capitalized-word bigram appearing in shared/verifiedFacts.ts's own vocabulary — service names, the warranty headline, membership name, incentive program names, the business's legal name — is safe by construction; only flag bigrams NOT drawn from that vocabulary. */
function factsVocabularyBigrams(facts: VerifiedFacts): Set<string> {
  const bigrams = new Set<string>();
  const sourceStrings = [
    facts.business.legalName,
    facts.warranty.headline,
    facts.membership.name,
    ...facts.services,
    ...facts.incentives.map((i) => i.program),
    ...facts.certifications.map((c) => c.name),
  ];
  for (const s of sourceStrings) {
    for (const m of s.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? []) bigrams.add(m);
  }
  return bigrams;
}

function findLikelyFullNameOrAddress(text: string, facts: VerifiedFacts): string | null {
  const safe = factsVocabularyBigrams(facts);
  const matches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? [];
  for (const m of matches) {
    if (!SAFE_CAPITALIZED_PHRASES.has(m) && !safe.has(m)) return m;
  }
  // Street-address-shaped: a number followed by 1-3 capitalized words.
  const addressMatch = text.match(/\b\d{1,5}\s+([A-Z][a-z]+\s?){1,3}(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Way|Ct|Court)\b/);
  if (addressMatch) return addressMatch[0];
  return null;
}

function findNonCanonicalPhone(text: string): string | null {
  const phoneRe = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const matches = text.match(phoneRe) ?? [];
  const canonicalDigits = new Set([PHONE_DISPLAY.replace(/\D/g, ""), PHONE_E164.replace(/\D/g, "")]);
  for (const m of matches) {
    const digits = m.replace(/\D/g, "").replace(/^1/, "");
    const digitsWithCountry = m.replace(/\D/g, "");
    if (!canonicalDigits.has(digits) && !canonicalDigits.has(digitsWithCountry)) return m;
  }
  return null;
}

/** All dollar amounts in the text that don't match a verified price/incentive figure. */
function findOffFactsPrices(text: string, facts: VerifiedFacts): string[] {
  const amounts = text.match(/\$[\d,]+(?:\.\d+)?/g) ?? [];
  if (amounts.length === 0) return [];
  const allowed = new Set<string>();
  for (const inc of facts.incentives) {
    for (const n of inc.amountText.match(/\$[\d,]+(?:\.\d+)?/g) ?? []) allowed.add(n);
  }
  for (const pr of facts.priceRanges) {
    allowed.add(`$${pr.low}`);
    allowed.add(`$${pr.high}`);
  }
  return amounts.filter((a) => !allowed.has(a));
}

export function lintSocialContent(content: string, facts: VerifiedFacts = VERIFIED_FACTS): LintResult {
  const reasons: string[] = [];
  const lower = content.toLowerCase();

  for (const s of SUPERLATIVES) {
    if (lower.includes(s)) reasons.push(`Contains a superlative ("${s}")`);
  }
  for (const term of EXPIRED_CREDIT_TERMS) {
    if (lower.includes(term)) reasons.push(`References an expired/unverified credit ("${term}")`);
  }
  for (const name of COMPETITOR_NAME_DENYLIST) {
    if (lower.includes(name.toLowerCase())) reasons.push(`Mentions a competitor name ("${name}")`);
  }
  const offFacts = findOffFactsPrices(content, facts);
  if (offFacts.length > 0) reasons.push(`Contains a price not in verified facts (${offFacts.join(", ")})`);

  for (const w of COVERAGE_FREE_WORDS) {
    if (lower.includes(w) && (lower.includes("coverage") || lower.includes("warranty") || lower.includes("membership"))) {
      reasons.push(`Claims "${w}" alongside coverage/warranty/membership language — not verified as included`);
    }
  }

  const badPhone = findNonCanonicalPhone(content);
  if (badPhone) reasons.push(`Contains a phone number other than the canonical number ("${badPhone}")`);

  const nameOrAddress = findLikelyFullNameOrAddress(content, facts);
  if (nameOrAddress) reasons.push(`Contains what looks like a customer full name or street address ("${nameOrAddress}")`);

  return { blocked: reasons.length > 0, reasons };
}
