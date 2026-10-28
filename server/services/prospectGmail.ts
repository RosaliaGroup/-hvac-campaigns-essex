/**
 * Gmail access for the single automated HVAC email sender (Railway prospect workflow).
 *
 * Quota rules (root-cause fix, 2026-10-28):
 *  - EVERY request (reads and sends) goes through the shared paced lane and the
 *    shared in-process cooldown used by the CRM Gmail scanners, so one quota
 *    response pauses all Gmail traffic from this service until Google's wait ends.
 *  - Any 401/403/429 throws GmailStopError. The caller must stop ALL outbound
 *    activity for the run; recovery happens only on the next normal hourly cycle.
 *  - Queries are narrow and bounded. The previous bounce check listed up to 100
 *    historical mailer-daemon/postmaster notices and fetched each one in FULL for
 *    every candidate, every minute — that pattern is removed.
 */
import { googleCalendarProvider } from "../integrations/google/calendar";
import { CRM_MAILBOX, gmailCrmStatus, addresses } from "./gmailCrm";
import { pacedGmailRead } from "./gmailReadTransport";
import { GmailQuotaCooldownError, gmailIsRateLimited, markGmailQuotaExceeded } from "./gmailQuotaCooldown";
import { REPORT_SUBJECT_PREFIX } from "../../shared/prospectCadence";

export type GmailStopKind = "rate_limited" | "permission_denied" | "auth_expired" | "wrong_mailbox";
export class GmailStopError extends Error {
  constructor(public readonly kind: GmailStopKind, public readonly status: number, detail = "") {
    super(`Gmail ${kind}${status ? ` (HTTP ${status})` : ""}${detail ? `: ${detail}` : ""}`);
    this.name = "GmailStopError";
  }
}
/** A check whose result could not be established; the candidate is held, the run continues. */
export class GmailIncompleteError extends Error {
  constructor(message: string) { super(message); this.name = "GmailIncompleteError"; }
}

const SAFE_EMAIL = /^[^\s"'{}()<>\\]+@[^\s"'{}()<>\\]+\.[^\s"'{}()<>\\]+$/;
function safeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!SAFE_EMAIL.test(e)) throw new Error("Invalid recipient address");
  return e;
}
const header = (msg: any, name: string): string =>
  msg?.payload?.headers?.find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value ?? "";
const MAX_SENT_PAGES = 5; // 500 messages — far above any hourly cap; beyond this we fail closed.

export type ThreadState = {
  outboundCount: number;
  replied: boolean;
  bounced: boolean;
  lastMessageIdHeader: string | null;
  originalSubject: string;
};
export type ProspectMailbox = ReturnType<typeof createProspectMailbox>;

export function createProspectMailbox(accessToken: string, fetchImpl: typeof fetch = fetch) {
  const request = async (path: string, init: RequestInit = {}): Promise<any> => {
    let r: Response;
    try {
      r = await pacedGmailRead(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      }, fetchImpl);
    } catch (e) {
      if (e instanceof GmailQuotaCooldownError) throw new GmailStopError("rate_limited", 429, "shared cooldown active");
      throw e;
    }
    if (r.status === 401) throw new GmailStopError("auth_expired", 401, "reconnect sales@ in CRM Integrations");
    if (r.status === 403 || r.status === 429) {
      const payload = await r.json().catch(() => null);
      const reason = JSON.stringify(payload?.error ?? {});
      if (gmailIsRateLimited(r.status, reason)) {
        markGmailQuotaExceeded();
        throw new GmailStopError("rate_limited", r.status);
      }
      throw new GmailStopError("permission_denied", r.status, "missing Gmail scope or access revoked");
    }
    if (!r.ok) throw new Error(`CRM Gmail request failed (${r.status}).`);
    return r.json();
  };
  const list = (q: string, maxResults: number, pageToken?: string) =>
    request(`messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);

  return {
    /** Confirms the connected account is sales@mechanicalenterprise.com. */
    async verifyIdentity(): Promise<string> {
      const profile = await request("profile");
      const address = String(profile.emailAddress ?? "").toLowerCase();
      if (address !== CRM_MAILBOX) throw new GmailStopError("wrong_mailbox", 0, `connected as ${address || "unknown"}`);
      return address;
    },
    /** Every non-report message in Sent since epochSec (manual + automated), complete pagination. */
    async outreachSentSince(epochSec: number): Promise<number> {
      const q = `in:sent after:${Math.floor(epochSec)} -subject:"${REPORT_SUBJECT_PREFIX}"`;
      let count = 0, token: string | undefined;
      for (let page = 0; page < MAX_SENT_PAGES; page++) {
        const r = await list(q, 100, token);
        count += r.messages?.length ?? 0;
        token = r.nextPageToken;
        if (!token) return count;
      }
      throw new GmailIncompleteError("Sent count pagination exceeded bound; failing closed.");
    },
    async hasSent(email: string): Promise<boolean> {
      const r = await list(`in:sent to:${safeEmail(email)}`, 1);
      return Boolean(r.messages?.length);
    },
    /** Any message ever received from this exact address hands the prospect to a human. */
    async hasInboundFrom(email: string): Promise<boolean> {
      const r = await list(`in:anywhere from:${safeEmail(email)}`, 1);
      return Boolean(r.messages?.length);
    },
    /** Delivery-failure notices that mention this exact address since a date. Bounded to 5. */
    async hasBounce(email: string, sinceEpochSec?: number): Promise<boolean> {
      const e = safeEmail(email);
      const since = sinceEpochSec ? ` after:${Math.floor(sinceEpochSec)}` : "";
      const r = await list(`in:anywhere {from:mailer-daemon from:postmaster} "${e}"${since}`, 5);
      for (const m of r.messages ?? []) {
        const msg = await request(`messages/${encodeURIComponent(m.id)}?format=full`);
        const walk = (p: any): string =>
          (p?.body?.data ? Buffer.from(p.body.data, "base64url").toString("utf8") : "") + (p?.parts ?? []).map(walk).join("\n");
        if (walk(msg.payload).toLowerCase().includes(e)) return true;
      }
      if (r.nextPageToken) throw new GmailIncompleteError("Bounce check exceeded bound; holding candidate.");
      return false;
    },
    /** One metadata read of the original thread: outbound count, replies, bounces, threading headers. */
    async threadState(threadId: string, email: string): Promise<ThreadState> {
      const e = safeEmail(email);
      const t = await request(`threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=Message-ID&metadataHeaders=Subject`);
      const messages: any[] = t.messages ?? [];
      if (!messages.length) throw new GmailIncompleteError("Original thread not found.");
      let outboundCount = 0, replied = false, bounced = false;
      for (const m of messages) {
        const from = header(m, "from");
        if ((m.labelIds ?? []).includes("SENT") && addresses(from).includes(CRM_MAILBOX)) outboundCount++;
        if (addresses(from).includes(e)) replied = true;
        if (/mailer-daemon|postmaster/i.test(from)) bounced = true;
      }
      const lastId = header(messages.at(-1), "message-id");
      return {
        outboundCount, replied, bounced,
        lastMessageIdHeader: /^<[^<>\s]+>$/.test(lastId) ? lastId : null,
        originalSubject: header(messages[0], "subject"),
      };
    },
    async send(input: { to: string; subject: string; body: string; threadId?: string | null; inReplyTo?: string | null;
      /** Extra RFC 5322 headers (e.g. List-Unsubscribe). Names/values may not contain line breaks. */
      extraHeaders?: Record<string, string> }) {
      const to = safeEmail(input.to);
      if (/[\r\n]/.test(input.subject)) throw new Error("Invalid subject");
      const extra = Object.entries(input.extraHeaders ?? {}).map(([k, v]) => {
        if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(k) || /[\r\n]/.test(v)) throw new Error("Invalid header");
        return `${k}: ${v}`;
      });
      if (input.threadId && !input.inReplyTo) throw new Error("Cannot safely thread the follow-up email.");
      const raw = Buffer.from([
        `From: ${CRM_MAILBOX}`,
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
        ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
        ...extra,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(input.body).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "",
      ].join("\r\n")).toString("base64url");
      const sent = await request("messages/send", {
        method: "POST",
        body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
      });
      return { id: String(sent.id), threadId: String(sent.threadId) };
    },
    /** Exact-subject lookup in Sent (report de-duplication). */
    async findSentBySubject(subject: string): Promise<string | null> {
      const r = await list(`in:sent subject:"${subject.replace(/"/g, "")}"`, 5);
      for (const m of r.messages ?? []) {
        const msg = await request(`messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject`);
        if (header(msg, "subject").trim() === subject) return String(m.id);
      }
      return null;
    },
    /** Provider readback: the message exists and carries the SENT label. */
    async isInSent(messageId: string): Promise<boolean> {
      const msg = await request(`messages/${encodeURIComponent(messageId)}?format=minimal`);
      return (msg.labelIds ?? []).includes("SENT");
    },
  };
}

export async function prospectMailbox(): Promise<ProspectMailbox> {
  const status = await gmailCrmStatus();
  if (!status.connected || !status.hasReadPermission || !status.hasSendPermission)
    throw new GmailStopError("permission_denied", 0, "Reconnect CRM Gmail (sales@) with read and send permissions.");
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  return createProspectMailbox(accessToken);
}
