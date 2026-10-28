/**
 * Pure rules + copy for the purchased-homeowner email campaign (source hvac-list-07105).
 * No I/O. Sending runs in server/services/homeownerEmailLane.ts.
 *
 * Compliance (CAN-SPAM): honest From/Subject, identifies the sender, explains why the
 * person is receiving it, a working one-click unsubscribe link plus "reply unsubscribe",
 * and the business's physical postal address. Unsubscribes are honored immediately
 * (they become permanent CRM outreach suppressions).
 */

export const HOMEOWNER_SOURCE = "hvac-list-07105";
export const HOMEOWNER_INTRO_SUBJECT = "Free HVAC assessment for your home — Mechanical Enterprise";
/** Business days after the introduction before the single follow-up. */
export const HOMEOWNER_FOLLOW_UP_BUSINESS_DAYS = 5;
export const DEFAULT_HOMEOWNER_PER_HOUR = 6;
export const DEFAULT_HOMEOWNER_PER_DAY = 40;
/** Shared ceiling across ALL outreach from sales@ in one Eastern hour (matches CATCH_UP_HOURLY_CAP). */
export const SHARED_HOURLY_CEILING = 20;
/** Homeowner sends start this many minutes into the hour, after the commercial cycle has run. */
export const HOMEOWNER_START_MINUTE = 30;
export const BUSINESS_PHONE = "(862) 423-9396";

export function firstNameFor(firstName: string | null | undefined, displayName: string | null | undefined): string {
  const raw = (firstName || (displayName ?? "").split(/\s+/)[0] || "").trim();
  if (!/^[A-Za-z][A-Za-z'\-]{1,30}$/.test(raw)) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export const DEFAULT_SIGNATURE = [
  "Ana Haynes",
  "President, Mechanical Enterprise LLC",
  `${BUSINESS_PHONE} | mechanicalenterprise.com`,
].join("\n");

/** Owner-supplied plain-text signature (HOMEOWNER_EMAIL_SIGNATURE); "\\n" sequences become line breaks. */
export function normalizeSignature(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  return s.length >= 3 ? s.slice(0, 1000) : DEFAULT_SIGNATURE;
}

function footer(unsubscribeUrl: string, postalAddress: string) {
  return [
    "",
    "--",
    "You are receiving this because your address appears on a New Jersey homeowner mailing list we obtained.",
    `To stop all emails from us, click ${unsubscribeUrl} or reply "unsubscribe".`,
    `Mechanical Enterprise LLC, ${postalAddress}`,
  ].join("\n");
}

export function introEmail(input: { firstName: string; unsubscribeUrl: string; postalAddress: string; signature?: string }) {
  const body = [
    `Hi ${input.firstName},`,
    "",
    "I'm Ana Haynes, president of Mechanical Enterprise, a New Jersey HVAC company. We install, replace and service furnaces, central air and high-efficiency heat pumps for homeowners in your area.",
    "",
    "If your system is getting older, your energy bills are climbing, or you've been thinking about a heat pump, we offer a free in-home assessment. We'll also check which utility and state rebates your home may qualify for.",
    "",
    `Interested? Just reply to this email or call ${BUSINESS_PHONE}.`,
    "",
    "Thank you,",
    input.signature ?? DEFAULT_SIGNATURE,
    footer(input.unsubscribeUrl, input.postalAddress),
  ].join("\n");
  return { subject: HOMEOWNER_INTRO_SUBJECT, body };
}

export function followUpEmail(input: { firstName: string; unsubscribeUrl: string; postalAddress: string; originalSubject: string; signature?: string }) {
  const subject = /^re:/i.test(input.originalSubject) ? input.originalSubject : `Re: ${input.originalSubject}`;
  const body = [
    `Hi ${input.firstName},`,
    "",
    "Following up on my note last week. With colder weather coming, now is a good time to have your heating checked or to price out a replacement before an emergency.",
    "",
    `Our in-home assessment is free. Reply here or call ${BUSINESS_PHONE} and we'll find a time that works for you.`,
    "",
    input.signature ?? DEFAULT_SIGNATURE,
    footer(input.unsubscribeUrl, input.postalAddress),
  ].join("\n");
  return { subject, body };
}

/** How many homeowner emails may go out now. Fails closed on unknown counts. */
export function homeownerAllowance(opts: {
  perHour: number; perDay: number; sentThisHourAllOutreach: number | null; homeownerSentToday: number;
}): number {
  if (opts.sentThisHourAllOutreach === null || !Number.isFinite(opts.sentThisHourAllOutreach)) return 0;
  return Math.max(0, Math.min(
    opts.perHour,
    SHARED_HOURLY_CEILING - opts.sentThisHourAllOutreach,
    opts.perDay - opts.homeownerSentToday,
  ));
}

export function isRealEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.includes("placeholder");
}
