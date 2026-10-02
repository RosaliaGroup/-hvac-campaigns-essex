/**
 * Offline generator for the conversational FAQ blocks (shared/aiFaq.ts). Pure + injectable: the model call
 * and the Search Console rows are passed in, so it is unit-testable and the CLI
 * (scripts/generate-ai-faqs.ts) is only wiring. Every candidate answer goes through validateFaqSet
 * (claims linter + facts-only numbers); a page that cannot produce 3 clean Q&As in MAX_ATTEMPTS ships none.
 */
import { validateFaqSet, validateFaqItem, MIN_FAQ_ITEMS, MAX_FAQ_ITEMS, type AiFaqFile, type AiFaqPage, type FaqItem } from "../../../shared/aiFaq";
import type { VerifiedFacts } from "../../../shared/verifiedFacts";
import { ALL_CITIES, NJ_COUNTIES } from "../../../client/src/data/njCounties";

/** Places an answer may name: registry cities, our counties, and the page's own city. */
export function allowedPlacesFor(facts: VerifiedFacts, target?: FaqTarget): Set<string> {
  const s = new Set<string>(["new jersey", "nj"]);
  for (const c of ALL_CITIES) s.add(c.city.toLowerCase());
  for (const c of Object.keys(NJ_COUNTIES)) { s.add(c.toLowerCase()); s.add(`${c.toLowerCase()} county`); }
  for (const c of facts.business.serviceCounties) s.add(c.toLowerCase());
  if (target?.city) s.add(target.city.toLowerCase());
  return s;
}

export type FaqTarget = { path: string; kind: AiFaqPage["kind"]; name: string; county?: string | null; city?: string };
export type GscQueryRow = { page: string; query: string; impressions: number; clicks: number };

export const MAX_ATTEMPTS = 3;

/** True for queries phrased like something a person asks an assistant. */
export function isConversationalQuery(q: string): boolean {
  return /^(who|which|what|where|when|why|how|can|could|do|does|is|are|will|should)\b/i.test(q.trim()) || /\b(near me|today|cost|how much|best way)\b/i.test(q);
}

/** Real queries to seed a page: its own GSC queries first, then site-wide question-shaped ones that share a topic word. */
export function pickSeedQueries(rows: GscQueryRow[], target: FaqTarget, limit = 8): string[] {
  const own = rows.filter((r) => r.page === target.path).sort((a, b) => b.impressions - a.impressions);
  const topicWords = `${target.name} ${target.city ?? ""} ${target.county ?? ""}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !["install", "installation", "heating", "cooling"].includes(w));
  const related = rows
    .filter((r) => r.page !== target.path && isConversationalQuery(r.query) && topicWords.some((w) => r.query.toLowerCase().includes(w)))
    .sort((a, b) => b.impressions - a.impressions);
  const out: string[] = [];
  for (const r of [...own.filter((x) => isConversationalQuery(x.query)), ...own, ...related]) {
    const q = r.query.trim();
    if (q && !out.some((o) => o.toLowerCase() === q.toLowerCase())) out.push(q);
    if (out.length >= limit) break;
  }
  return out;
}

export function factsForPrompt(facts: VerifiedFacts): Record<string, unknown> {
  return {
    company: facts.business.legalName,
    phone: facts.business.phone,
    countiesServed: facts.business.serviceCounties.map((c) => `${c} County, New Jersey`),
    teamExperienceYears: facts.business.yearsInBusiness,
    services: facts.services,
    optionalCoverage: {
      headline: facts.warranty.headline,
      years: facts.warranty.years,
      covers: facts.warranty.covers,
      includedByDefault: facts.warranty.included,
      availableFor: facts.warranty.availableFor,
      eligibility: facts.warranty.eligibilityNote,
    },
    incentives: facts.incentives.map((i) => ({ program: i.program, amount: i.amountText })),
  };
}

export function buildFaqSystemPrompt(target: FaqTarget, facts: VerifiedFacts, queries: string[], priorIssues: string[]): string {
  return [
    "You write short FAQ entries for one web page of an HVAC contractor, for AI answer engines and search.",
    `PAGE: ${target.name} (${target.path}); page type: ${target.kind}${target.city ? `; city: ${target.city}` : ""}${target.county ? `; county: ${target.county} County` : ""}.`,
    "",
    "FACTS (the ONLY source of truth — nothing else may be stated):",
    JSON.stringify(factsForPrompt(facts), null, 2),
    "",
    queries.length
      ? "REAL SEARCH QUERIES for this page — phrase the questions the way these are asked, conversationally:\n" + queries.map((q) => `- ${q}`).join("\n")
      : "No search queries exist for this page yet. Write the questions a homeowner or building manager would ask an assistant about this page's topic.",
    "",
    `Write ${MIN_FAQ_ITEMS} to ${MAX_FAQ_ITEMS} Q&As. Rules:`,
    "- Question: how a person would ask a voice assistant, ending in '?'. Answer: 1-2 plain sentences, under 300 characters, the first words answer the question directly.",
    "- State only what the FACTS support. If the facts do not answer the question, answer by pointing to the phone number or the company's counties/services — never guess.",
    "- NO prices, durations, response times, 'same day', '24/7', 'emergency', licensing, certifications, ratings, reviews, years in business as a founding date, customer names, project counts, brand names, or comparisons to other companies.",
    "- NO superlatives or guarantees (best, top, #1, guaranteed, cheapest, lowest price). Coverage is OPTIONAL and not included by default; say so whenever coverage is mentioned.",
    "- Dollar figures and numbers may ONLY be ones that appear in the FACTS, worded the same way.",
    "- Describe incentive programs ONLY as programs (what they are); never say the company provides access to, connects customers to, handles, administers, is approved/authorized/licensed/insured for, or partners with any program or agency.",
    "- Never write \"N years of experience\". If experience is mentioned it must read \"over 20 years of combined team experience\".",
    "- Only name cities/counties that appear in the FACTS or are this page's own city. If a search query names any other place, skip that query — do not answer about it.",
    "- No URLs, no markdown. Do not repeat a question.",
    priorIssues.length ? "\nYour previous attempt was rejected for these reasons — fix them:\n" + priorIssues.map((i) => `- ${i}`).join("\n") : "",
    "",
    'Respond with ONLY JSON: {"items":[{"q":"...","a":"..."}]}',
  ].join("\n");
}

export function parseFaqResponse(text: string): FaqItem[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON object in model response");
  const parsed = JSON.parse(m[0]) as { items?: unknown };
  if (!Array.isArray(parsed.items)) throw new Error('response has no "items" array');
  return parsed.items.map((i) => {
    const o = i as { q?: unknown; a?: unknown };
    if (typeof o.q !== "string" || typeof o.a !== "string") throw new Error("item missing q/a strings");
    return { q: o.q.trim(), a: o.a.trim() };
  });
}

export type CallModel = (system: string) => Promise<string>;

export type PageResult = { target: FaqTarget; page: AiFaqPage | null; attempts: number; issues: string[] };

export async function generateForTarget(target: FaqTarget, facts: VerifiedFacts, queries: string[], callModel: CallModel): Promise<PageResult> {
  let priorIssues: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let items: FaqItem[];
    try {
      items = parseFaqResponse(await callModel(buildFaqSystemPrompt(target, facts, queries, priorIssues)));
    } catch (err) {
      priorIssues = [`unparseable response: ${(err as Error).message}`];
      continue;
    }
    // Keep the clean items and see whether enough survive; only the failures are reported back to the model.
    const places = allowedPlacesFor(facts, target);
    const issues = validateFaqSet(items, facts, places);
    if (issues.length === 0) return { target, page: { kind: target.kind, items, queries }, attempts: attempt, issues: [] };
    const seen = new Set<string>();
    const clean = items.filter((it) => {
      const k = it.q.toLowerCase();
      if (seen.has(k) || validateFaqItem(it, facts, places).length > 0) return false;
      seen.add(k);
      return true;
    });
    if (clean.length >= MIN_FAQ_ITEMS) {
      return { target, page: { kind: target.kind, items: clean.slice(0, MAX_FAQ_ITEMS), queries }, attempts: attempt, issues: [] };
    }
    priorIssues = issues.map((i) => `${i.code}: ${i.message}`).slice(0, 8);
  }
  return { target, page: null, attempts: MAX_ATTEMPTS, issues: priorIssues };
}

export async function generateAll(targets: FaqTarget[], facts: VerifiedFacts, rows: GscQueryRow[], callModel: CallModel, now: Date = new Date()): Promise<{ file: AiFaqFile; results: PageResult[] }> {
  const pages: Record<string, AiFaqPage> = {};
  const results: PageResult[] = [];
  for (const t of targets) {
    const r = await generateForTarget(t, facts, pickSeedQueries(rows, t), callModel);
    results.push(r);
    if (r.page) pages[t.path] = r.page;
  }
  return { file: { generatedAt: now.toISOString(), pages }, results };
}
