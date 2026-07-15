/**
 * Marketing attribution helpers (SEO / revenue-attribution workstream).
 *
 * Pure, dependency-free functions shared by the lead-capture handler and the
 * read-only revenue-attribution reporting. Two jobs:
 *
 *   1. normalizePath()  — canonicalize a landing URL/path so a lead's landing
 *      page reliably joins to `seoPages.page`. The SEO sync stores `page` as the
 *      raw `new URL(key).pathname` (see integrations/searchConsole.toPath), which
 *      is NOT lowercased and keeps trailing slashes. So the reporting join MUST
 *      run BOTH sides through normalizePath() — never string-compare raw values.
 *
 *   2. classifyChannel() — deterministically bucket a lead into a marketing
 *      channel from signals already present at capture (gclid, UTM, referrer
 *      host). It is intentionally conservative: it NEVER infers "organic" from
 *      the absence of data, and anything genuinely ambiguous stays "unknown" so
 *      attribution is preserved honestly rather than over-credited to search.
 */

export const CHANNELS = ["organic", "paid", "direct", "referral", "social", "email", "unknown"] as const;
export type Channel = (typeof CHANNELS)[number];

/** utm_medium values that unambiguously mean paid search / display. */
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "cpm", "display", "banner", "retargeting"]);
const EMAIL_MEDIUMS = new Set(["email", "e-mail", "newsletter"]);
const SOCIAL_MEDIUMS = new Set(["social", "social-network", "social_network", "social-media", "social_media", "sm", "paid-social", "paidsocial"]);
const ORGANIC_MEDIUMS = new Set(["organic", "seo"]);
const REFERRAL_MEDIUMS = new Set(["referral"]);

/** Registrable-ish hosts that identify a search engine (organic when unpaid). */
const SEARCH_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "yandex.", "ecosia.", "baidu.", "ask.", "aol."];
/** Hosts that identify social platforms (incl. link-shim subdomains). */
const SOCIAL_HOSTS = ["facebook.", "fb.", "l.facebook", "lm.facebook", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "lnkd.in", "youtube.", "youtu.be", "pinterest.", "tiktok.", "reddit.", "nextdoor."];
/** Hosts that identify a webmail / email client referrer. */
const EMAIL_HOSTS = ["mail.google", "outlook.", "mail.yahoo", "mail.", "webmail."];

function lc(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Strip a leading "www." so host comparisons are stable. */
export function normalizeHost(host: string | null | undefined): string {
  const h = lc(host).replace(/^www\./, "");
  return h;
}

function hostMatches(host: string, needles: string[]): boolean {
  return needles.some(n => host === n.replace(/\.$/, "") || host.startsWith(n) || host.includes(n));
}

/**
 * Canonicalize a landing URL or path to the form used for joining against
 * `seoPages.page`. Applied to BOTH sides of the join at read time.
 *
 *   - accepts a full URL ("https://site.com/HVAC/?utm=x#a") or a bare path
 *   - keeps the pathname only (drops host, query, and fragment)
 *   - percent-decodes, lowercases, collapses duplicate slashes
 *   - strips a trailing slash except for the root
 *   - returns "/" for empty / unparseable input
 *
 * Lowercasing is deliberate: this marketing site uses lowercase slugs, and GSC
 * may report mixed case; folding case removes a common source of mis-joins. The
 * (accepted) tradeoff is that two genuinely case-distinct paths would merge.
 */
export function normalizePath(input: string | null | undefined): string {
  let raw = (input ?? "").trim();
  if (!raw) return "/";

  let path: string;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      path = raw;
    }
  } else {
    // Bare path (possibly protocol-relative or with query/fragment).
    path = raw.replace(/^\/\/[^/]+/, ""); // drop protocol-relative host
    const cut = path.search(/[?#]/);
    if (cut !== -1) path = path.slice(0, cut);
  }

  try {
    path = decodeURIComponent(path);
  } catch {
    /* leave as-is on malformed escapes */
  }

  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export interface AttributionSignals {
  gclid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  /**
   * Host of document.referrer as reported by the client. Distinguish:
   *   - a non-empty host  → an actual referring site
   *   - "" (empty string) → client affirmatively reported NO referrer (direct)
   *   - undefined/null     → client did not report referrer at all (unknown)
   */
  referrerHost?: string | null;
}

/**
 * Deterministically map capture-time signals to a marketing channel.
 *
 * Precedence: paid → email → social → organic → referral → direct → unknown.
 * Honesty rules:
 *   - "organic" requires an AFFIRMATIVE signal (search-engine referrer or
 *     utm_medium=organic). Absence of data is never treated as organic.
 *   - "paid" comes only from deterministic signals: a gclid, or a paid utm_medium.
 *   - "direct" requires the client to have affirmatively reported no referrer
 *     (referrerHost === "") with no campaign params. If the referrer field was
 *     never provided (undefined/null), the visit stays "unknown".
 *
 * @param selfHost optional site's own host; a self-referral is treated as no referrer.
 */
export function classifyChannel(sig: AttributionSignals, selfHost?: string | null): Channel {
  const gclid = lc(sig.gclid);
  const medium = lc(sig.utmMedium);
  const source = lc(sig.utmSource);
  const referrerProvided = sig.referrerHost !== undefined && sig.referrerHost !== null;
  let host = normalizeHost(sig.referrerHost);
  const self = normalizeHost(selfHost);
  if (self && host === self) host = ""; // internal navigation ≈ no external referrer

  // 1. Paid — gclid or a paid utm_medium. (No inference beyond these signals.)
  if (gclid) return "paid";
  if (medium && PAID_MEDIUMS.has(medium)) return "paid";

  // 2. Email
  if (medium && EMAIL_MEDIUMS.has(medium)) return "email";
  if (host && hostMatches(host, EMAIL_HOSTS)) return "email";

  // 3. Social
  if (medium && SOCIAL_MEDIUMS.has(medium)) return "social";
  if (host && hostMatches(host, SOCIAL_HOSTS)) return "social";

  // 4. Organic — affirmative only.
  if (medium && ORGANIC_MEDIUMS.has(medium)) return "organic";
  if (host && hostMatches(host, SEARCH_HOSTS)) return "organic";

  // 5. Referral — an explicit non-search, non-social external site.
  if (medium && REFERRAL_MEDIUMS.has(medium)) return "referral";
  if (host) return "referral";

  // 6. Direct — client affirmatively reported no referrer AND no campaign params.
  const hasAnyUtm = Boolean(source || medium || lc(sig.utmCampaign));
  if (referrerProvided && !host && !hasAnyUtm) return "direct";

  // 7. Everything else is honestly unknown (e.g. referrer never reported).
  return "unknown";
}

/**
 * Extract attribution fields from a submitted landing URL (+ optional referrer),
 * for storage on a leadCaptures row. Reads UTM/gclid from the URL's query string.
 * Returns first-touch values; the caller writes these once at creation.
 */
export interface ExtractedAttribution {
  firstTouchLandingPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  referrerHost: string | null;
  channel: Channel;
}

function firstParam(params: URLSearchParams, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = params.get(k);
    if (v && v.trim()) return v.trim().slice(0, 255);
  }
  return null;
}

/** Best-effort parse of the query string from a full URL or a "?a=b" fragment. */
function paramsFrom(pageUrl: string | null | undefined): URLSearchParams {
  const raw = (pageUrl ?? "").trim();
  if (!raw) return new URLSearchParams();
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).searchParams;
    } catch {
      /* fall through */
    }
  }
  const q = raw.indexOf("?");
  return new URLSearchParams(q === -1 ? "" : raw.slice(q));
}

export function extractAttribution(
  pageUrl: string | null | undefined,
  referrer?: string | null,
  selfHost?: string | null,
): ExtractedAttribution {
  const params = paramsFrom(pageUrl);
  const gclid = firstParam(params, "gclid", "gbraid", "wbraid");
  const utmSource = firstParam(params, "utm_source");
  const utmMedium = firstParam(params, "utm_medium");
  const utmCampaign = firstParam(params, "utm_campaign");
  const utmTerm = firstParam(params, "utm_term");
  const utmContent = firstParam(params, "utm_content");

  // referrer: undefined stays undefined (→ unknown); "" means client reported none.
  let referrerHost: string | null;
  if (referrer === undefined) {
    referrerHost = null;
  } else if (referrer === null || referrer.trim() === "") {
    referrerHost = "";
  } else {
    try {
      referrerHost = normalizeHost(new URL(referrer).host);
    } catch {
      referrerHost = normalizeHost(referrer);
    }
  }

  const channel = classifyChannel(
    { gclid, utmSource, utmMedium, utmCampaign, referrerHost: referrer === undefined ? undefined : referrerHost },
    selfHost,
  );

  return {
    firstTouchLandingPath: pageUrl ? normalizePath(pageUrl) : null,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    gclid,
    referrerHost: referrerHost && referrerHost.length ? referrerHost.slice(0, 255) : referrerHost,
    channel,
  };
}
