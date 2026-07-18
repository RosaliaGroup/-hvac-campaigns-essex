/**
 * Customer Referral Link SMS — Mechanical Enterprise
 *
 * Sends the EXISTING customer referral program link
 * (https://mechanicalenterprise.com/referral — "Earn $500 Per Referral")
 * to a caller who asks for it, through the active Telnyx SMS provider.
 *
 * This is the ONLY referral program surfaced here. It is the customer
 * referral ($500) program — NOT the realtor/property-manager referral
 * partner program and NOT a review request. Copy is drawn verbatim from
 * the /referral landing page; no new program or wording is introduced.
 *
 * Guarantees:
 *  - Telnyx only. No Rosalia, TextBelt, or Twilio dependency.
 *  - Respects SMS consent / STOP: a contact flagged `optedOut` is never texted.
 *  - Deduplicates: a link already sent to the same number inside the dedup
 *    window (covers the same call and Vapi webhook retries) is not re-sent.
 *  - Records the outbound communication in Mechanical Enterprise (smsSends).
 *  - Never exposes provider errors or credentials to the caller.
 */
import { and, desc, eq, gte, like } from "drizzle-orm";
import { getDb } from "../db";
import { smsContacts, smsSends } from "../../drizzle/schema";
import { sendTelnyxSms, telnyxConfigured, toE164 } from "./telnyxSms";

/** The one approved customer referral link — source of truth: /referral page. */
export const CUSTOMER_REFERRAL_LINK = "https://mechanicalenterprise.com/referral";

/**
 * Dedup window. A referral link successfully sent to a number within this
 * window is treated as already-delivered, so re-invocation during the same
 * call — or a Vapi webhook retry of the same tool call — never double-texts.
 */
export const REFERRAL_DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * The customer referral SMS. Wording is taken from the /referral landing page
 * ("Earn $500 Per Referral" hero + "Know someone who needs HVAC work? Send them
 * our way. We pay you when they book." subhead) plus the standard Mechanical
 * Enterprise SMS footer used across the app. No new copy is invented.
 */
export function buildReferralMessage(firstName?: string | null): string {
  const greeting = firstName && firstName.trim() ? `Hi ${firstName.trim()}! ` : "";
  return (
    `${greeting}Earn $500 per referral with Mechanical Enterprise. ` +
    `Know someone who needs HVAC work? Send them our way — we pay you when they book: ` +
    `${CUSTOMER_REFERRAL_LINK}\n\n` +
    `Questions? Call (862) 423-9396\n` +
    `Reply STOP to opt out.`
  );
}

export type ReferralSendStatus =
  | "sent"
  | "duplicate"
  | "invalid_number"
  | "opted_out"
  | "send_failed";

export interface ReferralSendResult {
  status: ReferralSendStatus;
  /** E.164 number the link was (or would be) sent to; null when unparseable. */
  phone: string | null;
}

/**
 * Injectable side-effect surface. The default wiring (below) uses only the
 * Telnyx provider and the Mechanical Enterprise database; nothing else is
 * reachable from here. Tests substitute a fake to exercise every branch
 * without touching the network or a database.
 */
export interface ReferralSmsDeps {
  /** True if a successful referral link was sent to `phoneE164` at/after `sinceEpochMs`. */
  hasRecentReferralSend(phoneE164: string, sinceEpochMs: number): Promise<boolean>;
  /** Existing SMS contact for this number, if any. */
  findContactByPhone(phoneE164: string): Promise<{ id: number; optedOut: boolean } | null>;
  /** Create a minimal SMS contact for a first-time caller; returns its id. */
  createContact(input: { firstName: string; phoneE164: string }): Promise<number>;
  /** Send via the active provider (Telnyx). */
  sendSms(phoneE164: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  /** Persist the outbound communication (smsSends). */
  recordSend(row: {
    contactId: number;
    phoneE164: string;
    messageText: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }): Promise<void>;
  /** True if the provider is configured. */
  configured(): boolean;
  /** Clock, injectable for deterministic dedup tests. */
  now(): number;
}

/**
 * Send the customer referral link, honoring consent, suppression, and dedup.
 * Pure orchestration — all I/O flows through `deps`.
 */
export async function sendCustomerReferralLink(
  input: { phone: string; firstName?: string | null },
  deps: ReferralSmsDeps = defaultDeps,
): Promise<ReferralSendResult> {
  const phoneE164 = toE164(input.phone);
  if (!phoneE164) {
    return { status: "invalid_number", phone: null };
  }

  // Dedup first — before any send or record. Covers same-call re-invocation
  // and webhook retries regardless of whether the caller is a known contact.
  const since = deps.now() - REFERRAL_DEDUP_WINDOW_MS;
  if (await deps.hasRecentReferralSend(phoneE164, since)) {
    return { status: "duplicate", phone: phoneE164 };
  }

  // Consent / STOP / suppression: never text a number that has opted out.
  const existing = await deps.findContactByPhone(phoneE164);
  if (existing?.optedOut) {
    return { status: "opted_out", phone: phoneE164 };
  }

  // Provider must be configured; treat "not configured" as a generic failure
  // so no configuration/credential detail leaks to the caller.
  if (!deps.configured()) {
    return { status: "send_failed", phone: phoneE164 };
  }

  // Resolve a contact to attach the outbound record to (find-or-create).
  const contactId = existing
    ? existing.id
    : await deps.createContact({
        firstName: input.firstName?.trim() || "Referral Caller",
        phoneE164,
      });

  const message = buildReferralMessage(input.firstName);
  const result = await deps.sendSms(phoneE164, message);

  await deps.recordSend({
    contactId,
    phoneE164,
    messageText: message,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  });

  return { status: result.success ? "sent" : "send_failed", phone: phoneE164 };
}

// ── Default wiring (Telnyx + Mechanical Enterprise DB) ───────────────────────

const defaultDeps: ReferralSmsDeps = {
  async hasRecentReferralSend(phoneE164, sinceEpochMs) {
    const db = await getDb();
    if (!db) return false;
    const rows = await db
      .select({ id: smsSends.id })
      .from(smsSends)
      .where(
        and(
          eq(smsSends.phone, phoneE164),
          eq(smsSends.status, "sent"),
          like(smsSends.messageText, `%${CUSTOMER_REFERRAL_LINK}%`),
          gte(smsSends.sentAt, new Date(sinceEpochMs)),
        ),
      )
      .orderBy(desc(smsSends.sentAt))
      .limit(1);
    return rows.length > 0;
  },

  async findContactByPhone(phoneE164) {
    const db = await getDb();
    if (!db) return null;
    const [contact] = await db
      .select({ id: smsContacts.id, optedOut: smsContacts.optedOut })
      .from(smsContacts)
      .where(eq(smsContacts.phone, phoneE164))
      .limit(1);
    return contact ?? null;
  },

  async createContact({ firstName, phoneE164 }) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    // MySQL returns the new id via ResultSetHeader.insertId (mirrors db.ts).
    const result = await db
      .insert(smsContacts)
      .values({ firstName, phone: phoneE164, smsTag: "vapi_referral", optedOut: false });
    return Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
  },

  async sendSms(phoneE164, message) {
    const result = await sendTelnyxSms(phoneE164, message);
    return { success: result.success, messageId: result.messageId, error: result.error };
  },

  async recordSend({ contactId, phoneE164, messageText, success, messageId, error }) {
    const db = await getDb();
    if (!db) return;
    await db.insert(smsSends).values({
      contactId,
      campaignId: null,
      messageNum: 1,
      messageText,
      phone: phoneE164,
      status: success ? "sent" : "failed",
      deliveryStatus: success ? "accepted" : null,
      textBeltId: messageId ?? null, // legacy column name; stores the Telnyx message id
      errorMessage: error ?? null,
    });
  },

  configured() {
    return telnyxConfigured();
  },

  now() {
    return Date.now();
  },
};
