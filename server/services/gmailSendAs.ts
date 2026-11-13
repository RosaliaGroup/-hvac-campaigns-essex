import { CRM_MAILBOX } from "./gmailCrm";

/**
 * Per-user "From" address for CRM email.
 *
 * The CRM sends every email through the connected sales@ Gmail account. A team
 * member whose CRM login is their own @mechanicalenterprise.com address (for
 * example heidi@mechanicalenterprise.com) has their emails sent *as* that
 * address — but only when it is a verified "Send mail as" alias on the sales@
 * account. Anything else falls back to sales@, so an unverified or unknown
 * address can never be put in the From header.
 */
export const SEND_AS_DOMAIN = "mechanicalenterprise.com";

export type Sender = { email: string; displayName: string | null };

const EMAIL = /^[^\s<>@,;"]+@[^\s<>@,;"]+\.[^\s<>@,;"]+$/;

/** The candidate alias for a signed-in user, or null when they send as sales@. */
export function candidateSendAs(userEmail: string | null | undefined): string | null {
  const email = String(userEmail ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email === CRM_MAILBOX) return null;
  if (!email.endsWith(`@${SEND_AS_DOMAIN}`)) return null;
  return email;
}

/**
 * Looks the alias up in sales@'s Gmail "Send mail as" settings.
 * `request` is the caller's authenticated Gmail request helper (users/me/...).
 */
export async function resolveSender(
  userEmail: string | null | undefined,
  request: (path: string) => Promise<any>
): Promise<Sender> {
  const fallback: Sender = { email: CRM_MAILBOX, displayName: null };
  const alias = candidateSendAs(userEmail);
  if (!alias) return fallback;
  try {
    const r = await request(`settings/sendAs/${encodeURIComponent(alias)}`);
    const verified =
      String(r?.sendAsEmail ?? "").toLowerCase() === alias &&
      (r?.isPrimary === true || r?.verificationStatus === "accepted");
    if (!verified) return fallback;
    const name = typeof r?.displayName === "string" ? r.displayName.trim() : "";
    return { email: alias, displayName: name || null };
  } catch {
    return fallback;
  }
}

/** RFC 2047-safe From header value. */
export function fromHeader(sender: Sender): string {
  if (!sender.displayName) return sender.email;
  const name = sender.displayName.replace(/[\r\n]/g, " ");
  return `=?UTF-8?B?${Buffer.from(name).toString("base64")}?= <${sender.email}>`;
}
