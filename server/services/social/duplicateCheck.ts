/**
 * Duplicate check against the last 60 days of posts (docs/social-lane-spec.md
 * §3): similarity > 0.8 against any recent post → regenerate. A simple
 * token-overlap (Jaccard) similarity — deliberately not a full NLP/embedding
 * approach, per the owner's "don't over-engineer" instruction.
 */
const STOPWORDS = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "is", "are", "your", "our", "you", "we"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Jaccard similarity of two texts' token sets, in [0, 1]. */
export function textSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of Array.from(ta)) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.8;

/** True if `content` is too similar (> threshold) to any of `recentContents`. */
export function isDuplicateOfRecent(content: string, recentContents: string[], threshold: number = DUPLICATE_SIMILARITY_THRESHOLD): boolean {
  return recentContents.some((r) => textSimilarity(content, r) > threshold);
}
