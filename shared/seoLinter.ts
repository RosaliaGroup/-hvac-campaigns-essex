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
import { VERIFIED_FACTS } from "./verifiedFacts";
import { splitSentences, isQuestion, hasNegation, OPTIONAL_COVERAGE_RE, isQuotedAt, clauseBefore, stripFalseNegations } from "./claimContext";

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
  /**
   * §9d/§9e fact-dependent checks (SLA-hour matching, "24/7 monitoring").
   * Defaults to the unconfigured shape (responseHours: null, is24x7: false),
   * so an SLA-hour or "24/7 monitoring" claim BLOCKs by default unless the
   * caller passes the real, owner-set VERIFIED_FACTS values.
   */
  differentiationFacts?: { portfolioSla: { responseHours: number | null }; monitoring: { is24x7: boolean }; serviceHours?: { emergency24x7: boolean; sameDay: boolean } };
  /** §9b price-range matching. Defaults to empty — any "$X installed" claim BLOCKs until the caller passes real VERIFIED_FACTS.priceRanges entries for this page. */
  priceRanges?: Array<{ page: string; low: number; high: number }>;
  /** Numeric business claims (counties, years in business, customers…). Defaults to VERIFIED_FACTS.business. */
  numericFacts?: NumericClaimFacts;
};

const UNCONFIGURED_DIFFERENTIATION_FACTS = { portfolioSla: { responseHours: null }, monitoring: { is24x7: false } };

/* ── Static rule tables ──────────────────────────────────────────────── */

// Exported: server/services/seo/contentLinter.ts reuses these same word lists
// for the extended body-content linter (docs/seo-automation-spec.md Part 2 —
// "same rules as title/meta plus...") so the two never drift apart.
export const SUPERLATIVES = [
  "#1", "number one", "best", "top-rated", "top rated", "award-winning",
  "guaranteed", "lowest price", "cheapest",
];

/**
 * "guaranteed" is a superlative only when it is ASSERTED ("guaranteed savings"). In a question ("Are rebate amounts
 * guaranteed?") or a disclaimer ("outcomes are never guaranteed", "not a guaranteed outcome") it is the honest thing
 * to say, so those sentences don't trip the rule.
 */
export function isGuaranteeAsserted(text: string): boolean {
  return splitSentences(text).some((s) => /\bguaranteed\b/i.test(s) && !isQuestion(s) && !hasNegation(s));
}

export const EXPIRED_INCENTIVES = [
  "federal tax credit", "tax credit", "25c", "ira credit", "$2,000 credit",
  "$2k", "rebate received", "hear", "homes rebate",
];

export const CERTIFICATION_WORDS = ["certified", "mwbe", "wmbe", "sbe", "sedb", "dbe"];

export const COMPETITOR_BRANDS = ["A.J. Perri", "Gold Medal", "Horizon", "Hutchinson"];

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

export function includesPhrase(text: string, phrase: string, opts?: { caseSensitive?: boolean }): boolean {
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

export type UtilityTerritory = "pseg" | "non_pseg" | "unknown";

/**
 * Which utility territory a page's town is in, from PSEG_TERRITORY_CITY_SLUGS /
 * KNOWN_NON_PSEG_CITY_SLUGS above — exported so the AI drafting prompt (see
 * server/services/seo/ai/anthropicProvider.ts) can tell the model up front
 * whether a "$16K" PSE&G rebate claim is even eligible for this page, instead
 * of relying on the linter to catch it after the fact.
 */
export function cityUtilityTerritory(pagePath: string): UtilityTerritory {
  const slug = cityPageSlug(pagePath);
  if (!slug) return "unknown";
  if (PSEG_TERRITORY_CITY_SLUGS.has(slug)) return "pseg";
  if (KNOWN_NON_PSEG_CITY_SLUGS.has(slug)) return "non_pseg";
  return "unknown";
}

// Last-10-digits comparison (matches server/_core/rateLimit.ts's phoneKey()
// convention) — a bare "(862) 423-9396" and a "+1"-prefixed "18624239396"
// must compare equal, or the canonical number itself gets falsely flagged.
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const CANONICAL_PHONE_DIGITS = normalizePhone(PHONE_E164);

/* ── Warranty claim rules (docs/positioning-warranty-spec.md §2) ────────
 * Shared between shared/seoLinter.ts (title/meta, short strings) and
 * shared/contentLinter.ts (body, long-form) — same reuse pattern as
 * SUPERLATIVES/EXPIRED_INCENTIVES/etc. above. Returns a minimal
 * {severity, code, message} shape; each caller wraps it into its own
 * richer finding type. */

export type WarrantyLintFinding = { severity: LintSeverity; code: string; message: string };

const WARRANTY_INCLUSION_PHRASES = ["included", "free warranty", "comes with", "every install includes", "standard on all"];
const WARRANTY_ABSOLUTE_CLAIMS = ["lifetime", "unlimited", "no questions asked", "guaranteed for life"];

/**
 * Populate once the owner discloses the administrator's legal name — the
 * spec deliberately keeps that name out of marketing copy (named only in
 * the written agreement and the /warranty terms disclosure line), so this
 * starts empty. Empty means the rule has nothing to match yet, not that
 * it's disabled — same convention as APPROVED_CERTIFICATION_PHRASES above.
 */
export const WARRANTY_ADMIN_BRAND_NAMES: string[] = [];

const WARRANTY_WORD_RE = /\b(warranty|coverage)\b/gi;
const WARRANTY_PROXIMITY_CHARS = 80;

function nearWarrantyWord(text: string, idx: number): boolean {
  WARRANTY_WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WARRANTY_WORD_RE.exec(text))) {
    if (Math.abs(m.index - idx) <= WARRANTY_PROXIMITY_CHARS) return true;
  }
  return false;
}

/**
 * Warranty-specific claim rules for marketing copy (title, meta, H1, body).
 * `allowedOnTermsPage` should be true only for /warranty's own terms
 * disclosure block — the one place the administrator's name is permitted.
 */
export function lintWarrantyClaims(text: string, opts: { allowedOnTermsPage?: boolean } = {}): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;

  // Sentence-level: a sentence that ASSERTS inclusion ("A 10-year warranty is included with every install").
  // A question ("Does the coverage come included?"), a negation ("a paid add-on rather than something included")
  // or a sentence that calls the coverage optional/paid/separate says the opposite and is not flagged.
  const sentenceList = splitSentences(text);
  for (const phrase of WARRANTY_INCLUSION_PHRASES) {
    const re = phraseRegex(phrase);
    const asserted = sentenceList.some(
      (s) => re.test(s) && /\b(?:warranty|coverage)\b/i.test(s) && !isQuestion(s) && !hasNegation(s) && !OPTIONAL_COVERAGE_RE.test(s),
    );
    if (asserted) {
      findings.push({
        severity: "block",
        code: "warranty_implies_included",
        message: `"${phrase}" appears in a sentence with "warranty"/"coverage" — it implies coverage is included/free, but it is a paid optional add-on.`,
      });
    }
  }

  for (const phrase of WARRANTY_ABSOLUTE_CLAIMS) {
    if (includesPhrase(text, phrase)) {
      findings.push({
        severity: "block",
        code: "warranty_absolute_claim",
        message: `"${phrase}" overstates the coverage — the verified term is 10 years, not lifetime/unlimited.`,
      });
    }
  }

  // Same sentence only (it used to be "anywhere in the post"), and not when the sentence contrasts the two
  // ("the manufacturer's warranty is separate from anything a contractor offers") or asks a question.
  if (
    sentenceList.some(
      (s) =>
        /manufacturer'?s warranty/i.test(s) &&
        /\b(?:we|our|us)\b/i.test(s) &&
        !isQuestion(s) &&
        !hasNegation(s) &&
        !/\b(?:separate|distinct|independent|different|apart from)\b/i.test(s),
    )
  ) {
    findings.push({
      severity: "block",
      code: "warranty_manufacturer_confusion",
      message: `"manufacturer's warranty" appears alongside "we"/"our" — do not present the manufacturer's warranty as Mechanical Enterprise's own coverage.`,
    });
  }

  // A year count counts only when it is attached to the coverage term — "a 12-year warranty", "20 year parts and labor",
  // "coverage for 15 years" — and is not one end of a range ("the 5-8 year window" is an equipment age, not a term).
  const yearAttachedRes = [
    /(?<![\d]\s*[-–—]\s*)(?<!\bto\s)\b(\d+)[\s-]?years?[\s-]+(?:of\s+)?(?:parts|labor|warranty|coverage|extended|protection|service\s+(?:agreement|plan|contract))/gi,
    /\b(?:warranty|coverage)\b[^.!?\n]{0,30}?\b(?:for|lasts?|of|term of|runs? for|up to)\s+(\d+)\s*(?:-|\s)?years?\b/gi,
  ];
  const yearSeen = new Set<string>();
  for (const yre of yearAttachedRes) {
    for (const ym of Array.from(text.matchAll(yre))) {
      if (Number(ym[1]) === 10 || yearSeen.has(ym[1])) continue;
      yearSeen.add(ym[1]);
      findings.push({
        severity: "block",
        code: "warranty_wrong_year_count",
        message: `"${ym[0].trim()}" attaches a ${ym[1]}-year term to warranty/coverage — the verified coverage term is 10 years.`,
      });
    }
  }

  if (!opts.allowedOnTermsPage) {
    for (const brand of WARRANTY_ADMIN_BRAND_NAMES) {
      if (includesPhrase(text, brand, { caseSensitive: true })) {
        findings.push({
          severity: "block",
          code: "warranty_admin_named",
          message: `Names the coverage administrator ("${brand}") outside the /warranty terms disclosure block.`,
        });
      }
    }
  }

  // Segmented on newlines as well (checklist items / headings are their own sentences), and a QUESTION ("Is coverage
  // available on existing equipment?") is not a claim — its answer is judged on its own.
  for (const sentence of sentenceList) {
    if (isQuestion(sentence)) continue;
    if (/\bexisting (systems?|equipment|hvac)\b/i.test(sentence) && /\b(warranty|coverage)\b/i.test(sentence)) {
      if (!/\beligib/i.test(sentence) && !/\bqualif/i.test(sentence)) {
        findings.push({
          severity: "block",
          code: "warranty_existing_no_eligibility",
          message: `Mentions existing-system coverage without "eligible"/"qualify" in the same sentence: "${sentence.trim()}".`,
        });
      }
    }
  }

  const firstTenYear = /10-year/i.exec(text);
  if (firstTenYear) {
    const after = text.slice(firstTenYear.index, firstTenYear.index + firstTenYear[0].length + 40);
    if (!/parts\s*(&|and)\s*labor/i.test(after)) {
      findings.push({
        severity: "warn",
        code: "warranty_missing_parts_labor",
        message: `First use of "10-year" on the page isn't followed by "parts & labor"/"parts and labor".`,
      });
    }
  }

  return findings;
}

/* ── Differentiation add-on rules (docs/positioning-warranty-spec.md §9) ─
 * Same reuse pattern as lintWarrantyClaims above — shared between
 * shared/seoLinter.ts and shared/contentLinter.ts. Split into a pure,
 * facts-free function and a facts-dependent one so callers that don't have
 * a VerifiedFacts handy (or don't need the fact-dependent checks) can still
 * run the pure rules. */

const MEMBERSHIP_FORBIDDEN_PHRASES = ["lease", "rent", "subscription includes the equipment", "$0 down for everything"];
/** "lease"/"rent" are only a violation when asserted — a negated mention ("not a lease", "unlike a lease", "we don't rent") is the honest way to say the customer owns the system. */
const NEGATABLE_MEMBERSHIP_PHRASES = new Set(["lease", "rent"]);
const NEGATION_CUE_SRC = "\\b(?:not|no|never|neither|nor|without|unlike|isn't|isn’t|aren't|aren’t|doesn't|doesn’t|don't|don’t|won't|won’t)\\b|n['’]t\\b";
const NEGATION_JUST_BEFORE_RE = new RegExp(`(?:${NEGATION_CUE_SRC})[^.!?;:,\n]{0,40}$`, "i");
const SENTENCE_BREAKS = [".", "!", "?", ";", "\n"];

/**
 * True when "lease"/"rent" is about a TENANT's lease, not leasing equipment to the customer:
 * "lease renewal", "lease term", "lease expiration", "rent roll", or a sentence that talks about tenants/landlords.
 */
function isTenancyContext(text: string, index: number, length: number): boolean {
  const after = text.slice(index + length);
  if (/^[-\s]*(?:renewals?|terms?|expirations?|expiry|expires?|agreements?|negotiations?|clauses?|obligations?|incentives?|rolls?|increases?|control|concessions?|collections?|payments?)\b/i.test(after)) return true;
  let start = 0;
  for (const c of SENTENCE_BREAKS) start = Math.max(start, text.lastIndexOf(c, index - 1) + 1);
  const ends = SENTENCE_BREAKS.map((c) => text.indexOf(c, index + length)).filter((i) => i >= 0);
  const end = ends.length ? Math.min(...ends) : text.length;
  return /\b(?:tenants?|landlords?|lessors?|lessees?)\b/i.test(text.slice(start, end));
}

/** True iff the mention at `index` is negated: a negation cue shortly before it in the same clause (no comma or sentence break between). */
function isNegatedMention(text: string, index: number): boolean {
  let start = 0;
  for (const c of SENTENCE_BREAKS) start = Math.max(start, text.lastIndexOf(c, index - 1) + 1);
  return NEGATION_JUST_BEFORE_RE.test(stripFalseNegations(text.slice(start, index)));
}
const NOT_OFFERED_FORBIDDEN_PHRASES = ["money-back", "refund if", "remove it and refund", "satisfaction guarantee"];
const SLA_ABSOLUTE_CLAIMS = ["guaranteed uptime", "never fail"];
const MONITORING_ABSOLUTE_CLAIMS = ["guaranteed detection"];

/**
 * Pure §9 rules that need no VerifiedFacts: 9a's membership/equipment-
 * ownership phrases, the "explicitly NOT offered" comfort/refund-guarantee
 * phrases, and 9d/9e's absolute SLA/monitoring claims.
 */
export function lintDifferentiationClaims(text: string): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;

  for (const phrase of MEMBERSHIP_FORBIDDEN_PHRASES) {
    const asserted = NEGATABLE_MEMBERSHIP_PHRASES.has(phrase)
      ? Array.from(text.matchAll(new RegExp(phraseRegex(phrase).source, "gi"))).some((m) => !isNegatedMention(text, m.index ?? 0) && !isTenancyContext(text, m.index ?? 0, m[0].length))
      : includesPhrase(text, phrase);
    if (asserted) {
      findings.push({
        severity: "block",
        code: "membership_equipment_ownership_implied",
        message: `"${phrase}" implies Mechanical Enterprise owns/leases the equipment — the customer owns the system; membership is a coverage/service fee only.`,
      });
    }
  }

  for (const phrase of NOT_OFFERED_FORBIDDEN_PHRASES) {
    if (includesPhrase(text, phrase)) {
      findings.push({
        severity: "block",
        code: "comfort_refund_guarantee_not_offered",
        message: `"${phrase}" — a comfort/refund guarantee is explicitly NOT offered (owner declined, docs/positioning-warranty-spec.md §9).`,
      });
    }
  }

  for (const phrase of SLA_ABSOLUTE_CLAIMS) {
    if (includesPhrase(text, phrase)) {
      findings.push({
        severity: "block",
        code: "sla_absolute_claim",
        message: `"${phrase}" overstates the portfolio SLA — no uptime/failure guarantee is offered.`,
      });
    }
  }

  for (const phrase of MONITORING_ABSOLUTE_CLAIMS) {
    if (includesPhrase(text, phrase)) {
      findings.push({
        severity: "block",
        code: "monitoring_absolute_claim",
        message: `"${phrase}" overstates proactive monitoring — detection is not guaranteed.`,
      });
    }
  }

  return findings;
}

/**
 * §9 rules that need VerifiedFacts: 9d's SLA-hour matching and 9e's
 * conditional "24/7 monitoring" claim. Takes the minimal shape needed
 * (not the full VerifiedFacts type) so shared/seoLinter.ts doesn't have to
 * import shared/verifiedFacts.ts's full surface.
 */
/** First match of `re` that is neither quoted nor negated ("don't assume 24/7", "'24-hour response'"), or null. */
function firstAssertedMatch(text: string, re: RegExp): RegExpMatchArray | null {
  for (const m of Array.from(text.matchAll(new RegExp(re.source, "gi")))) {
    if (!isQuotedAt(text, m.index ?? 0) && !isNegatedMention(text, m.index ?? 0)) return m;
  }
  return null;
}

export function lintDifferentiationFactClaims(
  text: string,
  facts: { portfolioSla: { responseHours: number | null }; monitoring: { is24x7: boolean }; serviceHours?: { emergency24x7: boolean; sameDay: boolean } },
): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;

  const slaHourRe = /(\d+)[\s-]?hour(?:s)?\s+response/gi;
  let sm: RegExpExecArray | null;
  while ((sm = slaHourRe.exec(text))) {
    // A quoted ('24-hour response') or negated mention is discussing the phrase, not claiming it.
    if (isQuotedAt(text, sm.index) || isNegatedMention(text, sm.index)) continue;
    const claimed = Number(sm[1]);
    if (facts.portfolioSla.responseHours === null || claimed !== facts.portfolioSla.responseHours) {
      findings.push({
        severity: "block",
        code: "sla_hours_mismatch",
        message:
          facts.portfolioSla.responseHours === null
            ? `"${sm[0]}" claims an SLA response time, but no response-hours figure has been verified yet (VERIFIED_FACTS.portfolioSla.responseHours is null).`
            : `"${sm[0]}" doesn't match the verified SLA response time (${facts.portfolioSla.responseHours} hours).`,
      });
    }
  }

  if (/24\/7 monitoring/i.test(text) && !facts.monitoring.is24x7) {
    findings.push({
      severity: "block",
      code: "monitoring_24x7_unverified",
      message: `"24/7 monitoring" is claimed, but the owner hasn't confirmed 24/7 coverage (VERIFIED_FACTS.monitoring.is24x7 is false).`,
    });
  }

  // Service-hours claims: "24/7", "24x7", "around the clock" and "same-day" need an explicit owner-set fact.
  // "24/7 monitoring" is governed by the monitoring rule above, so it is stripped here to avoid a duplicate finding.
  const hours = facts.serviceHours ?? { emergency24x7: false, sameDay: false };
  const withoutMonitoring = text.replace(/24\s*(?:\/|x)\s*7\s+monitoring/gi, " ");
  if (!hours.emergency24x7) {
    const m = firstAssertedMatch(withoutMonitoring, /\b24\s*(?:\/|x)\s*7\b|\baround[\s-]the[\s-]clock\b/i);
    if (m) {
      findings.push({
        severity: "block",
        code: "service_hours_24x7_unverified",
        message: `"${m[0]}" claims round-the-clock service, but the owner hasn't confirmed it (VERIFIED_FACTS.serviceHours.emergency24x7 is false).`,
      });
    }
  }
  if (!hours.sameDay) {
    const m = firstAssertedMatch(text, /\bsame[\s-]day\b/i);
    if (m) {
      findings.push({
        severity: "block",
        code: "service_hours_same_day_unverified",
        message: `"${m[0]}" claims same-day service, but the owner hasn't confirmed it (VERIFIED_FACTS.serviceHours.sameDay is false).`,
      });
    }
  }

  return findings;
}

/**
 * Any dollar RANGE ("$8,000–$15,000", "$100-$200", "$5K to $9K") must match a
 * VERIFIED_FACTS.priceRanges entry exactly (low and high). With priceRanges
 * empty (today) every range BLOCKs. Ranges immediately followed by "installed"
 * are left to lintPriceRangeClaims (page-specific) so they aren't double-reported.
 */
export function lintDollarRanges(text: string, priceRanges: Array<{ page: string; low: number; high: number }>): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;
  const num = "[\\d,]+(?:\\.\\d+)?";
  const rangeRes = [
    new RegExp(`\\$\\s?(${num})\\s?([kK])?\\s*(?:[-–—]|to)\\s*\\$?\\s?(${num})\\s?([kK])?(?!\\d)`, "gi"),
    // "between $8,000 and $15,000" — the same range in words.
    new RegExp(`\\bbetween\\s+\\$\\s?(${num})\\s?([kK])?\\s+and\\s+\\$?\\s?(${num})\\s?([kK])?(?!\\d)`, "gi"),
  ];
  for (const re of rangeRes) {
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (/^\s*installed\b/i.test(text.slice(m.index + m[0].length))) continue;
    const toNum = (raw: string, k?: string) => parseFloat(raw.replace(/,/g, "")) * (k ? 1000 : 1);
    const lo = toNum(m[1], m[2] ?? (m[4] && !m[2] ? m[4] : undefined));
    const hi = toNum(m[3], m[4]);
    const verified = priceRanges.some((r) => r.low === lo && r.high === hi);
    if (!verified) {
      findings.push({
        severity: "block",
        code: "unverified_dollar_range",
        message:
          priceRanges.length === 0
            ? `"${m[0].trim()}" is a dollar range, but no price range has been verified yet (VERIFIED_FACTS.priceRanges is empty).`
            : `"${m[0].trim()}" doesn't match any verified price range (VERIFIED_FACTS.priceRanges).`,
      });
    }
  }
  }
  return findings;
}


/**
 * Numeric business claims — county counts, years in business, customer /
 * project / technician / review counts and ratings. The fact firewall's rule:
 * a number like this may appear ONLY if it exists in VERIFIED_FACTS. Today that
 * means the county count (business.serviceCounties.length) and
 * business.yearsInBusiness; there are no verified customer, project,
 * technician or review figures, so ANY such claim blocks. Reads digits ("1,200", "2k"),
 * spelled-out numbers ("fifteen counties") and the vague-quantity forms ("hundreds of
 * customers"); skips dollar amounts, rates ("1 in 3 homeowners"), calendar years and a bare "one". Coverage terms ("10-year parts & labor") and
 * equipment ages ("over 10 years old") are deliberately not matched — only
 * tenure/count phrasings are.
 */
export type NumericClaimFacts = { business: { serviceCounties: string[]; yearsInBusiness: number } };

// Spelled-out numbers ("fifteen counties", "thirty years serving NJ") are claims too — digits alone let them through.
const UNIT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD_NUM = `(?:(?:${Object.keys(TENS_WORDS).join("|")})(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?|${Object.keys(UNIT_WORDS).join("|")}|hundred|dozen)`;

/** Numeric value of a matched number token: digits ("1,200", "2.5"), K notation ("2k"), or a number word. NaN if unreadable. */
function numberValue(raw: string): number {
  const t = raw.trim().toLowerCase();
  if (/^\d/.test(t)) {
    const k = /k$/.test(t);
    const n = parseFloat(t.replace(/[,\s]|k$/g, ""));
    return k ? n * 1000 : n;
  }
  if (t === "hundred") return 100;
  if (t === "dozen") return 12;
  const [head, tail] = t.split(/[-\s]/);
  if (head in TENS_WORDS) return TENS_WORDS[head] + (tail ? (UNIT_WORDS[tail] ?? 0) : 0);
  return UNIT_WORDS[head] ?? NaN;
}

// Not glued to a preceding letter/digit/dot — "HSPF2 ratings" and "SEER2 rating" are efficiency ratings, not "2 ratings" —
// and not a dollar amount ("Up to $16K HVAC installation" is a price, not a count of installations).
// Reads digits (optionally with a K suffix: "2k clients") or a number word.
const NUM = "(?<![A-Za-z0-9.$])(?<!\\$\\s)(\\d[\\d,]*(?:\\.\\d+)?\\s?[kK]?(?![A-Za-z0-9])|" + WORD_NUM + ")";
// A share or a rate, not a count of OUR customers/projects: "1 in 3 homeowners", "every 3 homeowners", "2 of 5 families".
const NOT_RATE = "(?<!\\b(?:in|of|per|every|each|out\\s+of)\\s)";
const ADJ = "(?:(?:happy|satisfied|local|nj|repeat|new|residential|commercial|completed|successful|finished|hvac|installation)\\s+)*";
const PEOPLE = "(?:customers|clients|homeowners|families|households|property managers|building owners)";
const WORK = "(?:projects|installations|installs|jobs)";
const FIRST_PERSON_RE = /\b(?:we|our|us|ours|mechanical enterprise)\b/i;
/** Exempt a count that is about the READER's own situation ("your portfolio spanning 3 counties", "a crew of 3 technicians", "if you have 5 projects a year"), never one that is about us. */
const readerContext = (cue: RegExp) => (before: string) => cue.test(before) && !FIRST_PERSON_RE.test(before);

const NUMERIC_CLAIM_RULES: Array<{ kind: string; re: RegExp; verified?: (f: NumericClaimFacts) => number | null; exempt?: (clauseBefore: string) => boolean }> = [
  {
    kind: "county count",
    re: new RegExp(NUM + "\\+?[-\\s]*(?:(?:nj|new jersey|northern|north jersey|surrounding|neighboring)\\s+)*counties\\b", "gi"),
    verified: (f) => f.business.serviceCounties.length,
    exempt: readerContext(/\b(?:spanning|spans?|span|your|portfolios?|properties (?:in|across)|buildings (?:in|across)|located in|if you)\b/i),
  },
  {
    kind: "years in business",
    re: new RegExp(NUM + "\\+?[\\s-]*years?\\s+(?:in business|of experience|experience|of service|serving|in the (?:hvac )?(?:business|industry))\\b", "gi"),
    verified: (f) => f.business.yearsInBusiness,
  },
  {
    kind: "years in business",
    re: new RegExp("\\b(?:in business for|serving\\s+[\\w\\s,&.'-]{0,30}?\\s+for)\\s+(?:over\\s+|more than\\s+|nearly\\s+|almost\\s+)?" + NUM + "\\+?\\s+years\\b", "gi"),
    verified: (f) => f.business.yearsInBusiness,
  },
  { kind: "customer count", re: new RegExp(NOT_RATE + NUM + "\\+?\\s+" + ADJ + PEOPLE + "\\b", "gi") },
  { kind: "project count", re: new RegExp(NOT_RATE + NUM + "\\+?\\s+" + ADJ + WORK + "\\b", "gi"), exempt: readerContext(/\b(?:you|you've|you're|your|if you|bidding|planning|per year|a year)\b/i) },
  { kind: "technician count", re: new RegExp(NUM + "\\+?\\s+(?:licensed\\s+|certified\\s+|expert\\s+|trained\\s+|skilled\\s+|full-time\\s+)?(?:technicians|techs|installers|team members|employees|crew members)\\b", "gi"), exempt: readerContext(/\b(?:crew of|team of|sends?|dispatch(?:es)?|assigned?|on[- ]site|per (?:visit|job)|will (?:send|arrive))\b/i) },
  { kind: "review count", re: new RegExp(NUM + "\\+?\\s+(?:five[- ]star\\s+|5[- ]star\\s+|verified\\s+|google\\s+)?(?:reviews|ratings|testimonials)\\b", "gi") },
  { kind: "star rating", re: /(?<![A-Za-z0-9.])(\d(?:\.\d)?)[\s-]*stars?\b/gi },
  // "4.9/5" is a rating only with rating context ("rated 4.9/5", "4.9/5 stars") and not as part of "3/5/10" or "a 4/5 step process".
  // A decimal (4.9/5) is always a rating; a whole number (4/5) only with rating context. Never part of "3/5/10".
  { kind: "star rating", re: /\b(?:rated|rating|ratings|reviews?|scores?|scored)\s*(?:of|at|:)?\s*(\d(?:\.\d)?)\s*\/\s*5\b(?!\s*\/\s*\d)|(?<![\d\/.])(\d\.\d)\s*\/\s*5\b(?!\s*\/\s*\d)|(?<![\d\/.])(\d)\s*\/\s*5\s*(?:stars?|rating|rated|reviews?|on\s+(?:google|yelp|facebook|angi|bbb)|by\s+(?:our\s+)?(?:customers|clients))\b/gi },
  { kind: "vague quantity", re: new RegExp("\\b(?:hundreds|thousands|dozens|scores)\\s+of\\s+(?:happy\\s+|satisfied\\s+)?(?:customers|clients|homeowners|families|property managers|building owners|projects|installations|jobs|reviews)\\b", "gi") },
];

/** Kinds that are COUNTS of people/things (a bare "one", or a calendar year in a title, is not a claim about how many). */
const COUNT_KINDS = new Set(["county count", "customer count", "project count", "technician count", "review count"]);

export function lintNumericClaims(text: string, facts: NumericClaimFacts): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;
  const seen = new Set<string>();
  for (const rule of NUMERIC_CLAIM_RULES) {
    for (const m of Array.from(text.matchAll(rule.re))) {
      const claimed = numberValue(m[1] ?? "");
      if (COUNT_KINDS.has(rule.kind)) {
        if (Number.isFinite(claimed) && claimed <= 1) continue; // singular use ("one installation")
        if (/^\d{4}$/.test((m[1] ?? "").trim()) && claimed >= 2015 && claimed <= 2035) continue; // a calendar year in a title ("2026 Homeowner's Guide"), not a count
      }
      const verified = rule.verified ? rule.verified(facts) : null;
      if (verified !== null && Number.isFinite(claimed) && claimed === verified) continue;
      if (rule.exempt?.(clauseBefore(text, m.index ?? 0))) continue;
      const key = rule.kind + "|" + m[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        severity: "block",
        code: "unverified_numeric_claim",
        message:
          verified !== null
            ? `"${m[0].trim()}" is a ${rule.kind} claim that doesn't match VERIFIED_FACTS (verified: ${verified}).`
            : `"${m[0].trim()}" is a ${rule.kind} claim, but no ${rule.kind} is in VERIFIED_FACTS — state no number.`,
      });
    }
  }
  return findings;
}

/** True for installation pages (the route says "install"): the positioning pages whose titles should carry the 10-year coverage. Blog posts and /direct-install/* (a rebate program) are not. */
export function isInstallationPagePath(pagePath: string): boolean {
  if (pagePath.startsWith("/blog/") || pagePath.startsWith("/direct-install")) return false;
  return /install/i.test(pagePath);
}

/** True for installation and city pages — where the positioning is installation-led and a rebate-first title is off-message. Blog posts and /direct-install/* (a rebate program) are exempt. */
function isInstallationOrCityPage(pagePath: string): boolean {
  if (pagePath.startsWith("/blog/") || pagePath.startsWith("/direct-install")) return false;
  return cityPageSlug(pagePath) !== null || /install/i.test(pagePath);
}

/** WARN: a title whose first clause leads with rebates / a dollar figure on an installation or city page. */
export function lintRebateLeadingTitle(pagePath: string, title: string): WarrantyLintFinding[] {
  if (!title || !isInstallationOrCityPage(pagePath)) return [];
  const lead = title.split(/\s*[|:–—]\s*|\s+-\s+/)[0] ?? title;
  if (/\b(?:rebates?|incentives?)\b|\$\s?\d|\bup to \$/i.test(lead)) {
    return [
      {
        severity: "warn",
        code: "title_leads_with_rebate",
        message: `Title leads with rebates/a dollar figure ("${lead.trim()}") on an installation or city page — lead with installation quality and the 10-year parts & labor coverage; rebates are secondary.`,
      },
    ];
  }
  return [];
}

/**
 * §9b — "any $ figure on an install page must match a priceRanges entry
 * within ±0". Scoped to explicit "installed" price language (e.g. "$5,000-
 * $9,000 installed") so it never collides with the separate rebate-dollar
 * checks above, which are about incentive claims, not installed-cost ranges.
 */
export function lintPriceRangeClaims(pagePath: string, text: string, priceRanges: Array<{ page: string; low: number; high: number }>): WarrantyLintFinding[] {
  const findings: WarrantyLintFinding[] = [];
  if (!text) return findings;

  const installedPriceRe = /\$[\d,]+(?:\.\d+)?\s?[kK]?(?:\s*[-–—]\s*\$[\d,]+(?:\.\d+)?\s?[kK]?)?\s+installed\b/gi;
  const pageRanges = priceRanges.filter((r) => r.page === pagePath);
  let m: RegExpExecArray | null;
  while ((m = installedPriceRe.exec(text))) {
    const nums = Array.from(m[0].matchAll(/[\d,]+(?:\.\d+)?/g)).map((n) => parseFloat(n[0].replace(/,/g, "")));
    const allMatch = nums.length > 0 && nums.every((n) => pageRanges.some((r) => r.low === n || r.high === n));
    if (!allMatch) {
      findings.push({
        severity: "block",
        code: "unverified_price_range",
        message:
          pageRanges.length === 0
            ? `"${m[0]}" claims an installed price, but no verified price range exists yet for ${pagePath} (VERIFIED_FACTS.priceRanges).`
            : `"${m[0]}" doesn't match a verified price range for ${pagePath}.`,
      });
    }
  }

  return findings;
}

function blockFinding(field: LintFinding["field"], code: string, message: string): LintFinding {
  return { severity: "block", field, code, message };
}
function warn(field: LintFinding["field"], code: string, message: string): LintFinding {
  return { severity: "warn", field, code, message };
}

/* ── Main entry point ────────────────────────────────────────────────── */

export const MIN_TITLE_LENGTH = 10;

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

  // A title this short is a truncated/garbled generation (a 300-token cap once produced the title "P"), not a real title.
  if (title.trim() && title.trim().length < MIN_TITLE_LENGTH) {
    findings.push(blockFinding("title", "title_too_short", `Title is only ${title.trim().length} character(s) ("${title.trim()}") — it looks truncated (min ${MIN_TITLE_LENGTH}).`));
  }

  // Length limits
  if (title.length > 60) {
    findings.push(blockFinding("title", "title_too_long", `Title is ${title.length} characters (max 60).`));
  }
  if (meta.length > 155) {
    findings.push(blockFinding("metaDescription", "meta_too_long", `Meta description is ${meta.length} characters (max 155).`));
  }

  // Superlatives / unsupported claims ("guaranteed" only when asserted — see isGuaranteeAsserted)
  for (const phrase of SUPERLATIVES) {
    if (phrase === "guaranteed" ? isGuaranteeAsserted(combined) : includesPhrase(combined, phrase)) {
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

  // Warranty claim rules (docs/positioning-warranty-spec.md §2)
  for (const f of lintWarrantyClaims(combined, { allowedOnTermsPage: input.pagePath === "/warranty" })) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
  }

  // Differentiation add-on rules (docs/positioning-warranty-spec.md §9)
  for (const f of lintDifferentiationClaims(combined)) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
  }
  for (const f of lintDifferentiationFactClaims(combined, opts.differentiationFacts ?? UNCONFIGURED_DIFFERENTIATION_FACTS)) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
  }
  for (const f of lintNumericClaims(combined, opts.numericFacts ?? VERIFIED_FACTS)) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
  }
  for (const f of lintDollarRanges(combined, opts.priceRanges ?? [])) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
  }
  for (const f of lintRebateLeadingTitle(input.pagePath, title)) {
    findings.push({ severity: f.severity, field: "title", code: f.code, message: f.message });
  }
  for (const f of lintPriceRangeClaims(input.pagePath, combined, opts.priceRanges ?? [])) {
    findings.push({ severity: f.severity, field: "both", code: f.code, message: f.message });
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
  // "same-day" and "24/7" are BLOCK rules now (service_hours_*_unverified, in lintDifferentiationFactClaims) — they superseded the old WARNs here.
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
