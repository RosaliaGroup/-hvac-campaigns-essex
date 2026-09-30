/**
 * Verified numeric claims — the fact firewall's rule for counts about the
 * BUSINESS: how many counties we serve, how many years we've been at it, how
 * many customers, how many projects. The model is never the source of a number
 * (shared/verifiedFacts.ts); a draft that states one must state a number that
 * EXISTS in VERIFIED_FACTS, exactly, or it BLOCKs.
 *
 *   counties  -> business.serviceCounties.length   (9: the counties with a real city page)
 *   years     -> business.yearsInBusiness          (20: team experience)
 *   customers -> business.customersServed          (null until the owner supplies it)
 *   projects  -> business.projectsCompleted        (null until the owner supplies it)
 *
 * Why this exists: site copy elsewhere says "15 counties" while only 9 are
 * backed by structural content (see the note on serviceCounties), and drafts
 * can just as easily invent "500+ customers" or "1,000 projects". Verified
 * means the number itself matches — "20+ years" and "over 20 years" both
 * carry 20, which matches; "25 years" does not.
 *
 * Deliberately NOT flagged (they're not counts about the business, and other
 * rules own them): warranty terms ("10-year parts & labor" — warranty rules),
 * equipment age or lifespan ("systems over 10 years old", "lasts 15 years"),
 * failure windows ("years 5-8"), dollar amounts (dollar rules), and a bare
 * "one"/"1" (singular use: "one installation", "1 county").
 *
 * Pure and dependency-light on purpose: shared/ is the lowest layer, so this
 * takes plain numbers, not the VerifiedFacts object.
 */

export type NumericFacts = {
  /** Count of verified service counties. */
  serviceCounties: number | null;
  yearsInBusiness: number | null;
  customersServed: number | null;
  projectsCompleted: number | null;
};

export type NumericClaimFinding = {
  severity: "block";
  code: "unverified_county_count" | "unverified_years_claim" | "unverified_customer_count" | "unverified_project_count";
  message: string;
  /** The exact matched phrase. */
  claim: string;
};

/** Map the facts file onto the four verifiable numbers. Structural type so shared/verifiedFacts stays the only place that defines the shape. */
export function numericFactsFrom(facts: {
  business: { serviceCounties: readonly string[]; yearsInBusiness: number; customersServed?: number | null; projectsCompleted?: number | null };
}): NumericFacts {
  return {
    serviceCounties: facts.business.serviceCounties.length,
    yearsInBusiness: facts.business.yearsInBusiness,
    customersServed: facts.business.customersServed ?? null,
    projectsCompleted: facts.business.projectsCompleted ?? null,
  };
}

/* ── Number parsing ─────────────────────────────────────────────────────── */

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const WORD_NUM = `(?:(?:${Object.keys(TENS).join("|")})(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?|${Object.keys(UNITS).join("|")}|hundred|dozen)`;
/** Not a count when it is a dollar amount ("$16K HVAC installation") or the tail of a longer number ("1,200" must not also match as "200"). */
const NOT_MONEY_OR_TAIL = "(?<!\\$\\s?)(?<![\\d.,])";
/** digits with optional thousands commas / decimals / trailing K, or a spelled-out number. */
const NUM = `(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?\\s?[kK]?|${WORD_NUM})`;

/** Parse a matched number token; null if it can't be read (treated as unclaimable, never as verified). */
export function parseNumberToken(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (/^\d/.test(t)) {
    const k = /k$/.test(t);
    const n = Number(t.replace(/[,\s]|k$/g, ""));
    return Number.isFinite(n) ? (k ? n * 1000 : n) : null;
  }
  if (t === "dozen") return 12;
  if (t === "hundred") return 100;
  const [head, tail] = t.split(/[-\s]/);
  if (head in TENS) return TENS[head] + (tail ? (UNITS[tail] ?? 0) : 0);
  if (head in UNITS) return UNITS[head];
  return null;
}

/* ── Claim patterns ─────────────────────────────────────────────────────── */

const COUNT_ADJ = "(?:(?:nj|new\\s+jersey|northern|north\\s+jersey|surrounding|neighboring)\\s+)*";
const COUNTIES = new RegExp(`${NOT_MONEY_OR_TAIL}\\b(${NUM})\\s*\\+?[-\\s]*${COUNT_ADJ}count(?:y|ies)\\b`, "gi");

// Years of business/experience only. Three shapes:
//   "20 years of (combined/team…) experience|in business|serving…"
//   "serving/in business … for (over) 20 years"
//   "experience/in business: (over) 20 years"
const EXP_MODS = "(?:(?:combined|team|hands-on|industry|professional|proven|local|nj)\\s+)*";
const YEARS_A = new RegExp(
  `${NOT_MONEY_OR_TAIL}\\b(${NUM})\\s*\\+?\\s*(?:years?|yrs?)\\s+(?:of\\s+|in\\s+)?${EXP_MODS}(?:experience|expertise|business|the\\s+(?:hvac\\s+)?industry|hvac|serving|service)\\b`,
  "gi",
);
const YEARS_B = new RegExp(
  `\\b(?:serving|serve[sd]?|in\\s+business)\\b[^.]{0,40}?\\bfor\\s+(?:over\\s+|more\\s+than\\s+|nearly\\s+|almost\\s+|about\\s+)?(${NUM})\\s*\\+?\\s*(?:years?|yrs?)\\b`,
  "gi",
);
const YEARS_C = new RegExp(`\\b(?:experience|in\\s+business)\\b\\s*(?:of|:|-|—)\\s*(?:over\\s+|more\\s+than\\s+)?(${NUM})\\s*\\+?\\s*(?:years?|yrs?)\\b`, "gi");

const PEOPLE = "(?:customers?|clients?|homeowners?|families|households|property\\s+managers?|building\\s+owners?)";
const WORK = "(?:projects?|installations?|installs?|jobs)";
const ADJ = "(?:(?:happy|satisfied|local|nj|repeat|new|residential|commercial|completed|successful|finished|hvac|installation)\\s+)*";
// Not a count of OUR customers/projects when it is a rate or a share: "1 in 3 homeowners", "every 3 homeowners", "2 of 5 families".
const NOT_RATE = "(?<!\\b(?:in|of|per|every|each|out\\s+of)\\s)";
const CUSTOMERS = new RegExp(`${NOT_RATE}${NOT_MONEY_OR_TAIL}\\b(${NUM})\\s*\\+?\\s*${ADJ}${PEOPLE}\\b`, "gi");
const PROJECTS = new RegExp(`${NOT_RATE}${NOT_MONEY_OR_TAIL}\\b(${NUM})\\s*\\+?\\s*${ADJ}${WORK}\\b`, "gi");

// "hundreds of customers", "thousands of projects" — a magnitude with no number to verify.
const VAGUE = new RegExp(`\\b(hundreds|thousands|dozens|scores)\\s+of\\s+${ADJ}(${PEOPLE}|${WORK})\\b`, "gi");

type Category = "counties" | "years" | "customers" | "projects";

const CODE: Record<Category, NumericClaimFinding["code"]> = {
  counties: "unverified_county_count",
  years: "unverified_years_claim",
  customers: "unverified_customer_count",
  projects: "unverified_project_count",
};

const LABEL: Record<Category, string> = {
  counties: "a county-count claim",
  years: "a years-in-business claim",
  customers: "a customer-count claim",
  projects: "a project-count claim",
};

const FACT_NAME: Record<Category, string> = {
  counties: "business.serviceCounties",
  years: "business.yearsInBusiness",
  customers: "business.customersServed",
  projects: "business.projectsCompleted",
};

function verifiedValue(nf: NumericFacts, c: Category): number | null {
  return c === "counties" ? nf.serviceCounties : c === "years" ? nf.yearsInBusiness : c === "customers" ? nf.customersServed : nf.projectsCompleted;
}

function categoryOfNoun(noun: string): Category {
  return /^(customer|client|homeowner|famil|household|property|building)/i.test(noun.trim()) ? "customers" : "projects";
}

function scan(text: string, re: RegExp, category: Category, nf: NumericFacts, out: NumericClaimFinding[], seen: Set<string>): void {
  re.lastIndex = 0;
  for (const m of Array.from(text.matchAll(re))) {
    const n = parseNumberToken(m[1]);
    if (n === null || n <= 1) continue; // unreadable, or singular use ("one installation")
    if (/^\d{4}$/.test(m[1].trim()) && n >= 2015 && n <= 2035) continue; // a calendar year in a title ("2026 Homeowner's Guide"), not a count
    const claim = m[0].trim();
    const key = `${category}|${claim.toLowerCase()}`;
    if (seen.has(key)) continue;
    const verified = verifiedValue(nf, category);
    if (verified !== null && n === verified) continue;
    seen.add(key);
    out.push({
      severity: "block",
      code: CODE[category],
      claim,
      message:
        verified === null
          ? `"${claim}" is ${LABEL[category]}, but no such figure has been verified (VERIFIED_FACTS.${FACT_NAME[category]} is unset). Remove the number.`
          : `"${claim}" is ${LABEL[category]} that doesn't match VERIFIED_FACTS.${FACT_NAME[category]} (${verified}). Use ${verified} or remove the number.`,
    });
  }
}

/**
 * Block every numeric claim about counties / years in business / customers /
 * projects whose number isn't the verified figure. Runs on any text (title +
 * meta for the meta lane, the body for the content lane).
 */
export function lintNumericClaims(text: string, nf: NumericFacts): NumericClaimFinding[] {
  const out: NumericClaimFinding[] = [];
  const seen = new Set<string>();
  scan(text, COUNTIES, "counties", nf, out, seen);
  for (const re of [YEARS_A, YEARS_B, YEARS_C]) scan(text, re, "years", nf, out, seen);
  scan(text, CUSTOMERS, "customers", nf, out, seen);
  scan(text, PROJECTS, "projects", nf, out, seen);

  VAGUE.lastIndex = 0;
  for (const m of Array.from(text.matchAll(VAGUE))) {
    const category = categoryOfNoun(m[2]);
    const claim = m[0].trim();
    const key = `${category}|${claim.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      severity: "block",
      code: CODE[category],
      claim,
      message: `"${claim}" is ${LABEL[category]} with no number to verify (VERIFIED_FACTS.${FACT_NAME[category]} ${verifiedValue(nf, category) === null ? "is unset" : `is ${verifiedValue(nf, category)}`}). Remove it or state the verified figure.`,
    });
  }
  return out;
}
