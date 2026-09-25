/**
 * SEO bulk-approve claims linter (docs/seo-bulk-approve-spec.md §3).
 *
 * Pure, framework-free — runs identically on the server (gate before a batch
 * can be approved) and the client (inline row status as soon as a draft is
 * generated/edited). Never fetches, never touches the DB; callers that need
 * cross-page duplicate detection pass in the titles/metas to compare against.
 *
 * BLOCK findings fail the row — the batch cannot be approved until the row is
 * fixed or deselected. WARN findings are shown but do not block approval.
 */
import { PHONE_DISPLAY, PHONE_E164 } from "./business";

export type LintSeverity = "block" | "warn";

export type LintFinding = {
  severity: LintSeverity;
  code: string;
  message: string;
  /** Which field the finding is about, for inline highlighting. */
  field: "title" | "metaDescription" | "both";
};

export type LintResult = {
  findings: LintFinding[];
  /** True iff every finding is a warn (or there are none) — the row can be approved. */
  passes: boolean;
};

export type LintInput = {
  pagePath: string;
  title: string | null | undefined;
  metaDescription: string | null | undefined;
};

export type LintOptions = {
  /** Injectable for tests; defaults to the real current time. */
  now?: Date;
  /**
   * Title/meta strings already committed on OTHER pages (existing overrides +
   * the rest of the current batch) — used for the cross-page duplicate check.
   * Case-insensitive comparison; the page's own current value is excluded by
   * the caller before passing this in.
   */
  existingTitles?: string[];
  existingMetas?: string[];
};

/* ── Static rule tables ──────────────────────────────────────────────── */

const SUPERLATIVES = [
  "#1", "number one", "best", "top-rated", "top rated", "award-winning",
  "guaranteed", "lowest price", "cheapest",
];

const EXPIRED_INCENTIVES = [
  "federal tax credit", "tax credit", "25c", "ira credit", "$2,000 credit",
  "$2k", "rebate received", "hear", "homes rebate",
];

const CERTIFICATION_WORDS = ["certified", "mwbe", "wmbe", "sbe", "sedb", "dbe"];

const COMPETITOR_BRANDS = ["A.J. Perri", "Gold Medal", "Horizon", "Hutchinson"];

/**
 * Approved certification phrases — seeded empty until certifications are
 * verified with the business owner (spec §3: "currently all certification
 * wording BLOCKS"). Add an exact string here only once verified; matching is
 * case-insensitive but otherwise exact (no partial-credit for "close enough").
 */
export const APPROVED_CERTIFICATION_PHRASES: string[] = [];

/**
 * Small county→utility map so a "$16K"/"$16,000" claim can be checked against
 * whether the page's town is actually in PSE&G territory. Deliberately small
 * and explicit — unknown towns WARN rather than BLOCK (spec §3). Extend as
 * pages are reviewed; do not guess a town's utility.
 */
const PSEG_TERRITORY_CITY_SLUGS = new Set([
  "newark", "elizabeth", "jersey-city", "hoboken", "bayonne", "kearny", "harrison",
  "east-orange", "orange", "west-orange", "south-orange", "maplewood", "irvington",
  "bloomfield", "nutley", "belleville", "montclair", "clifton", "passaic", "garfield",
  "linden", "rahway", "roselle", "roselle-park", "hillside", "union", "springfield",
  "millburn", "short-hills", "summit", "westfield", "cranford", "clark", "woodbridge",
  "secaucus", "north-bergen", "weehawken", "union-city", "west-new-york", "guttenberg",
  "hackensack", "teaneck", "englewood", "fort-lee", "edgewater", "palisades-park",
  "ridgefield", "fairview", "cliffside-park", "livingston", "west-caldwell",
  "new-providence", "alpine", "saddle-river", "franklin-lakes", "wyckoff",
]);
// Explicitly NOT PSE&G (JCP&L / other utility) — named so a future page in one
// of these towns doesn't silently fall into "unknown -> WARN"; it should BLOCK
// the $16K claim outright once confirmed, but until then treat it the same as
// unknown (WARN) rather than guess. Kept here as a visible TODO list.
const KNOWN_NON_PSEG_CITY_SLUGS = new Set([
  "morristown", "parsippany", "dover", "rockaway", "denville", "randolph", "roxbury",
  "mount-olive", "boonton", "butler", "wayne", "pompton-lakes", "wanaque", "hawthorne",
  "woodland-park", "totowa", "little-falls", "west-milford", "newton", "sparta",
  "hopatcong", "sussex", "hardyston", "madison", "chatham", "mendham", "bernardsville",
  "chester", "harding", "bedminster", "peapack", "mountain-lakes",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary regex for a phrase from one of the static rule tables above
 * (SUPERLATIVES/EXPIRED_INCENTIVES/CERTIFICATION_WORDS/COMPETITOR_BRANDS) —
 * plain .includes() false-positives inside ordinary words ("best" inside
 * "asbestos", "hear" inside "heart", "horizon" inside "on the horizon").
 * \b only applies where the phrase's edge is actually alphanumeric — a
 * phrase like "#1" or "$2k" starts/ends with punctuation, where the natural
 * (non-word) boundary already does the right thing without \b.
 */
function phraseRegex(phrase: string, opts: { caseSensitive?: boolean } = {}): RegExp {
  const escaped = escapeRegExp(phrase);
  const left = /^[a-z0-9]/i.test(phrase) ? "\\b" : "";
  const right = /[a-z0-9]$/i.test(phrase) ? "\\b" : "";
  return new RegExp(`${left}${escaped}${right}`, opts.caseSensitive ? "" : "i");
}

function includesPhrase(text: string, phrase: string, opts?: { caseSensitive?: boolean }): boolean {
  return phraseRegex(phrase, opts).test(text);
}

const DOLLAR_FIGURE_RE = /\$\s?([\d,]+(?:\.\d+)?)\s?(k|K)?/g;

function parseDollarFigure(raw: string, kSuffix: boolean): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return kSuffix ? n * 1000 : n;
}

/** City slug this page path names, if it's a city page — null otherwise. */
function cityPageSlug(pagePath: string): string | null {
  const m = pagePath.match(/^\/hvac-([a-z-]+)-nj\/?$/);
  return m ? m[1] : null;
}

// Last-10-digits comparison (matches server/_core/rateLimit.ts's phoneKey()
// convention) — a bare "(862) 423-9396" and a "+1"-prefixed "18624239396"
// must compare equal, or the canonical number itself gets falsely flagged.
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const CANONICAL_PHONE_DIGITS = normalizePhone(PHONE_E164);

function blockFinding(field: LintFinding["field"], code: string, message: string): LintFinding {
  return { severity: "block", field, code, message };
}
function warn(field: LintFinding["field"], code: string, message: string): LintFinding {
  return { severity: "warn", field, code, message };
}

/* ── Main entry point ────────────────────────────────────────────────── */

export function lintPageMeta(input: LintInput, opts: LintOptions = {}): LintResult {
  const findings: LintFinding[] = [];
  const now = opts.now ?? new Date();
  const title = input.title ?? "";
  const meta = input.metaDescription ?? "";
  const titleLower = title.toLowerCase();
  const metaLower = meta.toLowerCase();
  const combined = `${title} ${meta}`;

  // Empty title/meta
  if (!title.trim()) findings.push(blockFinding("title", "empty_title", "Title is empty."));
  if (!meta.trim()) findings.push(blockFinding("metaDescription", "empty_meta", "Meta description is empty."));

  // Length limits
  if (title.length > 60) {
    findings.push(blockFinding("title", "title_too_long", `Title is ${title.length} characters (max 60).`));
  }
  if (meta.length > 155) {
    findings.push(blockFinding("metaDescription", "meta_too_long", `Meta description is ${meta.length} characters (max 155).`));
  }

  // Superlatives / unsupported claims
  for (const phrase of SUPERLATIVES) {
    if (includesPhrase(combined, phrase)) {
      findings.push(blockFinding("both", "superlative", `Unsupported superlative claim: "${phrase}".`));
    }
  }

  // Expired/unverified incentives
  for (const phrase of EXPIRED_INCENTIVES) {
    if (includesPhrase(combined, phrase)) {
      findings.push(blockFinding("both", "expired_incentive", `Expired or unverified incentive claim: "${phrase}".`));
    }
  }

  // Certification wording
  for (const word of CERTIFICATION_WORDS) {
    if (includesPhrase(combined, word)) {
      const approved = APPROVED_CERTIFICATION_PHRASES.some((p) => includesPhrase(combined, p));
      if (!approved) {
        findings.push(blockFinding("both", "unverified_certification", `Certification wording "${word}" is not in the approved-phrases list.`));
      }
    }
  }

  // Competitor brand names — case-SENSITIVE (unlike every other list above):
  // these are proper nouns written capitalized ("Horizon"), and generic
  // lowercase usage of the same word ("rebates on the horizon") must not
  // false-positive as a competitor mention.
  for (const brand of COMPETITOR_BRANDS) {
    if (includesPhrase(combined, brand, { caseSensitive: true })) {
      findings.push(blockFinding("both", "competitor_name", `Mentions competitor "${brand}".`));
    }
  }

  // "Limited time" / "expires" / "ends" with no date, or a past date
  const urgencyRe = /\b(limited time|expires?|ends?)\b/i;
  if (urgencyRe.test(combined)) {
    const dateMatch = combined.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4})\b/i);
    if (!dateMatch) {
      findings.push(blockFinding("both", "urgency_no_date", `Urgency language ("limited time"/"expires"/"ends") with no date given.`));
    } else {
      const parsed = new Date(dateMatch[0]);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < now.getTime()) {
        findings.push(blockFinding("both", "urgency_past_date", `Urgency language references a date in the past (${dateMatch[0]}).`));
      }
    }
  }

  // Phone numbers — must be the canonical business number
  const phoneMatches = combined.match(PHONE_RE) ?? [];
  for (const raw of phoneMatches) {
    if (normalizePhone(raw) !== CANONICAL_PHONE_DIGITS) {
      findings.push(blockFinding("both", "non_canonical_phone", `Phone number "${raw}" is not the canonical business number (${PHONE_DISPLAY}).`));
    }
  }

  // Dollar amounts
  const citySlug = cityPageSlug(input.pagePath);
  const dollarMatches = Array.from(combined.matchAll(DOLLAR_FIGURE_RE));
  for (const m of dollarMatches) {
    const value = parseDollarFigure(m[1], !!m[2]);
    if (Number.isNaN(value)) continue;
    if (value > 16000) {
      findings.push(blockFinding("both", "dollar_over_max", `Dollar figure "${m[0]}" exceeds the $16,000 program maximum.`));
    } else if (value === 16000) {
      if (citySlug && KNOWN_NON_PSEG_CITY_SLUGS.has(citySlug)) {
        findings.push(blockFinding("both", "dollar_wrong_territory", `"$16K" claim on a page for a known non-PSE&G town (${citySlug}).`));
      } else if (!citySlug || !PSEG_TERRITORY_CITY_SLUGS.has(citySlug)) {
        findings.push(warn("both", "dollar_unknown_territory", `"$16K" claim on a page whose utility territory isn't confirmed PSE&G — verify before approving.`));
      }
    }
  }

  // WARN-only checks
  if (/\bfree\b/i.test(combined) && !/free (assessment|estimate|quote|consultation|in-home)/i.test(combined)) {
    findings.push(warn("both", "free_without_context", `"free" is used without saying what's free.`));
  }
  if (/same-day/i.test(combined)) findings.push(warn("both", "same_day_claim", `"same-day" claim — confirm this is actually offered on this page's service area.`));
  if (/24\/7/i.test(combined)) findings.push(warn("both", "24_7_claim", `"24/7" claim — confirm emergency service is actually offered.`));
  if (/emergency/i.test(combined) && !/emergency/i.test(input.pagePath)) {
    findings.push(warn("both", "emergency_off_topic", `"emergency" wording on a page that isn't an emergency-service page.`));
  }
  const yearMatches = combined.match(/\b20\d{2}\b/g) ?? [];
  const currentYear = now.getFullYear();
  for (const y of yearMatches) {
    if (Number(y) !== currentYear) {
      findings.push(warn("both", "stale_year", `Year "${y}" is not the current year (${currentYear}) — confirm it's still accurate.`));
    }
  }

  // Cross-page duplicates
  if (title.trim() && opts.existingTitles?.some((t) => t.trim().toLowerCase() === titleLower.trim())) {
    findings.push(blockFinding("title", "duplicate_title", `Title is identical to one already used on another page.`));
  }
  if (meta.trim() && opts.existingMetas?.some((m) => m.trim().toLowerCase() === metaLower.trim())) {
    findings.push(blockFinding("metaDescription", "duplicate_meta", `Meta description is identical to one already used on another page.`));
  }

  return { findings, passes: findings.every((f) => f.severity !== "block") };
}

/** Convenience: does this input have at least one BLOCK finding? */
export function isBlocked(input: LintInput, opts?: LintOptions): boolean {
  return !lintPageMeta(input, opts).passes;
}
