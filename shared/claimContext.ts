/**
 * Sentence-level context for the claims linters (seoLinter.ts / contentLinter.ts).
 *
 * Several warranty/claim rules used to be raw substring or character-window checks
 * ("the word 'included' within 80 chars of 'coverage'", "'manufacturer's warranty'
 * and 'we' anywhere in the post"), so honest copy that asks a question, disclaims
 * ("never guaranteed"), or contrasts ("the manufacturer's warranty is separate from
 * anything a contractor offers") was blocked exactly like an assertion. These helpers
 * let a rule look at ONE sentence and tell an assertion from a question, a negation
 * or a quotation — without loosening what a genuine assertion still trips.
 */

/**
 * Split text into sentences on terminal punctuation followed by whitespace, AND on
 * newlines. renderPostPlainText separates headings, paragraphs and every checklist
 * item with "\n", so an unpunctuated heading or list item is its own sentence instead
 * of being glued onto whatever follows it.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True for an interrogative sentence (an FAQ question, "Is coverage included?") — a question asserts nothing. */
export function isQuestion(sentence: string): boolean {
  return /\?\s*["'”’)]*\s*$/.test(sentence.trim());
}

const NEGATION_SRC =
  "\\b(?:not|never|isn't|isn’t|aren't|aren’t|wasn't|weren't|doesn't|doesn’t|don't|don’t|won't|won’t|can't|cannot|without|rather than|instead of|unless|neither|nor)\\b|n['’]t\\b";

/**
 * Neutralize phrases that contain a negation word but do not negate: "not only X but
 * also Y" asserts X, "no matter what" is not a denial. Without this, "Not only do we
 * offer 24/7 service" would be waved through as a negated mention.
 */
export function stripFalseNegations(s: string): string {
  return s.replace(/\bnot only\b/gi, "also").replace(/\bno matter\b/gi, "regardless");
}

/** True if the sentence contains a negation cue (not / never / isn't / rather than / without / unless …). */
export function hasNegation(sentence: string): boolean {
  return new RegExp(NEGATION_SRC, "i").test(stripFalseNegations(sentence));
}

/** Words that mark coverage as a separate, paid, optional thing — i.e. the sentence says it is NOT included. */
export const OPTIONAL_COVERAGE_RE = /\b(?:optional|add-on|add on|paid|separate(?:ly)?|extra cost|priced separately|at an additional cost)\b/i;

/**
 * True if the match at `index` in `text` sits inside a quotation ('24-hour response',
 * "24/7") — i.e. the copy is QUOTING a phrase (often critically), not claiming it.
 */
export function isQuotedAt(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 3), index).replace(/\s+$/, "");
  return /["'“‘”’]$/.test(before);
}

/** The start of the clause containing `index` (after the last sentence break or comma). */
export function clauseBefore(text: string, index: number): string {
  let start = 0;
  for (const c of [".", "!", "?", ";", ",", "\n", ":"]) start = Math.max(start, text.lastIndexOf(c, index - 1) + 1);
  return text.slice(start, index);
}
