/**
 * Pure rules + copy for the purchased-homeowner email campaign (source hvac-list-07105).
 * No I/O. Sending runs in server/services/homeownerEmailLane.ts.
 *
 * Compliance (CAN-SPAM): honest From/Subject, identifies the sender, a working one-click
 * unsubscribe link (also in the List-Unsubscribe header), and the business's physical
 * postal address. Unsubscribes are honored immediately (permanent CRM suppressions).
 * The source of the address is not stated (not required by CAN-SPAM).
 *
 * Signature: the sales@ Gmail signature (HTML) when available, else HOMEOWNER_EMAIL_SIGNATURE
 * or DEFAULT_SIGNATURE. Messages carry a plain-text part and an HTML part.
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

export function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** Plain-text rendering of a Gmail HTML signature for the text/plain part. */
export function signatureHtmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      const url = href.replace(/^mailto:|^tel:/i, "");
      const bare = (v: string) => v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
      if (!text) return "";
      return /^(mailto|tel):/i.test(href) || text.includes(url) || bare(text) === bare(url) ? text : `${text} (${href})`;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).filter((l, i, a) => l || (i > 0 && a[i - 1]))
    .join("\n").trim();
}

type Copy = { firstName: string; unsubscribeUrl: string; postalAddress: string; signature?: string; signatureHtml?: string | null };

/** Short footer: unsubscribe + postal address (both required); no list-source wording. */
function footerText(unsubscribeUrl: string, postalAddress: string) {
  return ["", "--", `Don't want to hear from us? Unsubscribe: ${unsubscribeUrl}`, `Mechanical Enterprise LLC, ${postalAddress}`].join("\n");
}
function footerHtml(unsubscribeUrl: string, postalAddress: string) {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#777">Don't want to hear from us? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#777">Unsubscribe</a><br>Mechanical Enterprise LLC, ${escapeHtml(postalAddress)}</p>`;
}

function render(input: Copy, paragraphs: string[], closing: string | null) {
  const sigText = input.signatureHtml ? signatureHtmlToText(input.signatureHtml) : (input.signature ?? DEFAULT_SIGNATURE);
  const body = [
    `Hi ${input.firstName},`, "",
    ...paragraphs.flatMap(p => [p, ""]),
    ...(closing ? [closing] : []),
    sigText,
    footerText(input.unsubscribeUrl, input.postalAddress),
  ].join("\n");
  const sigHtml = input.signatureHtml
    ?? escapeHtml(input.signature ?? DEFAULT_SIGNATURE).replace(/\n/g, "<br>");
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const html = `<!doctype html><html><body><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${
    p(`Hi ${escapeHtml(input.firstName)},`)}${paragraphs.map(t => p(escapeHtml(t))).join("")}${
    closing ? `<p style="margin:0 0 4px">${escapeHtml(closing)}</p>` : ""}<div>${sigHtml}</div>${
    footerHtml(input.unsubscribeUrl, input.postalAddress)}</div></body></html>`;
  return { body, html };
}

export function introEmail(input: Copy) {
  const { body, html } = render(input, [
    "I'm Ana Haynes, president of Mechanical Enterprise, a New Jersey HVAC company. We install, replace and service furnaces, central air and high-efficiency heat pumps for homeowners in your area.",
    "If your system is getting older, your energy bills are climbing, or you've been thinking about a heat pump, we offer a free in-home assessment. We'll also check which utility and state rebates your home may qualify for.",
    `Interested? Just reply to this email or call ${BUSINESS_PHONE}.`,
  ], "Thank you,");
  return { subject: HOMEOWNER_INTRO_SUBJECT, body, html };
}

export function followUpEmail(input: Copy & { originalSubject: string }) {
  const subject = /^re:/i.test(input.originalSubject) ? input.originalSubject : `Re: ${input.originalSubject}`;
  const { body, html } = render(input, [
    "Following up on my note last week. With colder weather coming, now is a good time to have your heating checked or to price out a replacement before an emergency.",
    `Our in-home assessment is free. Reply here or call ${BUSINESS_PHONE} and we'll find a time that works for you.`,
  ], null);
  return { subject, body, html };
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
