/**
 * Display-only name / company / address formatter.
 *
 * PRESENTATION LAYER ONLY. These functions decide how a stored value is RENDERED;
 * they must NEVER be written back to the database. Stored customer/contact/company
 * fields are the source of truth and stay exactly as QuickBooks / the user entered
 * them.
 *
 * Formatting policy (conservative — "normalize the shouty, preserve the rest"):
 *   1. A word that is ENTIRELY uppercase letters is normalized to Title Case
 *      (only its first letter kept capitalized): "ANA" → "Ana".
 *   2. A word that already contains intentional mixed capitalization is PRESERVED
 *      verbatim: "McDonald", "O'Brien", "LaSalle", "iPhone" are left untouched.
 *   3. A word that is entirely lowercase is normalized to Title Case
 *      ("ana" → "Ana", "acme" → "Acme"), EXCEPT recognized lowercase name
 *      particles ("de", "la", "van", "der", …) which stay lowercase, so
 *      "de la Cruz" → "de la Cruz". We never lowercase-then-recapitalize a
 *      mixed-case word, so intentional casing (rule 2) is safe.
 *   4. A word containing a digit is PRESERVED: ZIP "07666", unit "2B", house "21".
 *   5. A word in the acronym / suffix / address whitelist maps to its canonical
 *      form regardless of input case: "llc"/"LLC" → "LLC", "st"/"ST" → "St".
 *   6. Emails, URLs, and phone-shaped strings are returned byte-for-byte unchanged.
 *      Identifiers that contain a digit (QuickBooks ids "QB-1", "E1", "PN#165")
 *      are preserved by rule 4.
 *
 * ── Context-aware address handling ─────────────────────────────────────────────
 * The 2-letter token "CT" is ambiguous: Connecticut (state) vs Court (street
 * suffix). We do NOT blindly title-case it. `formatAddress` resolves it by
 * POSITION: a USPS state code sitting in the "state slot" (immediately before a
 * trailing ZIP, or as the final token of a "City ST" fragment) is preserved
 * uppercase as a state; anywhere else "CT" falls through to the street-suffix
 * reading "Ct". A dedicated state FIELD should be rendered with `formatStateCode`.
 * All 50 states + DC are recognized. Because state codes collide with common
 * lowercase words ("IN"/"in", "OR"/"or", "ME"/"me", "DE"/"de"), they are NOT in
 * the unconditional whitelist — they are only honored in an address state slot,
 * so the word "in" is never turned into "IN".
 */

/**
 * Canonical display form keyed by the UPPERCASED source token. Membership here
 * means "never title-case this blindly — render exactly this string." State codes
 * are deliberately EXCLUDED (handled positionally in addresses; see above).
 */
const WHITELIST: Record<string, string> = {
  // ── Legal / business entity suffixes & forms ───────────────────────────────
  LLC: "LLC",
  LLP: "LLP",
  LP: "LP",
  PLLC: "PLLC",
  PC: "PC",
  INC: "Inc",
  CORP: "Corp",
  LTD: "Ltd",
  DBA: "DBA",
  // NOTE: "CO" (Company) is intentionally NOT whitelisted — it collides with the
  // state code Colorado. Title-casing already yields "Co" for company use, and
  // `formatAddress` renders "CO" as the state when it sits in the state slot.

  // ── Trades / industry acronyms ─────────────────────────────────────────────
  HVAC: "HVAC",
  HVACR: "HVACR",
  AC: "AC",
  PDC: "PDC",

  // ── Country / general ──────────────────────────────────────────────────────
  USA: "USA",
  US: "US",
  PO: "PO", // as in "PO Box"

  // ── Directional abbreviations (stay uppercase) ─────────────────────────────
  N: "N", S: "S", E: "E", W: "W", NE: "NE", NW: "NW", SE: "SE", SW: "SW",

  // ── Street-type abbreviations (Title Case) ─────────────────────────────────
  // "CT" (Court) is intentionally omitted — resolved positionally so it can also
  // read as the state Connecticut. Title-casing yields "Ct" for the street use.
  ST: "St", AVE: "Ave", BLVD: "Blvd", RD: "Rd", DR: "Dr",
  PL: "Pl", PKWY: "Pkwy", TER: "Ter", TERR: "Terr", CIR: "Cir", LN: "Ln",
  WAY: "Way", HWY: "Hwy", SQ: "Sq", PLZ: "Plz", TRL: "Trl", XING: "Xing",

  // ── Unit / secondary-address identifiers (Title Case) ──────────────────────
  STE: "Ste", APT: "Apt", UNIT: "Unit", BLDG: "Bldg", RM: "Rm", DEPT: "Dept",
  SPC: "Spc", LOT: "Lot", TRLR: "Trlr", FLR: "Flr", PH: "Ph",
};

/** All 50 USPS state codes + DC. Honored positionally in addresses only. */
const STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "IA", "ID",
  "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT",
  "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY", "DC",
]);

/**
 * State codes that ALSO function as a street suffix, so they can NOT be treated
 * as a state purely because they end a fragment. Only resolved to a state when a
 * trailing ZIP disambiguates. ("CT" = Court / Connecticut.)
 */
const STATE_STREET_COLLISION = new Set(["CT"]);

/**
 * Recognized lowercase name particles (nobiliary / patronymic connectors). When
 * one of these appears ALL-lowercase in the source, it is kept lowercase instead
 * of being title-cased, so "de la Cruz" and "van der Berg" render naturally. This
 * only affects tokens that are already lowercase; an all-caps "DE" still normalizes.
 */
const PARTICLES = new Set([
  "de", "del", "dela", "della", "der", "den", "di", "da", "do", "dos", "das",
  "du", "des", "la", "le", "el", "los", "las", "van", "von", "vander", "ten",
  "ter", "y", "e", "af", "av", "bin", "ibn",
]);

// Latin-1 aware letter ranges (ES5-safe: no \p{} / no `u` flag needed), so
// accented names like "JOSÉ" normalize and "José" is preserved.
const UPPER = "A-ZÀ-ÖØ-Þ";
const LOWER = "a-zà-öø-ÿ";
const ALNUM = "A-Za-z0-9À-ÖØ-öø-ÿ";
const RE_PEEL = new RegExp("^([^" + ALNUM + "]*)([\\s\\S]*?)([^" + ALNUM + "]*)$");
const RE_ALL_CAPS = new RegExp("^[" + UPPER + "][" + UPPER + "'’./\\\\-]*$");
const RE_ALL_LOWER = new RegExp("^[" + LOWER + "][" + LOWER + "'’./\\\\-]*$");
const RE_TITLE = new RegExp("(^|[\\s'’./\\\\-])([" + LOWER + "])", "g");
const RE_ZIP = /^\d{5}(-\d{4})?$/;

/** A string that must not be reformatted at all (email, URL, or phone-shaped). */
function isOpaque(value: string): boolean {
  const v = value.trim();
  if (v.includes("@")) return true; // email address
  if (/^(https?:\/\/|www\.)/i.test(v) || /:\/\//.test(v)) return true; // URL
  // phone-shaped: digits with only phone punctuation, at least 7 digits.
  if (/^[+()\d\s.\-xext]+$/i.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7) return true;
  return false;
}

/** Title-case a word, respecting internal separators (' ’ - . /). Works for
 *  both all-caps and all-lowercase input ("ANA"/"ana" → "Ana"). */
function titleCaseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(RE_TITLE, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The alphanumeric core of a token, stripped of surrounding punctuation. */
function coreOf(token: string): string {
  const m = token.match(RE_PEEL);
  return m && m[2] ? m[2] : token;
}

/** Format one whitespace-delimited token (may carry leading/trailing punctuation). */
function formatToken(token: string): string {
  if (!token) return token;
  if (token.includes("@")) return token; // never touch an email token

  // Peel leading/trailing punctuation so "Inc.", "(LLC)", "St," match cleanly.
  const m = token.match(RE_PEEL);
  if (!m || !m[2]) return token;
  const [, lead, core, trail] = m;

  const upper = core.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(WHITELIST, upper)) {
    return lead + WHITELIST[upper] + trail;
  }
  if (/\d/.test(core)) return lead + core + trail; // ZIP / 2B / house numbers / ids
  // Entirely uppercase letters (allowing internal ' ’ - . /) → Title Case.
  if (RE_ALL_CAPS.test(core)) return lead + titleCaseWord(core) + trail;
  // Entirely lowercase → Title Case, unless it is a recognized name particle.
  if (RE_ALL_LOWER.test(core)) {
    if (PARTICLES.has(core)) return lead + core + trail;
    return lead + titleCaseWord(core) + trail;
  }
  // Intentional mixed capitalization → preserve verbatim.
  return lead + core + trail;
}

/** Core engine: format every token while preserving original whitespace. */
function formatDisplayString(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (!str.trim()) return str;
  if (isOpaque(str)) return str;
  return str
    .split(/(\s+)/) // keep the separators so spacing is preserved exactly
    .map((part) => (/^\s+$/.test(part) ? part : formatToken(part)))
    .join("");
}

/**
 * Format a person's display name (first/last/full) for rendering.
 * "ANA HAYNES" → "Ana Haynes"; "McDonald" → "McDonald".
 */
export function formatDisplayName(name: string | null | undefined): string {
  return formatDisplayString(name);
}

/**
 * Format a company / business name for rendering, preserving entity suffixes.
 * "55 WEST 21 STREET LLC" → "55 West 21 Street LLC"; "PDC LLC" → "PDC LLC".
 */
export function formatCompanyName(name: string | null | undefined): string {
  return formatDisplayString(name);
}

/**
 * Format a US state field. A recognized USPS code is preserved uppercase
 * ("ct"/"CT" → "CT"); anything else is title-cased ("new jersey" stays as typed).
 */
export function formatStateCode(state: string | null | undefined): string {
  if (state == null) return "";
  const str = String(state);
  if (!str.trim()) return str;
  const m = str.match(RE_PEEL);
  if (!m || !m[2]) return str;
  const upper = m[2].toUpperCase();
  if (STATES.has(upper)) return m[1] + upper + m[3];
  return formatDisplayString(str); // spelled-out state name → Title Case
}

/**
 * Format a single-line address for rendering. Preserves directional / street /
 * unit abbreviations and ZIPs, and resolves an ambiguous state code by POSITION:
 * "45 N BROAD ST STE 201" → "45 N Broad St Ste 201";
 * "STAMFORD CT 06901"     → "Stamford CT 06901"  (CT = state, before the ZIP);
 * "12 MAPLE CT"           → "12 Maple Ct"        (CT = Court, no state slot).
 */
export function formatAddress(address: string | null | undefined): string {
  if (address == null) return "";
  const str = String(address);
  if (!str.trim()) return str;
  if (isOpaque(str)) return str;

  const parts = str.split(/(\s+)/);
  const wordIdx: number[] = [];
  parts.forEach((p, i) => {
    if (!/^\s*$/.test(p)) wordIdx.push(i);
  });

  // Locate a trailing ZIP among the word tokens.
  let zipPos = -1; // index into wordIdx
  for (let k = 0; k < wordIdx.length; k++) {
    if (RE_ZIP.test(coreOf(parts[wordIdx[k]]))) {
      zipPos = k;
      break;
    }
  }

  // Determine which word token (if any) is the STATE.
  let stateK = -1; // index into wordIdx
  if (zipPos >= 1) {
    // The token immediately before the ZIP, if it is a USPS code, is the state.
    const c = coreOf(parts[wordIdx[zipPos - 1]]).toUpperCase();
    if (STATES.has(c)) stateK = zipPos - 1;
  } else if (zipPos === -1 && wordIdx.length >= 1) {
    // No ZIP: the final token may be a "City ST" state — but a state that also
    // reads as a street suffix (CT) stays a street suffix without a ZIP to prove it.
    const lastK = wordIdx.length - 1;
    const c = coreOf(parts[wordIdx[lastK]]).toUpperCase();
    if (STATES.has(c) && !STATE_STREET_COLLISION.has(c)) stateK = lastK;
  }

  return parts
    .map((p, i) => {
      if (/^\s*$/.test(p)) return p;
      if (wordIdx[stateK] === i) {
        // Force the USPS state code uppercase, preserving any attached punctuation.
        const m = p.match(RE_PEEL);
        if (!m || !m[2]) return p;
        return m[1] + m[2].toUpperCase() + m[3];
      }
      return formatToken(p);
    })
    .join("");
}

/**
 * Join and format a multi-field address. Falsy/blank parts are dropped; each
 * remaining part is formatted with `formatAddress`, then joined with `separator`.
 * (Pass a dedicated state field through `formatStateCode` before this if it may
 * be the ambiguous "CT".)
 */
export function formatAddressParts(
  parts: Array<string | null | undefined>,
  separator = ", ",
): string {
  return parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter((p) => p.length > 0)
    .map((p) => formatAddress(p))
    .join(separator);
}
