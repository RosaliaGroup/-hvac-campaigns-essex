/**
 * Shared contact-field validation + formatting helpers.
 *
 * Used by both the server (tRPC input validation, teamAuth router) and the
 * client (dashboard team form + field-app My Profile screen) so the rules
 * stay identical on both sides. Keep this file dependency-free.
 */

/** Basic, pragmatic email check (mirrors server/services/appointmentInvites.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: string | null | undefined): boolean {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

/**
 * Reduce a US phone number to its 10 significant digits.
 * Accepts "+1 (555) 123-4567", "555.123.4567", "15551234567", etc.
 * Returns the 10 digits, or null if it isn't a plausible US number.
 */
export function normalizeUsPhoneDigits(v: string | null | undefined): string | null {
  if (!v) return null;
  let digits = v.replace(/\D/g, "");
  // Drop a leading country code "1" if present (11-digit US numbers).
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.length === 10 ? digits : null;
}

export function isValidUsPhone(v: string | null | undefined): boolean {
  return normalizeUsPhoneDigits(v) !== null;
}

/**
 * Format a US phone number as "(555) 123-4567".
 * Returns null if the input isn't a valid 10-digit US number, so callers can
 * reject invalid input rather than store garbage.
 */
export function formatUsPhone(v: string | null | undefined): string | null {
  const d = normalizeUsPhoneDigits(v);
  if (!d) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** tel: href value ("+15551234567") for click-to-call, or null. */
export function telHref(v: string | null | undefined): string | null {
  const d = normalizeUsPhoneDigits(v);
  return d ? `+1${d}` : null;
}
