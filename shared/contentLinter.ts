/**
 * Extended body-content linter for the weekly B2B content pipeline
 * (docs/seo-automation-spec.md Part 2, docs/seo-automation-addendum-autopublish.md
 * §A4). Pure, framework-free — same design as shared/seoLinter.ts, which this
 * reuses the BLOCK word-lists from ("same rules as title/meta plus...").
 *
 * Two approximations, both documented at point of use rather than silently
 * pretended-away:
 *   - Duplicate-topic "cosine similarity" (spec: vs existing post titles/H1s
 *     > 0.85 -> reject) uses plain bag-of-words term-frequency vectors, not
 *     semantic embeddings — no embeddings API/provider decision has been made.
 *     It will catch near-identical wording, not paraphrases.
 *   - Flesch Reading Ease uses a standard vowel-group syllable heuristic
 *     (no dictionary), which is the conventional approximation everywhere
 *     this formula is implemented without a syllable dictionary.
 */
import {
  SUPERLATIVES,
  EXPIRED_INCENTIVES,
  CERTIFICATION_WORDS,
  COMPETITOR_BRANDS,
  APPROVED_CERTIFICATION_PHRASES,
  includesPhrase,
} from "./seoLinter";
import { isFactsConfigured, type VerifiedFacts } from "./verifiedFacts";

export type ContentLintSeverity = "block" | "warn";
export type ContentLintFinding = { severity: ContentLintSeverity; code: string; message: string };
export type ContentLintResult = { findings: ContentLintFinding[]; passes: boolean };

export type ContentLintInput = {
  title: string;
  metaDescription: string;
  /** Rendered body as plain text (H1/H2/H3 markers stripped for word-count/claim scanning — pass structure counts separately below). */
  body: string;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  /** Number of real FAQ questions included, if any (0 = no FAQ block). */
  faqQuestionCount: number;
  /** Internal link paths this post contains (targetPath only, not full URLs). */
  internalLinkPaths: string[];
  /** This post's own title/H1, compared against existing posts for the duplicate-topic check. */
  existingTitlesAndH1s: string[];
};

const WORD_COUNT_MIN = 900;
const WORD_COUNT_MAX = 1400;
const MAX_H2 = 6;
const MIN_FAQ_QUESTIONS = 3;
const MAX_INTERNAL_LINKS = 3;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
const FLESCH_MIN = 50;
const FLESCH_MAX = 65;

/**
 * e.g. "our client John Smith" / "customer Jane Doe" — a documented heuristic,
 * not real NER. Deliberately does NOT trigger on a bare "for [Capitalized]
 * [Capitalized]" — ordinary B2B titles/headlines constantly take that shape
 * ("... for Multifamily Retrofits", "... for Property Managers") with zero
 * client-naming intent, so requiring the "client"/"customer" word keeps this
 * from false-positiving on nearly every headline. Trade-off: also won't catch
 * "we did this for John Smith" without that word — under-blocking is the
 * safer failure mode for a heuristic like this.
 */
const CLIENT_NAME_RE = /\b(?:client|customer)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/;
const PROJECT_COUNT_RE = /\bwe(?:'ve| have)\s+completed\s+\d+/i;
const DOLLAR_FIGURE_RE = /\$[0-9][\d,]*(?:\.\d+)?\s?[kK]?/g;
const B2B_PATH_PATTERNS = [/^\/commercial/];

function blockFinding(code: string, message: string): ContentLintFinding {
  return { severity: "block", code, message };
}
function warnFinding(code: string, message: string): ContentLintFinding {
  return { severity: "warn", code, message };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count -= 1; // silent e
  return Math.max(1, count);
}

function countSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : 1;
}

/** Standard Flesch Reading Ease (0-100+, higher = easier). Vowel-group syllable heuristic — see file header. */
export function fleschReadingEase(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const sentences = countSentences(text);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Cosine similarity between two texts' bag-of-words term-frequency vectors. See file header for the embeddings caveat. */
export function bagOfWordsCosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const t of tokensA) freqA.set(t, (freqA.get(t) ?? 0) + 1);
  for (const t of tokensB) freqB.set(t, (freqB.get(t) ?? 0) + 1);
  const vocab = new Set(Array.from(freqA.keys()).concat(Array.from(freqB.keys())));
  let dot = 0, magA = 0, magB = 0;
  for (const term of Array.from(vocab)) {
    const va = freqA.get(term) ?? 0;
    const vb = freqB.get(term) ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Highest cosine similarity between `candidate` and any string in `existing`. */
export function highestDuplicateSimilarity(candidate: string, existing: string[]): number {
  let max = 0;
  for (const other of existing) {
    const sim = bagOfWordsCosineSimilarity(candidate, other);
    if (sim > max) max = sim;
  }
  return max;
}

/**
 * The extended content linter. Runs the same BLOCK word-lists as
 * shared/seoLinter.ts against the body, plus the body/structure-specific
 * rules from spec Part 2 + addendum §A4. Does NOT re-check title/meta length
 * (call shared/seoLinter.ts's lintPageMeta for that — the two are meant to be
 * combined by the caller, not duplicated here).
 */
export function lintContent(input: ContentLintInput, facts: VerifiedFacts): ContentLintResult {
  const findings: ContentLintFinding[] = [];
  const body = input.body;
  const bodyLower = body.toLowerCase();

  // ── Same BLOCK rules as title/meta, applied to the body ──
  for (const phrase of SUPERLATIVES) {
    if (includesPhrase(body, phrase)) findings.push(blockFinding("superlative", `Unsupported superlative claim in body: "${phrase}".`));
  }
  for (const phrase of EXPIRED_INCENTIVES) {
    if (includesPhrase(body, phrase)) findings.push(blockFinding("expired_incentive", `Expired or unverified incentive claim in body: "${phrase}".`));
  }
  for (const word of CERTIFICATION_WORDS) {
    if (includesPhrase(body, word) && !APPROVED_CERTIFICATION_PHRASES.some((p) => includesPhrase(body, p))) {
      findings.push(blockFinding("unverified_certification", `Certification wording "${word}" in body is not in the approved-phrases list.`));
    }
  }
  for (const brand of COMPETITOR_BRANDS) {
    if (includesPhrase(body, brand, { caseSensitive: true })) findings.push(blockFinding("competitor_name", `Body mentions competitor "${brand}".`));
  }

  // ── Extended, body-specific rules (spec Part 2 / addendum §A4) ──
  if (PROJECT_COUNT_RE.test(body)) {
    findings.push(blockFinding("project_count_claim", `Body claims a specific completed-project count ("we've completed N projects").`));
  }
  if (CLIENT_NAME_RE.test(body)) {
    findings.push(blockFinding("named_client", `Body appears to name a specific client/customer — heuristic match: "${body.match(CLIENT_NAME_RE)?.[0]}".`));
  }
  const dollarMatches = body.match(DOLLAR_FIGURE_RE) ?? [];
  const verifiedAmounts = facts.incentives.map((i) => i.amountText.toLowerCase());
  for (const raw of dollarMatches) {
    const found = verifiedAmounts.some((amt) => amt.includes(raw.toLowerCase()) || raw.toLowerCase().includes(amt));
    if (!found) findings.push(blockFinding("unverified_dollar_figure", `Dollar figure "${raw}" is not present in any verified incentive.`));
  }
  if (!isFactsConfigured(facts) && dollarMatches.length > 0) {
    findings.push(blockFinding("facts_not_configured", `Body contains dollar figures but no incentive has been verified yet (VERIFIED_FACTS.incentives is empty).`));
  }

  const wordCount = countWords(bodyLower);
  if (wordCount < WORD_COUNT_MIN || wordCount > WORD_COUNT_MAX) {
    findings.push(blockFinding("word_count", `Body is ${wordCount} words (must be ${WORD_COUNT_MIN}-${WORD_COUNT_MAX}).`));
  }
  if (input.h1Count !== 1) {
    findings.push(blockFinding("h1_count", `Body has ${input.h1Count} H1(s) — exactly one is required.`));
  }
  if (input.h2Count > MAX_H2) {
    findings.push(blockFinding("h2_count", `Body has ${input.h2Count} H2s — at most ${MAX_H2} allowed.`));
  }
  if (input.h3Count > 0) {
    findings.push(blockFinding("h3_wall", `Body uses ${input.h3Count} H3 heading(s) — H2s only, no H3 walls.`));
  }
  if (input.faqQuestionCount > 0 && input.faqQuestionCount < MIN_FAQ_QUESTIONS) {
    findings.push(blockFinding("faq_too_few", `FAQ block has ${input.faqQuestionCount} question(s) — needs at least ${MIN_FAQ_QUESTIONS} real questions or none at all.`));
  }

  const b2bLinks = input.internalLinkPaths.filter((p) => B2B_PATH_PATTERNS.some((re) => re.test(p)));
  if (b2bLinks.length === 0) {
    findings.push(blockFinding("no_b2b_link", `Body links to no B2B page (e.g. /commercial) — at least one is required.`));
  }
  if (input.internalLinkPaths.length > MAX_INTERNAL_LINKS) {
    findings.push(blockFinding("too_many_internal_links", `Body has ${input.internalLinkPaths.length} internal links — at most ${MAX_INTERNAL_LINKS} allowed.`));
  }

  const similarity = highestDuplicateSimilarity(input.title, input.existingTitlesAndH1s);
  if (similarity > DUPLICATE_SIMILARITY_THRESHOLD) {
    findings.push(blockFinding("duplicate_topic", `Title is ${(similarity * 100).toFixed(0)}% similar to an existing post title/H1 (threshold ${DUPLICATE_SIMILARITY_THRESHOLD * 100}%).`));
  }

  const flesch = fleschReadingEase(body);
  if (flesch < FLESCH_MIN || flesch > FLESCH_MAX) {
    findings.push(warnFinding("reading_level", `Flesch Reading Ease is ${flesch.toFixed(0)} (target ${FLESCH_MIN}-${FLESCH_MAX} for an owner/manager audience) — approximate, no dictionary-backed syllable count.`));
  }

  return { findings, passes: findings.every((f) => f.severity !== "block") };
}

/** Spec Part 2: "Pipeline refuses to draft a topic tagged residential/rebate." */
export function isResidentialOrRebateTopic(topic: { title: string; targetQuery?: string | null; audience?: string | null }): boolean {
  const text = `${topic.title} ${topic.targetQuery ?? ""} ${topic.audience ?? ""}`.toLowerCase();
  return /\bresidential\b/.test(text) || /\brebates?\b/.test(text) || /\bhomeowners?\b/.test(text);
}
