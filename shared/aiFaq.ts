/**
 * Conversational FAQ + speakable schema for the service, install and city pages.
 *
 * The Q&As themselves are generated offline (scripts/generate-ai-faqs.ts) from real Search Console
 * queries through the content provider, then gated here: every answer must pass the claims linter
 * (lintClaims) against VERIFIED_FACTS, stay short, and contain no number the facts don't hold. The
 * committed output is client/src/data/aiFaqs.json; nothing is generated at request time.
 */
import { lintClaims } from "./contentLinter";
import type { VerifiedFacts } from "./verifiedFacts";

export type FaqItem = { q: string; a: string };
export type AiFaqPage = { kind: "service" | "install" | "city"; items: FaqItem[]; queries: string[] };
export type AiFaqFile = { generatedAt: string | null; pages: Record<string, AiFaqPage> };

export const MIN_FAQ_ITEMS = 3;
export const MAX_FAQ_ITEMS = 5;
export const MAX_ANSWER_CHARS = 360;

/** Numbers an answer may contain: derived from the facts, never free-form. */
export function allowedNumbers(facts: VerifiedFacts): Set<string> {
  const out = new Set<string>();
  const add = (text: string) => { for (const m of text.match(/\d[\d,]*/g) ?? []) out.add(m.replace(/,/g, "")); };
  add(facts.business.phone);
  add(String(facts.business.yearsInBusiness));
  add(String(facts.warranty.years));
  for (const i of facts.incentives) add(i.amountText);
  return out;
}

export type FaqIssue = { code: string; message: string };

/**
 * Wording that claims more than VERIFIED_FACTS holds: access/approval/partnership/guarantee language about incentives,
 * credentials, and "handles everything" promises. Deterministic backstop to the claims linter.
 */
export const FAQ_OVERREACH_RE = /\b(provides? access|can connect|connects?|handles? (?:all|the|every)|guarantee[sd]?|approved|authori[sz]ed|partner(?:s|ed)?|licensed|insured|bonded|accredited)\b/i;

/** "N years of experience" is only true as "over 20 years of COMBINED TEAM experience" (verifiedFacts: not a founding date). */
export function misstatesExperience(text: string): boolean {
  return /\b\d+\s*(?:\+\s*)?years?\b/i.test(text) && /experience/i.test(text) && !(/combined/i.test(text) && /team/i.test(text));
}

/**
 * Place names an answer may mention: our service counties, the registry cities (client/src/data/njCounties) and the page's own city.
 * A "Monroe, NJ" / "Clementon, NJ" that is not ours would be a geography claim the facts cannot back.
 */
export function unknownPlaces(text: string, allowedPlaces: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const m of Array.from(text.matchAll(/\b(?:in|to|for|around|near)\s+((?:[A-Z][a-z]+\.?)(?:\s[A-Z][a-z]+\.?){0,2}),?\s+(?:NJ|New Jersey)\b/g))) {
    const place = m[1].trim();
    if (!allowedPlaces.has(place.toLowerCase()) && !out.includes(place)) out.push(place);
  }
  return out;
}

/** Pure gate for one Q&A. Returns [] when it may ship. */
export function validateFaqItem(item: FaqItem, facts: VerifiedFacts, allowedPlaces?: ReadonlySet<string>): FaqIssue[] {
  const issues: FaqIssue[] = [];
  const q = item.q.trim();
  const a = item.a.trim();
  if (!q.endsWith("?")) issues.push({ code: "question_mark", message: "Question must end with a question mark." });
  if (q.length < 12 || q.length > 140) issues.push({ code: "question_length", message: "Question must be 12-140 characters." });
  if (a.length < 40) issues.push({ code: "answer_short", message: "Answer is too short to be useful." });
  if (a.length > MAX_ANSWER_CHARS) issues.push({ code: "answer_long", message: `Answer exceeds ${MAX_ANSWER_CHARS} characters.` });
  if (/https?:\/\/|www\./i.test(a)) issues.push({ code: "url_in_answer", message: "No URLs in answers." });
  if (FAQ_OVERREACH_RE.test(`${q} ${a}`)) issues.push({ code: "overreach", message: "Wording claims more than the verified facts (access/approval/partner/guarantee/license language)." });
  if (misstatesExperience(`${q} ${a}`)) issues.push({ code: "experience_misstated", message: 'Years of experience must read "over 20 years of combined team experience".' });
  if (allowedPlaces) {
    for (const p of unknownPlaces(`${q} ${a}`, allowedPlaces)) issues.push({ code: "unknown_place", message: `Place "${p}" is not one of our served cities/counties.` });
  }
  const allowed = allowedNumbers(facts);
  for (const m of (q + " " + a).match(/\d[\d,]*/g) ?? []) {
    const n = m.replace(/,/g, "");
    if (!allowed.has(n)) issues.push({ code: "unverified_number", message: `Number "${m}" is not in VERIFIED_FACTS.` });
  }
  for (const f of lintClaims(`${q} ${a}`, facts)) {
    if (f.severity === "block") issues.push({ code: f.code, message: f.message });
  }
  return issues;
}

export function validateFaqSet(items: FaqItem[], facts: VerifiedFacts, allowedPlaces?: ReadonlySet<string>): FaqIssue[] {
  const issues: FaqIssue[] = [];
  if (items.length < MIN_FAQ_ITEMS || items.length > MAX_FAQ_ITEMS) {
    issues.push({ code: "item_count", message: `Need ${MIN_FAQ_ITEMS}-${MAX_FAQ_ITEMS} Q&As, got ${items.length}.` });
  }
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.q.trim().toLowerCase();
    if (seen.has(key)) issues.push({ code: "duplicate_question", message: `Duplicate question: ${it.q}` });
    seen.add(key);
    issues.push(...validateFaqItem(it, facts, allowedPlaces).map((i) => ({ ...i, message: `${i.message} [${it.q.slice(0, 50)}]` })));
  }
  return issues;
}

/** One FAQPage JSON-LD for a page (existing visible FAQs first, then the generated ones; de-duplicated by question). */
export function buildFaqPageJsonLd(items: FaqItem[]): Record<string, unknown> {
  const seen = new Set<string>();
  const unique = items.filter((i) => { const k = i.q.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: unique.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export const AI_FAQ_SPEAKABLE_SELECTORS = [".ai-faq-q", ".ai-faq-a"] as const;

/** WebPage + SpeakableSpecification pointing at the visible generated Q&A (the markup the selectors match). */
export function buildSpeakableJsonLd(url: string, name: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    name,
    speakable: { "@type": "SpeakableSpecification", cssSelector: [...AI_FAQ_SPEAKABLE_SELECTORS] },
  };
}
