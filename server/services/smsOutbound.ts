/**
 * Outbound SMS logging — Mechanical Enterprise.
 *
 * Every Mechanical Telnyx send should leave a row in `smsInboxMessages` with
 * direction="outbound", so the 2-Way SMS Inbox shows the messages WE sent next
 * to the customer's inbound replies (not just the replies). One shared path so
 * campaign sends, scheduled drips, appointment confirmations, and manual Inbox
 * replies all record consistently.
 *
 * Compliance: sends are opt-out-checked BEFORE dispatch. Failed API sends are
 * recorded with a "failed" status — never as "delivered". The final carrier
 * outcome is filled in later by the Telnyx delivery webhook
 * (see applyDeliveryStatusToInbox + services/smsWebhook.ts).
 */
import { getDb } from "../db";
import { smsContacts, smsInboxMessages } from "../../drizzle/schema";
import { sendTelnyxSms, toE164 } from "./telnyxSms";
import { and, eq, sql } from "drizzle-orm";

type AnyDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Which Mechanical send path produced an outbound row. */
export type OutboundSource =
  | "inbox_reply"
  | "campaign"
  | "scheduled"
  | "appointment"
  | "rebate"
  | "vapi_booking"
  | "other";

/** Initial delivery status stored at send time (webhook refines it later). */
export type OutboundDeliveryStatus =
  | "queued" | "accepted" | "sent" | "delivered"
  | "delivery_failed" | "rejected" | "carrier_filtered" | "failed";

/** The Mechanical Telnyx sender number (E.164), or null if unconfigured. */
export function mechanicalSmsFrom(): string | null {
  return process.env.TELNYX_FROM_NUMBER ?? null;
}

/** Last-10 digits — the stored conversation key (phoneLast10). */
export function phoneLast10Of(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}
function last10(raw: string): string {
  return phoneLast10Of(raw);
}
function last10Sql(column: unknown, raw: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${last10(raw)}`;
}

/**
 * Match a conversation on smsInboxMessages by its indexed phoneLast10 key.
 * No REGEXP_REPLACE scan: migration 0054 backfills phoneLast10 for every
 * existing row and all writes (inbound + outbound) populate it, so this is a
 * pure index lookup on smsInboxMessages_phoneLast10_idx.
 */
export function inboxPhoneMatch(raw: string) {
  return eq(smsInboxMessages.phoneLast10, last10(raw));
}

/**
 * A number is opted out if a matching SMS contact is opted out OR the number
 * has sent an inbound STOP (isOptOut) — this honors STOP even from numbers that
 * were never saved as contacts, so we never text someone who opted out.
 */
export async function isPhoneOptedOut(db: AnyDb, phone: string): Promise<boolean> {
  if (last10(phone).length < 10) return false;
  const contact = await db
    .select({ optedOut: smsContacts.optedOut })
    .from(smsContacts)
    .where(last10Sql(smsContacts.phone, phone))
    .limit(1);
  if (contact[0]?.optedOut === true) return true;

  const stop = await db
    .select({ id: smsInboxMessages.id })
    .from(smsInboxMessages)
    .where(and(
      eq(smsInboxMessages.direction, "inbound"),
      eq(smsInboxMessages.isOptOut, true),
      inboxPhoneMatch(phone),
    ))
    .limit(1);
  return stop.length > 0;
}

export interface RecordOutboundArgs {
  phone: string;
  message: string;
  fromNumber: string | null;
  telnyxMessageId: string | null;
  deliveryStatus: OutboundDeliveryStatus;
  source: OutboundSource;
  contactId?: number | null;
  customerId?: number | null;
  leadId?: number | null;
  sentByName?: string | null;
}

/**
 * Insert one outbound row into the SMS Inbox. Idempotent by Telnyx message id:
 * if a row already carries this textBeltId, no second row is written (guards
 * against a retried log call creating a duplicate outbound bubble).
 */
export async function recordOutboundSms(
  db: AnyDb,
  args: RecordOutboundArgs,
): Promise<{ inserted: boolean }> {
  const e164 = toE164(args.phone) ?? args.phone;

  if (args.telnyxMessageId) {
    const dup = await db
      .select({ id: smsInboxMessages.id })
      .from(smsInboxMessages)
      .where(eq(smsInboxMessages.textBeltId, args.telnyxMessageId))
      .limit(1);
    if (dup.length > 0) return { inserted: false };
  }

  await db.insert(smsInboxMessages).values({
    contactId: args.contactId ?? null,
    customerId: args.customerId ?? null,
    leadId: args.leadId ?? null,
    phone: e164,                       // external party number (conversation identity)
    phoneLast10: phoneLast10Of(e164),  // indexed conversation key, maintained at write time
    direction: "outbound",
    message: args.message,
    isOptOut: false,
    isRead: true, // our own outbound is never "unread"
    sentByName: args.sentByName ?? "Team",
    textBeltId: args.telnyxMessageId,        // webhook correlation key (provider message id)
    providerMessageId: args.telnyxMessageId, // provider message id (clean field)
    fromNumber: args.fromNumber,             // Mechanical Telnyx sender
    toNumber: e164,                          // customer recipient
    provider: "telnyx",
    source: args.source,
    deliveryStatus: args.deliveryStatus,
    deliveryErrorCode: null,
    sentAt: args.deliveryStatus === "failed" ? null : new Date(),
  });
  return { inserted: true };
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true when the send was refused because the number opted out. */
  blocked?: boolean;
}

/**
 * The one-call Mechanical send: opt-out check → Telnyx send → record the
 * outbound row in the Inbox. Never throws on a Telnyx failure (records a
 * "failed" row and returns success:false). An opted-out number is refused
 * BEFORE any send (blocked:true, nothing recorded).
 */
export async function sendAndRecordSms(
  db: AnyDb,
  args: {
    phone: string;
    message: string;
    source: OutboundSource;
    contactId?: number | null;
    customerId?: number | null;
    leadId?: number | null;
    sentByName?: string | null;
  },
): Promise<SendResult> {
  if (await isPhoneOptedOut(db, args.phone)) {
    return { success: false, blocked: true, error: "This number has opted out of SMS (STOP)." };
  }

  const result = await sendTelnyxSms(args.phone, args.message);

  await recordOutboundSms(db, {
    phone: args.phone,
    message: args.message,
    fromNumber: mechanicalSmsFrom(),
    telnyxMessageId: result.messageId ?? null,
    deliveryStatus: result.success ? "accepted" : "failed",
    source: args.source,
    contactId: args.contactId ?? null,
    customerId: args.customerId ?? null,
    leadId: args.leadId ?? null,
    sentByName: args.sentByName ?? null,
  });

  return { success: result.success, messageId: result.messageId, error: result.error };
}

/**
 * Best-effort logging of an outbound that was already sent by a caller which
 * owns its own Telnyx dispatch (campaign/scheduled/appointment paths). Never
 * throws — a logging failure must not fail the send it is recording.
 */
export async function logOutboundBestEffort(
  db: AnyDb,
  args: RecordOutboundArgs,
): Promise<void> {
  try {
    await recordOutboundSms(db, args);
  } catch (err) {
    console.error("[smsOutbound] Failed to log outbound message:", err);
  }
}

/**
 * Apply a Telnyx delivery-status transition to the matching outbound Inbox row
 * (keyed by Telnyx message id in textBeltId). Returns rows affected.
 */
export async function applyDeliveryStatusToInbox(
  db: AnyDb,
  args: { telnyxMessageId: string; deliveryStatus: OutboundDeliveryStatus; errorCode?: string | null },
): Promise<number> {
  const res = await db
    .update(smsInboxMessages)
    .set({ deliveryStatus: args.deliveryStatus, deliveryErrorCode: args.errorCode ?? null })
    .where(and(
      eq(smsInboxMessages.textBeltId, args.telnyxMessageId),
      eq(smsInboxMessages.direction, "outbound"),
    ));
  return Number((res as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}
