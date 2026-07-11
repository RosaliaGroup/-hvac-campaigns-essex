/**
 * Parser for the composite QuickBooks customer DisplayName pattern used by this
 * shop, e.g.:
 *   "PN#132 I PDC I 828 Summer Ave Newark NJ"
 *   "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I"
 *
 * In QuickBooks the operator types "project code I customer I service address I
 * location" into a single Customer DisplayName, using a bare capital "I" as a
 * visual pipe. That composite gets copied verbatim into `customers.displayName`
 * and naively split into firstName/lastName, producing garbage CRM names.
 *
 * This module is PURE and DETERMINISTIC. It never mutates anything. It only
 * classifies a raw DisplayName and, when the string unambiguously matches the
 * confirmed production composite structure, proposes the decomposed parts with
 * an explicit confidence + reason codes. Anything ambiguous stays `low`/`medium`
 * and must NOT be auto-repaired by callers.
 *
 * SAFETY BIAS: prefer skipping. A legitimate person/company name — even one with
 * dashes, colons, ampersands, digits, or address-like words — must return
 * `isComposite: false` unless the WHOLE string matches the composite structure
 * (project-code segment + " I " delimiters).
 */

export type CustomerKind = "person" | "company" | "unknown";
export type Confidence = "high" | "medium" | "low";

/**
 * Parser version — recorded in the repair audit log and re-checked at apply
 * time so a manifest reviewed against one parser version cannot be applied by a
 * later, behaviourally-different parser. Bump on any rule change.
 */
export const QBO_COMPOSITE_PARSER_VERSION = "1.0.0";

export interface ParsedQboCompositeName {
  isComposite: boolean;
  confidence: Confidence;
  reasonCodes: string[];

  parserVersion: string;
  rawDisplayName: string;
  /** QBO Customer.FullyQualifiedName, preserved verbatim when supplied. */
  rawFullyQualifiedName: string | null;

  projectReference: string | null;
  projectNumber: string | null;
  projectName: string | null;

  customerDisplayName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  customerKind: CustomerKind;

  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;

  locationNotes: string | null;
}

/**
 * The confirmed delimiter: a bare capital "I" preceded by whitespace and
 * followed by whitespace OR end-of-string (so a trailing " I" also splits,
 * yielding a trailing empty segment we can detect).
 */
const DELIM = /\s+I(?=\s|$)/g;

/** Project-code segment: "PN" then optional #/-/space, digits, optional suffix. */
const PROJECT_CODE = /^PN\s*[#-]?\s*\d+[A-Za-z0-9-]*$/;

/** Strong company markers (suffixes / entity words). */
const COMPANY_MARKERS =
  /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|corp|corp\.|corporation|ltd|llp|pllc|plc|co\.|company|group|holdings|enterprises?|industries|associates|partners|properties|realty|management|developers?|development|construction|contractors?|services?|hotel|motel|restaurant|menswear|motors|mechanical|hvac|systems|solutions|capital|ventures|university|hospital|school|church)\b/i;

/** US state codes (subset relevant to this NJ/NY shop, plus common neighbors). */
const STATE_CODES = new Set(["NJ", "NY", "PA", "CT", "DE", "MD", "MA", "RI", "VA", "FL", "CA", "TX"]);

/** Location keywords that belong in locationNotes, never in the customer name. */
const LOCATION_WORDS =
  /\b(basement|cellar|attic|rooftop|roof|penthouse|ph|mezzanine|lobby|rear|front|side|garage|mechanical\s*room|boiler\s*room|utility\s*room|floor|fl\.?|suite|ste\.?|unit|apt\.?|apartment|#\s*\d+|\d+(?:st|nd|rd|th)\s+floor)\b/i;

function titleTrim(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

/** Classify a customer segment as person / company / unknown. */
export function classifyCustomerSegment(seg: string): { kind: CustomerKind; reason: string } {
  const s = seg.trim();
  if (!s) return { kind: "unknown", reason: "CUSTOMER_EMPTY" };
  if (s.includes("&") || COMPANY_MARKERS.test(s)) return { kind: "company", reason: "CUSTOMER_COMPANY_MARKER" };
  const tokens = s.split(/\s+/);
  // Single all-caps short token (e.g. "PDC") — could be a company acronym OR a
  // person's initials. Ambiguous on purpose → caller must not auto-repair.
  if (tokens.length === 1) {
    if (/^[A-Z]{2,5}$/.test(s)) return { kind: "unknown", reason: "CUSTOMER_AMBIGUOUS_ACRONYM" };
    return { kind: "unknown", reason: "CUSTOMER_SINGLE_TOKEN" };
  }
  // 2–4 alphabetic tokens (allowing a middle initial like "L" / "L.") → person.
  const alphaish = tokens.every(t => /^[A-Za-z][A-Za-z.'-]*$/.test(t));
  if (alphaish && tokens.length >= 2 && tokens.length <= 4) {
    return { kind: "person", reason: "CUSTOMER_PERSON_NAME" };
  }
  return { kind: "unknown", reason: "CUSTOMER_UNCLASSIFIED" };
}

/**
 * Split a person segment into first/last, keeping any middle token with the
 * first name so buildDisplayName round-trips to the original. Preserves the
 * original casing (we never invent capitalization).
 */
export function splitPersonName(seg: string): { firstName: string; lastName: string } {
  const tokens = seg.trim().split(/\s+/);
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
  return { firstName: tokens.slice(0, -1).join(" "), lastName: tokens[tokens.length - 1] };
}

/**
 * Parse a service-address segment into line1/line2/city/state/zip + any leading
 * location detail. Returns confidence separately (address parsing is fuzzier
 * than name parsing).
 */
export function parseServiceAddress(seg: string): {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  locationNote: string | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  let work = seg.trim();
  let locationNote: string | null = null;

  // Leading location detail like "28th Floor 444 Madison Avenue" → pull "28th Floor".
  const leadFloor = work.match(/^((?:\d+(?:st|nd|rd|th)\s+floor|floor\s+\d+|basement|rooftop|penthouse|ph)\b)\s+(.*)$/i);
  if (leadFloor && /^\d/.test(leadFloor[2])) {
    locationNote = leadFloor[1].trim();
    work = leadFloor[2].trim();
    reasons.push("LOCATION_IN_ADDRESS");
  }

  let zip: string | null = null;
  const zipM = work.match(/\b(\d{5})(?:-\d{4})?\b\s*$/);
  if (zipM) {
    zip = zipM[1];
    work = work.slice(0, zipM.index).trim().replace(/[, ]+$/, "");
    reasons.push("ZIP_FOUND");
  }

  let state: string | null = null;
  const stateM = work.match(/[,\s]([A-Za-z]{2})\s*$/);
  if (stateM && STATE_CODES.has(stateM[1].toUpperCase())) {
    state = stateM[1].toUpperCase();
    work = work.slice(0, stateM.index).trim().replace(/[, ]+$/, "");
    reasons.push("STATE_FOUND");
  }

  // City: the segment after the last comma is usually the city.
  let city: string | null = null;
  let line1: string | null = null;
  let line2: string | null = null;
  const UNIT = /^(suite|ste\.?|unit|apt\.?|apartment|#)\b/i;
  if (work.includes(",")) {
    const parts = work.split(",").map(p => p.trim()).filter(Boolean);
    line1 = parts[0] || null;
    // A formal postal unit (Suite/Ste/Unit/Apt/#) becomes address line 2.
    const rest = parts.slice(1);
    const unitIdx = rest.findIndex(p => UNIT.test(p));
    if (unitIdx >= 0) {
      line2 = rest[unitIdx];
      reasons.push("UNIT_AS_LINE2");
    }
    const cityParts = rest.filter((_, i) => i !== unitIdx);
    city = cityParts.length ? cityParts.join(", ") : null;
    reasons.push("ADDRESS_COMMA_DELIMITED");
  } else {
    // No comma: hard to split street from city reliably. Keep whole as line1;
    // guess the last token as city only when it is clearly non-numeric.
    line1 = work || null;
    reasons.push("ADDRESS_NO_COMMA");
  }
  if (line1 && /^\d+[A-Za-z]?\b/.test(line1)) reasons.push("ADDRESS_STREET_NUMBER");
  else reasons.push("ADDRESS_NO_STREET_NUMBER");

  return { line1: titleTrim(line1), line2, city: titleTrim(city), state, zip, locationNote, reasons };
}

const EMPTY = (raw: string, fqn: string | null = null): ParsedQboCompositeName => ({
  isComposite: false,
  confidence: "low",
  reasonCodes: ["NOT_COMPOSITE"],
  parserVersion: QBO_COMPOSITE_PARSER_VERSION,
  rawDisplayName: raw,
  rawFullyQualifiedName: fqn,
  projectReference: null,
  projectNumber: null,
  projectName: null,
  customerDisplayName: null,
  firstName: null,
  lastName: null,
  companyName: null,
  customerKind: "unknown",
  serviceAddressLine1: null,
  serviceAddressLine2: null,
  serviceCity: null,
  serviceState: null,
  servicePostalCode: null,
  locationNotes: null,
});

/**
 * Parse a raw QBO DisplayName. Returns `isComposite:false` for any string that
 * does not match the confirmed structure (project-code segment + ≥2 " I "
 * delimiters). Only `confidence: "high"` results are safe to auto-repair.
 */
export function parseQboCompositeName(
  raw: string | null | undefined,
  fullyQualifiedName?: string | null,
): ParsedQboCompositeName {
  const input = (raw ?? "").trim();
  const fqn = (fullyQualifiedName ?? "").trim() || null;
  if (!input) return EMPTY(input, fqn);

  // Split on the " I " delimiter; keep track of trailing-empty segments.
  const rawSegments = input.split(DELIM).map(s => s.trim());
  const hadTrailingEmpty = rawSegments.length > 0 && rawSegments[rawSegments.length - 1] === "";
  const segments = rawSegments.filter(Boolean);

  // Positive-match gate: need the project-code anchor AND ≥3 segments.
  if (segments.length < 3 || !PROJECT_CODE.test(segments[0])) {
    return EMPTY(input, fqn);
  }

  const reasonCodes: string[] = ["PROJECT_CODE_MATCH", "DELIM_I"];
  if (hadTrailingEmpty) reasonCodes.push("TRAILING_EMPTY_SEGMENT");

  const projectReference = segments[0];
  const numM = projectReference.match(/\d+[A-Za-z0-9-]*/);
  const projectNumber = numM ? numM[0] : null;

  const customerSeg = segments[1];
  const addressSeg = segments[2];
  const extraSegs = segments.slice(3); // trailing location details

  // Customer classification.
  const { kind, reason } = classifyCustomerSegment(customerSeg);
  reasonCodes.push(reason);
  let firstName: string | null = null;
  let lastName: string | null = null;
  let companyName: string | null = null;
  if (kind === "person") {
    const { firstName: f, lastName: l } = splitPersonName(customerSeg);
    firstName = titleTrim(f);
    lastName = titleTrim(l);
  } else if (kind === "company") {
    companyName = customerSeg;
  }

  // Address.
  const addr = parseServiceAddress(addressSeg);
  reasonCodes.push(...addr.reasons);

  // Location notes: explicit trailing segments + any location pulled from the
  // address + location-word segments.
  const noteParts: string[] = [];
  if (addr.locationNote) noteParts.push(addr.locationNote);
  for (const seg of extraSegs) {
    if (LOCATION_WORDS.test(seg) || seg.length <= 30) {
      noteParts.push(seg);
      reasonCodes.push("LOCATION_SEGMENT");
    }
  }
  const locationNotes = noteParts.length ? noteParts.join("; ") : null;

  // Confidence: name repair is the primary concern.
  //  - high  : clear person or clear company customer segment.
  //  - medium: ambiguous customer (acronym / unclassified) — report, don't repair.
  //  - low   : should not happen past the gate, but guard anyway.
  let confidence: Confidence;
  if (kind === "person" || kind === "company") confidence = "high";
  else confidence = "medium";

  const customerDisplayName = kind === "company" ? companyName : titleTrim(customerSeg);

  return {
    isComposite: true,
    confidence,
    reasonCodes,
    parserVersion: QBO_COMPOSITE_PARSER_VERSION,
    rawDisplayName: input,
    rawFullyQualifiedName: fqn,
    projectReference,
    projectNumber,
    projectName: null,
    customerDisplayName,
    firstName,
    lastName,
    companyName,
    customerKind: kind,
    serviceAddressLine1: addr.line1,
    serviceAddressLine2: addr.line2,
    serviceCity: addr.city,
    serviceState: addr.state,
    servicePostalCode: addr.zip,
    locationNotes,
  };
}
