/**
 * Lead push-eligibility gate — the SINGLE source of truth shared by the live
 * lead→QuickBooks auto-push worker (server/services/leadCustomerAutoSync.ts) and
 * the one-off backfill (scripts/backfill-leads-to-qbo.ts). The same junk that must
 * not be backfilled must also never be auto-pushed going forward.
 *
 * A not-pushable lead is SKIPPED and logged as `skipped_quality:<rule>` in
 * quickbooksSyncLogs (visible in sync logs) — never silently dropped, never pushed.
 *
 * Rules:
 *   - REQUIRE a real name AND at least one working (valid, non-test) contact.
 *   - SKIP known test artifacts: our own domains, example/test domains, test markers
 *     (ga4-rollout, …), and fictional/test phone numbers (555 exchange, repeated
 *     digits). A junk value in one field does NOT reject the lead if the OTHER field
 *     is a usable contact.
 *   - FLAG-don't-push B2B/competitor patterns (role inboxes like estimator@/sales@,
 *     or HVAC/estimating business domains). These are SKIPPED and logged for review
 *     rather than deleted, so the owner can manually push a genuine one. A B2B email
 *     rejects the lead even when a phone is present — we don't want a competitor in
 *     QuickBooks at all.
 */

export interface LeadPushableInput {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface LeadPushableResult {
  pushable: boolean;
  /** Machine slug of the rule that rejected the lead (for skipped_quality logs). */
  rule?: string;
  /** Short human explanation for the sync log. */
  reason?: string;
}

// Domains WE own — a submission from our own domain is internal/testing, not a customer.
export const OWN_EMAIL_DOMAINS = ["mechanicalenterprise.com"];

// Obvious non-customer test/placeholder email signals.
export const TEST_EMAIL_DOMAINS = ["example.com", "example.org", "example.net", "test.com", "test.org", "email.com", "localhost", "mailinator.com"];
export const TEST_EMAIL_SUBSTRINGS = ["ga4-rollout", "rollout-test", "+test", "test+", "noreply", "no-reply", "donotreply", "do-not-reply"];

// Role/functional inboxes → almost always B2B outreach, not a homeowner lead.
export const B2B_ROLE_LOCALPARTS = ["estimator", "estimating", "sales", "info", "admin", "administrator", "support", "billing", "accounts", "accounting", "office", "contact", "hello", "marketing", "team", "help", "webmaster"];

// Competitor / trade-vendor domain signals (an HVAC/estimating BUSINESS emailing us).
export const B2B_DOMAIN_KEYWORDS = ["hvac", "estimation", "estimating", "takeoff", "servicesolutions"];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface EmailParts { email: string; local: string; domain: string }
function emailParts(email?: string | null): EmailParts | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return null;
  const at = e.lastIndexOf("@");
  return { email: e, local: e.slice(0, at), domain: e.slice(at + 1) };
}

/** Digits only, with a leading US country code stripped. */
export function phoneDigits(phone?: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}
function isValidPhone(phone?: string | null): boolean {
  return phoneDigits(phone).length === 10;
}
function isTestPhone(phone?: string | null): boolean {
  const d = phoneDigits(phone);
  if (d.length !== 10) return false;
  if (d.slice(3, 6) === "555") return true;        // NANP fictional exchange (e.g. 862-555-0100)
  if (/^(\d)\1{9}$/.test(d)) return true;          // all identical digits
  if (d === "1234567890" || d === "0123456789") return true;
  return false;
}
function isTestEmail(p: EmailParts): boolean {
  return TEST_EMAIL_DOMAINS.includes(p.domain) || TEST_EMAIL_SUBSTRINGS.some(s => p.email.includes(s));
}
function localMatchesRole(local: string, role: string): boolean {
  if (local === role) return true;
  if (local.startsWith(role)) {
    const next = local[role.length];
    return next === "." || next === "+" || next === "-" || next === "_";
  }
  return false;
}
function hasRealName(i: LeadPushableInput): boolean {
  const raw = ([i.firstName, i.lastName].filter(Boolean).join(" ").trim()) || (i.name ?? "").trim();
  const norm = raw.replace(/[()]/g, "").trim();
  if (norm.replace(/[^a-zA-Z]/g, "").length < 2) return false; // need ≥2 letters
  if (/^(no ?name|n\/?a|test|unknown|customer|guest|anonymous|none|null)$/i.test(norm)) return false;
  return true;
}

const skip = (rule: string, reason: string): LeadPushableResult => ({ pushable: false, rule, reason });

export function isLeadPushable(lead: LeadPushableInput): LeadPushableResult {
  if (!hasRealName(lead)) return skip("no_name", "missing or placeholder name");

  const parts = emailParts(lead.email);

  // B2B/competitor email is a lead-NATURE signal → flag-don't-push even if a phone exists.
  if (parts) {
    if (B2B_ROLE_LOCALPARTS.some(r => localMatchesRole(parts.local, r))) {
      return skip("b2b_role_email", `role inbox ${parts.local}@${parts.domain}`);
    }
    if (B2B_DOMAIN_KEYWORDS.some(k => parts.domain.includes(k))) {
      return skip("b2b_competitor_domain", `business/competitor domain ${parts.domain}`);
    }
  }

  const emailUsable = !!parts && !OWN_EMAIL_DOMAINS.includes(parts.domain) && !isTestEmail(parts);
  const phoneUsable = isValidPhone(lead.phone) && !isTestPhone(lead.phone);

  if (!emailUsable && !phoneUsable) {
    // Report the most specific reason for having no usable contact.
    if (parts && OWN_EMAIL_DOMAINS.includes(parts.domain)) return skip("own_domain", `internal domain ${parts.domain}`);
    if (parts && isTestEmail(parts)) return skip("test_email", `test/placeholder email ${parts.email}`);
    if (isValidPhone(lead.phone) && isTestPhone(lead.phone)) return skip("test_phone", `fictional/test number ${phoneDigits(lead.phone)}`);
    return skip("no_contact", "no valid phone or email");
  }

  return { pushable: true };
}
