/**
 * QuickBooks composite display-name parser (pure, unit-tested).
 *
 * Some QBO customers are entered with a composite DisplayName that packs the
 * project number, the real customer, the service address, and a floor/suite
 * note into a single pipe-delimited string, e.g.:
 *
 *   "PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I"
 *
 * Copying that whole string into the CRM contact name is the bug this module
 * fixes. `parseQboDisplayName` splits it into the pieces the CRM stores in
 * separate fields — but ONLY when the structure strongly signals a composite
 * project/customer name. A legitimate name (even one containing the letters
 * "PN", or one that happens to contain a pipe) is returned untouched with
 * `isComposite: false`, so the caller keeps using it verbatim.
 *
 * No I/O — deterministic given its input, so the whole surface is testable.
 */

/** A postal address parsed out of a composite name segment. Mirrors ContactAddress in estimates.ts. */
export interface ParsedAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface ParsedQboName {
  /** True only when the value confidently matches the composite PN/project pattern. */
  isComposite: boolean;
  /** Original string, always preserved for audit. */
  raw: string;
  /** Project code/name, e.g. "PN-173-B". Null when not composite. */
  projectReference: string | null;
  /** The real customer/contact/company name, e.g. "Marco Weber". Falls back to `raw` when not composite. */
  customerName: string;
  /** Structured service address parsed from the address segment, when present. */
  serviceAddress: ParsedAddress | null;
  /** Raw service-address text (unparsed), for display/audit. */
  serviceAddressText: string | null;
  /** Floor/suite/basement/unit note, e.g. "Basement I". */
  locationNotes: string | null;
  /**
   * Segmentation confidence. Only "high" is safe to auto-repair; "medium"/"low"
   * are manual-review. "n/a" for non-composite values.
   */
  confidence: "high" | "medium" | "low" | "n/a";
  /** Which composite format matched: pipe-delimited, space-delimited, or none. */
  format: "pipe" | "space" | "none";
}

/**
 * A segment is a project reference when it *starts* with a PN/project code:
 *   PN-173-B, PN#172, PN 173, PN173, Project 173, Proj-42, Job #5, WO-100.
 * The code must be an identifier token (letters then digits with optional
 * -/#/space separators) — not merely a word that contains "pn". Anchored at the
 * start and requires trailing digits so "Painters Inc" or "PNC Bank" never match.
 */
const PROJECT_PREFIX_RE = /^\s*(p\.?n|project|proj|job|wo|w\/o)\b[\s.#:\-]*\d+[a-z0-9\-]*\s*$/i;

/** Location-note keywords: basement, floor, suite, unit, apt, penthouse, room, etc. */
const LOCATION_NOTE_RE =
  /\b(basement|bsmt|floor|flr|fl|suite|ste|unit|apt|apartment|penthouse|ph|room|rm|rear|front|building|bldg|lobby|mezzanine|level|lvl)\b|^#\s*\w+/i;

/** US "CITY, ST ZIP" tail — used to recognize an address segment and to parse it. */
const STATE_ZIP_RE = /^([A-Za-z]{2})\.?(?:\s+(\d{5}(?:-\d{4})?))?$/;

/** A leading floor/suite descriptor embedded at the front of an address segment ("28th Floor 444 Madison Ave"). */
const LEADING_UNIT_RE =
  /^\s*((?:\d+(?:st|nd|rd|th)?\s+)?(?:floor|flr|fl|suite|ste|unit|apt|penthouse|ph|room|rm|level|lvl|basement|bsmt)\b\.?(?:\s*#?\s*[\w-]+)?)\s+(?=\d)/i;

const clean = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** Does this single segment look like a project code? */
export function isProjectSegment(segment: string): boolean {
  return PROJECT_PREFIX_RE.test(clean(segment));
}

/** Company-name signals used to decide whether a parsed customer name is an org vs a person. */
const COMPANY_SUFFIX_RE =
  /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|company|ltd|lp|llp|group|associates|partners|properties|property|management|realty|holdings|enterprises?|services|construction|contractors?|builders|development|capital|bank|trust|hoa|condominium|condo|apartments?)\b\.?/i;

/**
 * Heuristic: is this customer name an organization rather than a person?
 * Used so a company parsed from a composite name (e.g. "Cushman & Wakefield")
 * is stored in `companyName` instead of being split into first/last.
 */
export function looksLikeCompanyName(name: string | null | undefined): boolean {
  const s = clean(name);
  if (!s) return false;
  if (s.includes("&")) return true;
  return COMPANY_SUFFIX_RE.test(s);
}

// ── Space-delimited composite support (positional parsing) ───────────────────

/** Strongly anchored leading project code: PN-173-B, PN#172, PN 170, Project 88, Job #5, WO-100. */
const PROJECT_PREFIX_ANCHORED_RE = /^\s*((?:p\.?n|project|proj|job|wo|w\/o)[\s.#:\-]*\d+[a-z0-9\-]*)/i;

/** Street-type words used to confirm an address boundary near a numeric token. */
const STREET_SUFFIX_RE =
  /\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|ter|terrace|hwy|highway|pkwy|parkway|cir|circle|sq|square|route|rte|turnpike|tpke|plaza|walk|row)\b/i;

/** A leading floor/suite descriptor sitting right before the street number ("… 28th Floor 444 Main St"). */
const LEADING_UNIT_TAIL_RE =
  /\s+((?:\d+(?:st|nd|rd|th)\s+)?(?:floor|flr|suite|ste|unit|apt|apartment|penthouse|ph|room|rm|basement|bsmt|building|bldg|level|lvl|rear|front)\.?(?:\s*#?\s*[\w-]+)?)\s*$/i;

/** A trailing floor/suite descriptor after the address tail ("… NJ 07047 Basement I"). */
const TRAILING_UNIT_RE =
  /^((?:\d+(?:st|nd|rd|th)\s+)?(?:floor|flr|suite|ste|unit|apt|apartment|penthouse|ph|room|rm|basement|bsmt|building|bldg|level|lvl|rear|front)\.?(?:\s*#?\s*[\w-]+)?)$/i;

/** A name is plausible when it has a letter, isn't purely numeric, and is ≥2 chars. */
export function isPlausibleName(name: string | null | undefined): boolean {
  const s = clean(name);
  if (s.length < 2) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (/^\d+$/.test(s.replace(/\s/g, ""))) return false;
  return true;
}

/** Trim only separator punctuation/whitespace from the edges — keep &, ', -, ., suffixes. */
function trimSeparators(s: string): string {
  return s.replace(/^[\s,|:;–—-]+/, "").replace(/[\s,|:;–—-]+$/, "").trim();
}

/**
 * Find the first plausible street-address boundary in a token list: a street
 * number (`123`, `12a`) followed within 4 tokens by a street-suffix word. This
 * deliberately does NOT trigger on a number embedded in a name (no nearby
 * street word). Returns the token index, or -1.
 */
function findAddressBoundary(tokens: string[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[.,]+$/, "");
    if (!/^\d{1,6}[A-Za-z]?$/.test(t)) continue;
    const lookahead = tokens.slice(i + 1, i + 5).join(" ");
    if (STREET_SUFFIX_RE.test(lookahead)) return i;
  }
  return -1;
}

/** Does this single segment read as a floor/suite/basement/unit note (and NOT a full street address)? */
function isLocationNoteSegment(segment: string): boolean {
  const s = clean(segment);
  if (!s) return false;
  // A street address ("9005 Smith Ave, North Bergen, NJ 07047") is not a bare note.
  if (looksLikeAddress(s)) return false;
  return LOCATION_NOTE_RE.test(s);
}

/** Heuristic: does this segment look like a postal/street address? */
export function looksLikeAddress(segment: string): boolean {
  const s = clean(segment);
  if (!s) return false;
  const parts = s.split(",").map(p => p.trim());
  // A trailing "ST" or "ST ZIP" token is a strong address signal.
  if (parts.length >= 2 && STATE_ZIP_RE.test(parts[parts.length - 1])) return true;
  // Or a leading street number followed by words ("1600 Center Ave").
  if (/^\d+\s+\S+/.test(s) && /\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|ter|terrace|hwy|highway|pkwy|parkway)\b/i.test(s))
    return true;
  return false;
}

/**
 * Parse an address segment into structured parts. Splits on commas:
 * "<street...>, <city>, <ST ZIP>". Tolerant — any missing tail is left null and
 * whatever we cannot classify stays in line1.
 */
export function parseAddressSegment(segment: string): ParsedAddress | null {
  let s = clean(segment);
  if (!s) return null;

  // Pull a leading unit/floor descriptor out to keep line1 clean; the caller may
  // also surface it as a location note.
  const lead = s.match(LEADING_UNIT_RE);
  let leadingUnit: string | null = null;
  if (lead) {
    leadingUnit = clean(lead[1]);
    s = clean(s.slice(lead[0].length));
  }

  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  const addr: ParsedAddress = { line1: null, line2: leadingUnit, city: null, state: null, zip: null };
  if (!parts.length) return leadingUnit ? addr : null;

  // Trailing "ST" or "ST ZIP".
  const tail = parts[parts.length - 1];
  const m = tail.match(STATE_ZIP_RE);
  if (m && parts.length >= 2) {
    addr.state = m[1].toUpperCase();
    addr.zip = m[2] ?? null;
    parts.pop();
    if (parts.length) addr.city = parts.pop() ?? null;
  }
  addr.line1 = parts.join(", ") || null;
  return addr.line1 || addr.city || addr.zip || addr.line2 ? addr : null;
}

function notCompositeResult(original: string): ParsedQboName {
  return {
    isComposite: false,
    raw: original,
    projectReference: null,
    customerName: original,
    serviceAddress: null,
    serviceAddressText: null,
    locationNotes: null,
    confidence: "n/a",
    format: "none",
  };
}

/**
 * Parse a QBO display name into its composite parts, supporting BOTH:
 *   1. pipe-delimited  ("PN-173-B | Marco Weber | 9005 Smith Ave, … | Basement I")
 *   2. space-delimited ("PN-173-B Marco Weber 9005 Smith Ave, …  Basement I")
 * Conservative: a value with no pipe AND no strongly-anchored leading project
 * code is returned untouched (isComposite:false). Confidence gates auto-repair.
 */
export function parseQboDisplayName(raw: string | null | undefined): ParsedQboName {
  const original = (raw ?? "").trim();
  if (!original) return notCompositeResult(original);
  if (original.includes("|")) return parsePipeComposite(original);
  // Corrupted-pipe recovery: production data uses a standalone "I" (U+0049) where
  // a pipe was intended (the delimiter got mojibaked from "|" to "I"). Only apply
  // in composite context, and keep the ORIGINAL string for the audit `raw` field.
  const recovered = recoverCorruptedPipeDelimiter(original);
  if (recovered) return parsePipeComposite(recovered, original);
  return parseSpaceComposite(original);
}

/**
 * Recover a mojibaked pipe delimiter. Some QBO display names arrive with a
 * standalone " I " (space, capital I, space) acting as the segment delimiter
 * instead of " | ". We rewrite those delimiters to real pipes, but ONLY when the
 * string starts with an anchored project code (composite context) — so a plain
 * name with a middle initial is never touched. A trailing roman-numeral "I"
 * (e.g. "Basement I", no trailing space) is preserved, not treated as a delimiter.
 * Returns the rewritten string, or null when recovery does not apply.
 */
function recoverCorruptedPipeDelimiter(s: string): string | null {
  if (!PROJECT_PREFIX_ANCHORED_RE.test(s)) return null;
  if (!/\sI\s/.test(s)) return null; // no standalone-I delimiter present
  const rewritten = s.replace(/\sI\s/g, " | ");
  return rewritten.includes("|") ? rewritten : null;
}

/**
 * Pipe path (unchanged behavior): composite only when the FIRST pipe segment is
 * a project code and a second segment exists. Explicit delimiters → high confidence.
 * `rawOriginal` preserves the true source string for audit when the input was
 * delimiter-recovered.
 */
function parsePipeComposite(original: string, rawOriginal: string = original): ParsedQboName {
  const segments = original.split("|").map(s => clean(s)).filter(Boolean);
  if (segments.length < 2) return notCompositeResult(rawOriginal);
  if (!isProjectSegment(segments[0])) return notCompositeResult(rawOriginal);

  const projectReference = segments[0];
  const customerName = segments[1];
  if (!customerName) return notCompositeResult(rawOriginal);

  const rest = segments.slice(2);
  let serviceAddressText: string | null = null;
  const noteParts: string[] = [];
  for (const seg of rest) {
    if (looksLikeAddress(seg)) {
      if (serviceAddressText == null) serviceAddressText = seg;
      else noteParts.push(seg);
    } else {
      noteParts.push(seg);
    }
  }

  const serviceAddress = serviceAddressText ? parseAddressSegment(serviceAddressText) : null;
  if (serviceAddress?.line2) {
    noteParts.unshift(serviceAddress.line2);
    serviceAddress.line2 = null;
  }

  return {
    isComposite: true,
    raw: rawOriginal,
    projectReference,
    customerName,
    serviceAddress,
    serviceAddressText,
    locationNotes: noteParts.length ? Array.from(new Set(noteParts)).join(", ") : null,
    // Explicit delimiters are reliable, but "high" still requires a confident
    // address (consistent with the space path); a name-only composite is medium.
    confidence: !isPlausibleName(customerName) ? "low" : serviceAddress ? "high" : "medium",
    format: "pipe",
  };
}

/**
 * Space path (positional). Requires a strongly anchored leading project code,
 * then finds a conservative street-address boundary and derives name/address/notes.
 */
function parseSpaceComposite(original: string): ParsedQboName {
  const pm = original.match(PROJECT_PREFIX_ANCHORED_RE);
  if (!pm) return notCompositeResult(original); // no project prefix → never guess
  const projectReference = clean(pm[1]);
  const remainder = trimSeparators(original.slice(pm[0].length));

  const base: ParsedQboName = {
    isComposite: true,
    raw: original,
    projectReference,
    customerName: "",
    serviceAddress: null,
    serviceAddressText: null,
    locationNotes: null,
    confidence: "low",
    format: "space",
  };

  // Project-only (e.g. "PN-173-B"): nothing to segment — low, never name a contact "PN-…".
  if (!remainder) {
    base.customerName = ""; // no safe customer name
    base.confidence = "low";
    return base;
  }

  const tokens = remainder.split(/\s+/).filter(Boolean);
  const as = findAddressBoundary(tokens);

  if (as < 0) {
    // No confident address boundary. If the remainder is a short, clean name with
    // no street indicators, treat it all as the name (medium). Otherwise low.
    const hasStreetIsh = STREET_SUFFIX_RE.test(remainder) || /\d/.test(remainder);
    const name = trimSeparators(remainder);
    base.customerName = name;
    if (isPlausibleName(name) && !hasStreetIsh && tokens.length <= 5) base.confidence = "medium";
    else base.confidence = "low";
    return base;
  }

  // Split into [beforeAddr] [addrPlus].
  let beforeAddr = trimSeparators(tokens.slice(0, as).join(" "));
  const addrPlus = tokens.slice(as).join(" ");

  // A leading floor/suite descriptor sitting right before the street number is a note.
  const noteParts: string[] = [];
  const lead = beforeAddr.match(LEADING_UNIT_TAIL_RE);
  if (lead) {
    noteParts.push(clean(lead[1]));
    beforeAddr = trimSeparators(beforeAddr.slice(0, lead.index).trim());
  }
  const customerName = beforeAddr;

  // Address = up to the last ", ST[ ZIP]" tail; anything after is a trailing note.
  let serviceAddressText = addrPlus;
  let trailingText: string | null = null;
  const tail = addrPlus.match(/^(.*,\s*[A-Za-z]{2}\.?(?:\s+\d{5}(?:-\d{4})?)?)(?:\s+(.+))?$/);
  let hasStateTail = false;
  if (tail) {
    serviceAddressText = clean(tail[1]);
    trailingText = tail[2] ? clean(tail[2]) : null;
    hasStateTail = true;
  }

  let trailingAmbiguous = false;
  if (trailingText) {
    if (TRAILING_UNIT_RE.test(trailingText) || LOCATION_NOTE_RE.test(trailingText)) {
      noteParts.push(trailingText);
    } else {
      // Uncertain trailing text: keep it with the address, flag the record.
      serviceAddressText = clean(`${serviceAddressText} ${trailingText}`);
      trailingAmbiguous = true;
    }
  }

  const serviceAddress = parseAddressSegment(serviceAddressText);
  if (serviceAddress?.line2) {
    noteParts.unshift(serviceAddress.line2);
    serviceAddress.line2 = null;
  }

  // Confidence.
  const namePlausible = isPlausibleName(customerName);
  let confidence: ParsedQboName["confidence"];
  if (!namePlausible) confidence = "low";
  else if (hasStateTail && !trailingAmbiguous) confidence = "high";
  else confidence = "medium"; // address found but no state tail, or ambiguous trailing text

  return {
    ...base,
    customerName,
    serviceAddress,
    serviceAddressText,
    locationNotes: noteParts.length ? Array.from(new Set(noteParts)).join(", ") : null,
    confidence,
  };
}
