/**
 * SMS Webhook Service — Telnyx inbound + delivery-status webhooks.
 *
 * Telnyx posts to ONE messaging-profile webhook URL for everything:
 *   • inbound replies        → data.event_type = "message.received"
 *   • outbound lifecycle     → data.event_type = "message.sent" | "message.finalized"
 *
 * This handler:
 *   1. Verifies the Telnyx Ed25519 signature (services/telnyxSignature.ts).
 *   2. De-duplicates redelivered events (idempotency ledger smsWebhookEvents).
 *   3. Persists outbound delivery-status transitions (queued→sent→delivered/failed).
 *   4. Classifies inbound STOP / START / HELP / message (services/smsReplyKeywords.ts).
 *   5. Marks/clears opt-out, cancels pending scheduled sends on STOP.
 *   6. Matches the reply to an existing contact / customer / lead WITHOUT
 *      ever creating a new contact.
 *   7. Saves every inbound reply to the SMS inbox.
 *   8. Returns 200 OK to Telnyx (401 only on a bad signature).
 *
 * Portal config (Messaging → Profiles → Mechanical Enterprise → Inbound):
 *   Webhook URL: https://mechanicalenterprise.com/api/sms/reply
 *   Public key : Account → Keys & Credentials → Public Key → env TELNYX_PUBLIC_KEY
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import {
  smsContacts,
  scheduledSends,
  smsInboxMessages,
  smsSends,
  smsWebhookEvents,
  customers,
  leads,
} from "../../drizzle/schema";
import { parseTelnyxStatusEvent, type ParsedStatusEvent } from "./telnyxDeliveryStatus";
import { applyDeliveryStatusToInbox, phoneLast10Of, mechanicalSmsFrom } from "./smsOutbound";
import { classifyInbound } from "./smsReplyKeywords";
import { toE164 } from "./telnyxSms";
import { authorizeTelnyxWebhook, resolveWebhookAuthMode } from "./telnyxSignature";
import { eq, and, sql } from "drizzle-orm";

type AnyDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Last-10-digit match against a (possibly formatted) phone column. */
function last10Match(column: unknown, e164: string) {
  const last10 = e164.replace(/\D/g, "").slice(-10);
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${last10}`;
}

export interface InboundMatch {
  contactId: number | null;
  customerId: number | null;
  leadId: number | null;
}

/**
 * Resolve an inbound number to existing entities. Read-only: never inserts a
 * contact, so replies from unknown numbers stay unlinked (contactId=null) and
 * are still saved to the inbox.
 */
export async function matchInboundPhone(db: AnyDb, e164: string): Promise<InboundMatch> {
  const [contact] = await db
    .select({ id: smsContacts.id })
    .from(smsContacts)
    .where(last10Match(smsContacts.phone, e164))
    .limit(1);

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(last10Match(customers.phone, e164))
    .limit(1);

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.contactType, "phone"), last10Match(leads.contact, e164)))
    .limit(1);

  return {
    contactId: contact?.id ?? null,
    customerId: customer?.id ?? null,
    leadId: lead?.id ?? null,
  };
}

/**
 * Claim a webhook event id for one-time processing. Returns true if this is the
 * first time we've seen it, false if it's a duplicate redelivery. Events with
 * no id (shouldn't happen) are always processed (returns true).
 */
export async function claimWebhookEvent(
  db: AnyDb,
  eventId: string | undefined | null,
  eventType: string | undefined | null,
): Promise<boolean> {
  if (!eventId) return true;
  const existing = await db
    .select({ eventId: smsWebhookEvents.eventId })
    .from(smsWebhookEvents)
    .where(eq(smsWebhookEvents.eventId, eventId))
    .limit(1);
  if (existing.length > 0) return false;
  try {
    await db.insert(smsWebhookEvents).values({ eventId, eventType: eventType ?? null });
    return true;
  } catch {
    // Unique-key race: another delivery claimed it between our select and
    // insert. Treat as duplicate so processing runs at most once.
    return false;
  }
}

/**
 * Persist an outbound delivery-status transition onto the smsSends row keyed by
 * the Telnyx message id. Guards against out-of-order regressions: a late
 * non-delivered event will not overwrite a terminal "delivered".
 */
export async function applyDeliveryStatus(db: AnyDb, statusEvent: ParsedStatusEvent): Promise<number> {
  const patch: Record<string, unknown> = {
    deliveryStatus: statusEvent.deliveryStatus,
    deliveryErrorCode: statusEvent.errorCode,
    deliveryErrorMessage: statusEvent.errorMessage,
    deliveryUpdatedAt: new Date(),
  };
  if (statusEvent.deliveryStatus === "delivered") {
    patch.deliveredAt = statusEvent.completedAt ?? new Date();
  }

  const where =
    statusEvent.deliveryStatus === "delivered"
      ? eq(smsSends.textBeltId, statusEvent.telnyxMessageId)
      : and(
          eq(smsSends.textBeltId, statusEvent.telnyxMessageId),
          sql`(${smsSends.deliveryStatus} IS NULL OR ${smsSends.deliveryStatus} <> 'delivered')`,
        );

  const result = await db.update(smsSends).set(patch).where(where);
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

async function saveInboxMessage(
  db: AnyDb,
  args: {
    phone: string;
    message: string;
    isOptOut: boolean;
    match: InboundMatch;
    providerMessageId: string | null;
  },
): Promise<void> {
  try {
    await db.insert(smsInboxMessages).values({
      contactId: args.match.contactId,
      customerId: args.match.customerId,
      leadId: args.match.leadId,
      phone: args.phone,
      phoneLast10: phoneLast10Of(args.phone), // indexed conversation key
      direction: "inbound",
      message: args.message,
      isOptOut: args.isOptOut,
      isRead: false,
      providerMessageId: args.providerMessageId,
      fromNumber: args.phone,          // inbound: the customer is the sender
      toNumber: mechanicalSmsFrom(),   // inbound: Mechanical is the recipient
      provider: "telnyx",
    });
  } catch (err) {
    console.error("[SMSWebhook] Failed to save inbox message:", err);
  }
}

async function markOptedOut(db: AnyDb, contactId: number): Promise<void> {
  await db.update(smsContacts).set({ optedOut: true }).where(eq(smsContacts.id, contactId));
  await db
    .update(scheduledSends)
    .set({ status: "cancelled" })
    .where(and(eq(scheduledSends.contactId, contactId), eq(scheduledSends.status, "pending")));
}

async function markOptedIn(db: AnyDb, contactId: number): Promise<void> {
  await db.update(smsContacts).set({ optedOut: false }).where(eq(smsContacts.id, contactId));
}

export interface InboundResult {
  intent: "stop" | "start" | "help" | "message";
  match: InboundMatch;
}

/**
 * Core inbound-reply processing. Classifies the message, applies opt-out /
 * opt-in, links entities, and saves to the inbox. Never sends an automated
 * application reply (STOP/START/HELP auto-responses are handled by the carrier
 * / Telnyx messaging profile, per 10DLC rules).
 */
export async function handleInboundReply(
  db: AnyDb,
  args: { fromPhone: string; text: string; providerMessageId: string | null },
): Promise<InboundResult> {
  const e164 = toE164(args.fromPhone) ?? args.fromPhone;
  const intent = classifyInbound(args.text);
  const match = await matchInboundPhone(db, e164);

  if (intent === "stop" && match.contactId != null) {
    await markOptedOut(db, match.contactId);
    console.log(`[SMSWebhook] ✓ Opt-out applied for contact ${match.contactId} (${e164})`);
  } else if (intent === "stop") {
    console.log(`[SMSWebhook] STOP from unknown number ${e164} — no contact to opt out`);
  } else if (intent === "start" && match.contactId != null) {
    await markOptedIn(db, match.contactId);
    console.log(`[SMSWebhook] ✓ Opt-in (START) applied for contact ${match.contactId} (${e164})`);
  } else if (intent === "help") {
    // Do NOT send an application HELP reply — carrier auto-responds. Logged only.
    console.log(`[SMSWebhook] HELP request from ${e164} — carrier auto-reply handles response`);
  }

  await saveInboxMessage(db, {
    phone: e164,
    message: args.text,
    isOptOut: intent === "stop",
    match,
    providerMessageId: args.providerMessageId,
  });

  return { intent, match };
}

/**
 * Fail-closed authorization for an inbound Telnyx webhook request.
 *  - Production always verifies the Ed25519 signature; a missing/invalid key is
 *    a 503 misconfiguration, a bad signature is a 401. Verification is NEVER
 *    silently skipped in production.
 *  - Non-production may bypass ONLY via the explicit TELNYX_WEBHOOK_SIGNATURE_BYPASS
 *    flag (a missing key does not imply bypass). The bypass is logged.
 */
function authorizeRequest(req: Request): { ok: true } | { ok: false; code: 401 | 503; reason: string } {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const result = authorizeTelnyxWebhook({
    signature: req.header("telnyx-signature-ed25519"),
    timestamp: req.header("telnyx-timestamp"),
    rawBody,
  });
  if (result.ok) {
    if (result.mode === "bypass") {
      console.warn(
        "[SMSWebhook] SIGNATURE VERIFICATION BYPASSED via TELNYX_WEBHOOK_SIGNATURE_BYPASS — dev/test only.",
      );
    }
    return { ok: true };
  }
  console.warn(`[SMSWebhook] Webhook rejected (${result.code}): ${result.reason}`);
  return { ok: false, code: result.code, reason: result.reason };
}

/**
 * Startup guard (fail-fast). In production a valid TELNYX_PUBLIC_KEY is
 * mandatory: if it is missing (and no non-prod bypass applies) the process
 * exits rather than booting a server that would reject every webhook. Logs a
 * warning when the explicit dev/test bypass is active.
 */
export function assertWebhookSecurityOrExit(): void {
  const mode = resolveWebhookAuthMode();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && mode !== "verify") {
    console.error(
      "[SMSWebhook] FATAL: TELNYX_PUBLIC_KEY is required in production to verify Telnyx webhook signatures. " +
        "Refusing to start. Set TELNYX_PUBLIC_KEY (Telnyx portal → Account → Keys & Credentials → Public Key).",
    );
    process.exit(1);
  }
  if (mode === "bypass") {
    console.warn(
      "[SMSWebhook] STARTUP: Telnyx webhook signature verification is BYPASSED " +
        "(TELNYX_WEBHOOK_SIGNATURE_BYPASS=true). Dev/test only — never use in production.",
    );
  } else if (mode === "misconfigured") {
    console.warn(
      "[SMSWebhook] STARTUP: TELNYX_PUBLIC_KEY not set — inbound webhooks will be rejected (503) until it is " +
        "configured, or set TELNYX_WEBHOOK_SIGNATURE_BYPASS=true for local dev.",
    );
  }
}

export function registerSmsWebhookRoutes(app: Express): void {
  /**
   * POST /api/sms/reply — Telnyx inbound + delivery-status webhook.
   */
  app.post("/api/sms/reply", async (req: Request, res: Response) => {
    try {
      // 1. Fail-closed signature authorization (Task 5) — before any processing.
      const auth = authorizeRequest(req);
      if (!auth.ok) {
        return res.status(auth.code).json({ error: auth.reason });
      }

      const body = req.body as {
        data?: {
          id?: string;
          event_type?: string;
          payload?: { from?: { phone_number?: string }; id?: string; text?: string };
        };
        // Legacy TextBelt inbound shape — retained only so a stale TextBelt
        // reply-webhook config cannot silently drop an inbound STOP.
        fromNumber?: string;
        text?: string;
      };

      const db = await getDb();
      if (!db) {
        console.error("[SMSWebhook] No DB — acknowledging without processing");
        return res.status(200).json({ success: true });
      }

      // 2. Idempotency (Task 8) — claim the event id; skip duplicates.
      const eventId = body.data?.id;
      const eventType = body.data?.event_type;
      const isFirstDelivery = await claimWebhookEvent(db, eventId, eventType);
      if (!isFirstDelivery) {
        console.log(`[SMSWebhook] Duplicate event ${eventId} (${eventType}) — already processed`);
        return res.status(200).json({ success: true, duplicate: true });
      }

      // 3. Outbound delivery-status events (Task 8) — persist and return.
      const statusEvent = parseTelnyxStatusEvent(req.body);
      if (statusEvent) {
        console.log(
          JSON.stringify({
            tag: "[SMSWebhook] DELIVERY_STATUS",
            telnyxMessageId: statusEvent.telnyxMessageId,
            eventType: statusEvent.eventType,
            rawToStatus: statusEvent.rawToStatus,
            mapped: statusEvent.deliveryStatus,
            errorCode: statusEvent.errorCode,
          }),
        );
        try {
          const affected = await applyDeliveryStatus(db, statusEvent);
          if (affected === 0) {
            // Not a tracked campaign send (appointment/rebate texts aren't in
            // smsSends). Expected — logged, not an error.
            console.log(
              `[SMSWebhook] Delivery status for untracked message ${statusEvent.telnyxMessageId} (${statusEvent.deliveryStatus})`,
            );
          }
        } catch (err) {
          console.error("[SMSWebhook] Failed to persist delivery status:", err);
        }
        // Also update the matching outbound row in the 2-Way Inbox thread so
        // staff see pending → sent → delivered/failed on messages we sent.
        try {
          await applyDeliveryStatusToInbox(db, {
            telnyxMessageId: statusEvent.telnyxMessageId,
            deliveryStatus: statusEvent.deliveryStatus,
            errorCode: statusEvent.errorCode,
          });
        } catch (err) {
          console.error("[SMSWebhook] Failed to update inbox delivery status:", err);
        }
        return res.status(200).json({ success: true });
      }

      // 4. Inbound replies (Telnyx format + legacy TextBelt fallback).
      let fromPhone: string | undefined;
      let messageText: string | undefined;
      let providerMessageId: string | null = null;

      if (body.data?.event_type === "message.received") {
        fromPhone = body.data.payload?.from?.phone_number;
        messageText = body.data.payload?.text;
        providerMessageId = body.data.payload?.id ?? null;
      } else if (body.fromNumber) {
        fromPhone = body.fromNumber;
        messageText = body.text;
      }

      if (!fromPhone || messageText == null) {
        console.log("[SMSWebhook] Webhook missing phone or text — ignoring");
        return res.status(200).json({ success: true });
      }

      // Length-only log — never the message body (Task 11).
      console.log(`[SMSWebhook] Inbound reply from ${toE164(fromPhone) ?? fromPhone} (len=${messageText.length})`);

      await handleInboundReply(db, { fromPhone, text: messageText, providerMessageId });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[SMSWebhook] Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/sms/reply — health/verification endpoint.
   */
  app.get("/api/sms/reply", (_req: Request, res: Response) => {
    res.status(200).json({ status: "SMS webhook active", service: "Mechanical Enterprise", provider: "Telnyx" });
  });
}
