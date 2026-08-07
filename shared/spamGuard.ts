/**
 * Layer-1 content spam guard for PUBLIC form submissions.
 *
 * Pure and dependency-free on purpose: this module runs unchanged in Node (the
 * Railway tRPC backend) AND in Deno (the Supabase `submit-referral` edge
 * function). Do not add imports or reach for Node/Deno globals here.
 *
 * The guard SCORES a set of signals and blocks at/above `blockThreshold`
 * (default 60). Hard signals (honeypot, too-fast, blocked disposable domain)
 * each score 100 so they block on their own; the gibberish heuristics are
 * graded so a single weak signal never blocks a real person by itself — e.g.
 * the surname "Schmidt" (a 4-consonant run) scores 40 and passes, while a
 * random string like "kJvbXmq" trips several traits and blocks.
 *
 * INVARIANT: every check reads ONLY raw, user-submitted field values (name,
 * email, phone, honeypots, `_ts`). It must never inspect a string the server
 * composed — that produced a false positive when the client stored a literal
 * "\n\n" between service and message. Keep server-built strings out of here.
 *
 * Callers must return a SUCCESS-shaped response when `blocked` is true and log
 * `reasons` to the console — never surface an error. An error just teaches the
 * bot which mutation slipped past.
 */

export interface SpamGuardInput {
  /** Display name (or first+last joined) — subject of the gibberish heuristics. */
  name?: string;
  email?: string;
  phone?: string;
  /** Honeypot fields. A human never fills these; a bot filling forms will. */
  website?: string;
  company_url?: string;
  /** Epoch-ms captured at page load on the client (`_ts`). */
  ts?: number;
}

export interface SpamGuardOptions {
  /** Server receipt time in epoch-ms. Injectable for tests. Defaults to now. */
  now?: number;
  /** Minimum seconds between page load and submit before it looks robotic. */
  minSubmitSeconds?: number;
  /** Score at/above which a submission is blocked. */
  blockThreshold?: number;
  /** Additional blocked email domains, merged with the built-in list. */
  extraBlockedDomains?: string[];
}

export interface SpamGuardResult {
  blocked: boolean;
  score: number;
  /** Human-readable signal codes, e.g. "honeypot:website", "phone:nanp". */
  reasons: string[];
}

/** Point values per signal. Threshold is 60, so 100 = blocks alone. */
const WEIGHTS = {
  honeypot: 100,
  tooFast: 100,
  blockedDomain: 100,
  invalidUsPhone: 60,
  // Gibberish is graded — each trait adds independently.
  gib_consonantRun: 40,
  gib_noVowels: 40,
  gib_caseFlips: 40,
  gib_longWord: 60,
} as const;

const DEFAULT_MIN_SUBMIT_SECONDS = 4;
const DEFAULT_BLOCK_THRESHOLD = 60;

/**
 * Known-throwaway / disposable email domains. `itw-dahti.com` is the domain
 * behind the current attack; the rest are common disposable providers. Lowercase.
 */
export const BLOCKED_EMAIL_DOMAINS: readonly string[] = [
  "itw-dahti.com",
  // Common disposable / throwaway providers
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.dev",
  "trashmail.com",
  "trashmail.net",
  "yopmail.com",
  "throwawaymail.com",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "mailnesia.com",
  "mohmal.com",
  "mailcatch.com",
  "mytemp.email",
  "emailondeck.com",
  "moakt.com",
  "tempinbox.com",
  "discard.email",
];

// `y` counts as a vowel so real names like "Lynn"/"Bryn" are not flagged as
// vowelless. Consonant class deliberately excludes `y` for the same reason.
const VOWEL = /[aeiouy]/i;
const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxz]{4,}/i;

/** Extract the lowercased domain from an email address, or "" if unparseable. */
function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

/** Count lower<->upper transitions within a single word. */
function caseFlips(word: string): number {
  let flips = 0;
  let prev: "u" | "l" | null = null;
  for (const ch of word) {
    if (ch >= "A" && ch <= "Z") {
      if (prev === "l") flips++;
      prev = "u";
    } else if (ch >= "a" && ch <= "z") {
      if (prev === "u") flips++;
      prev = "l";
    } else {
      prev = null; // non-letter breaks the run
    }
  }
  return flips;
}

/**
 * Evaluate a submission. Returns a score, the signals that fired, and whether
 * the score meets the block threshold. Never throws.
 */
export function evaluateSpam(
  input: SpamGuardInput,
  options: SpamGuardOptions = {},
): SpamGuardResult {
  const now = options.now ?? Date.now();
  const minMs = (options.minSubmitSeconds ?? DEFAULT_MIN_SUBMIT_SECONDS) * 1000;
  const threshold = options.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD;
  const blockedDomains = new Set<string>([
    ...BLOCKED_EMAIL_DOMAINS,
    ...(options.extraBlockedDomains ?? []).map((d) => d.toLowerCase()),
  ]);

  const reasons: string[] = [];
  let score = 0;

  // 1. Honeypots — either non-empty is an instant block.
  if ((input.website ?? "").trim() !== "") {
    score += WEIGHTS.honeypot;
    reasons.push("honeypot:website");
  }
  if ((input.company_url ?? "").trim() !== "") {
    score += WEIGHTS.honeypot;
    reasons.push("honeypot:company_url");
  }

  // 2. Timestamp — a submit within `minMs` of page load (or with a future
  //    timestamp, elapsed < 0) is robotic. Skipped entirely when `_ts` absent
  //    so forms that don't send it are unaffected.
  if (typeof input.ts === "number" && Number.isFinite(input.ts)) {
    const elapsed = now - input.ts;
    if (elapsed < minMs) {
      score += WEIGHTS.tooFast;
      reasons.push(`too_fast:${Math.round(elapsed)}ms`);
    }
  }

  // 3. Blocked / disposable email domain — instant block.
  if (input.email) {
    const domain = emailDomain(input.email);
    if (domain && blockedDomains.has(domain)) {
      score += WEIGHTS.blockedDomain;
      reasons.push(`blocked_domain:${domain}`);
    }
  }

  // 4. Gibberish name — graded across four traits over the name's words.
  if (input.name) {
    const words = input.name.trim().split(/\s+/).filter(Boolean);
    let consonantRun = false;
    let noVowels = false;
    let manyFlips = false;
    let longWord = false;
    for (const w of words) {
      const letters = w.replace(/[^A-Za-z]/g, "");
      if (CONSONANT_RUN.test(w)) consonantRun = true;
      if (letters.length >= 4 && !VOWEL.test(letters)) noVowels = true;
      if (caseFlips(w) >= 4) manyFlips = true;
      if (w.length >= 20) longWord = true;
    }
    if (consonantRun) { score += WEIGHTS.gib_consonantRun; reasons.push("gibberish:consonant_run"); }
    if (noVowels) { score += WEIGHTS.gib_noVowels; reasons.push("gibberish:no_vowels"); }
    if (manyFlips) { score += WEIGHTS.gib_caseFlips; reasons.push("gibberish:case_flips"); }
    if (longWord) { score += WEIGHTS.gib_longWord; reasons.push("gibberish:long_word"); }
  }

  // 5. US phone plausibility — NANP requires the area code AND the exchange
  //    code to both begin 2-9. Only enforced for 10-digit (or 1+10) numbers so
  //    international / partial entries are left alone.
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    let ten = digits;
    if (digits.length === 11 && digits[0] === "1") ten = digits.slice(1);
    if (ten.length === 10) {
      const area = ten.slice(0, 3);
      const areaLeads = ten[0] >= "2" && ten[0] <= "9";
      const exchangeLeads = ten[3] >= "2" && ten[3] <= "9";
      // N00 / N11 area codes are service/expansion codes, never geographic
      // (e.g. 300, 311, 411, 500, 911). A real caller never has one.
      const areaService = /^\d(00|11)$/.test(area);
      if (!areaLeads || !exchangeLeads || areaService) {
        score += WEIGHTS.invalidUsPhone;
        reasons.push(`phone:nanp:${area}-${ten.slice(3, 4)}xx`);
      }
    }
  }

  return { blocked: score >= threshold, score, reasons };
}
