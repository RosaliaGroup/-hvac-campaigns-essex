/**
 * SMS Webhook Service — handles Telnyx inbound reply webhooks
 *
 * Telnyx sends a POST to your webhook URL when a recipient replies.
 * Payload: { data: { event_type: "message.received", payload: { from: { phone_number }, text } } }
 *
 * This handler:
 *  1. Detects STOP / UNSUBSCRIBE / QUIT / CANCEL / END keywords
 *  2. Marks the matching contact as optedOut in the database
 *  3. Cancels any pending scheduled sends for that contact
 *  4. Returns 200 OK to Telnyx
 *
 * Webhook URL is set in Telnyx Messaging Profile:
 *   https://portal.telnyx.com → Messaging → Profiles → Mechanical Enterprise → Inbound → Webhook URL
 *   Set to: https://mechanicalenterprise.com/api/sms/reply
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { smsContacts, scheduledSends, smsInboxMessages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "unsubscribe",
  "quit",
  "cancel",
  "end",
  "optout",
  "opt-out",
  "opt out",
  "remove",
]);

function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.has(normalized);
}

// Normalize phone to E.164 format (+1XXXXXXXXXX) — matches how contacts are stored
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) return `+1${ten}`;
  return raw; // return as-is if not a standard US number
}

async function saveInboxMessage(phone: string, message: string, isOptOut: boolean, contactId: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(smsInboxMessages).values({
      contactId: contactId ?? null,
      phone,
      direction: "inbound",
      message,
      isOptOut,
      isRead: false,
    });
  } catch (err) {
    console.error("[SMSWebhook] Failed to save inbox message:", err);
  }
}

async function handleOptOut(phone: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const normalizedPhone = normalizePhone(phone);

  const [contact] = await db
    .select({ id: smsContacts.id, firstName: smsContacts.firstName })
    .from(smsContacts)
    .where(eq(smsContacts.phone, normalizedPhone))
    .limit(1);

  if (contact) {
    await db
      .update(smsContacts)
      .set({ optedOut: true })
      .where(eq(smsContacts.id, contact.id));

    await db
      .update(scheduledSends)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(scheduledSends.contactId, contact.id),
          eq(scheduledSends.status, "pending")
        )
      );

    console.log(
      `[SMSWebhook] ✓ Opted out contact ${contact.firstName} (${normalizedPhone}) — pending sends cancelled`
    );
    return contact.id;
  } else {
    console.log(`[SMSWebhook] STOP from unknown number ${normalizedPhone} — no contact found`);
    return null;
  }
}

export function registerSmsWebhookRoutes(app: Express): void {
  /**
   * POST /api/sms/reply
   * Telnyx inbound reply webhook
   */
  app.post("/api/sms/reply", async (req: Request, res: Response) => {
    try {
      // Telnyx webhook format
      const body = req.body as {
        data?: {
          event_type?: string;
          payload?: {
            from?: { phone_number?: string };
            text?: string;
          };
        };
        // Legacy TextBelt format fallback
        fromNumber?: string;
        text?: string;
      };

      let fromPhone: string | undefined;
      let messageText: string | undefined;

      if (body.data?.event_type === "message.received") {
        // Telnyx format
        fromPhone = body.data.payload?.from?.phone_number;
        messageText = body.data.payload?.text;
      } else if (body.fromNumber) {
        // Legacy TextBelt format fallback
        fromPhone = body.fromNumber;
        messageText = body.text;
      }

      if (!fromPhone || !messageText) {
        console.log("[SMSWebhook] Received webhook with missing phone or text — ignoring");
        return res.status(200).json({ success: true });
      }

      console.log(`[SMSWebhook] Reply from ${fromPhone}: "${messageText}"`);

      const normalizedPhone = normalizePhone(fromPhone);
      const isOptOut = isOptOutMessage(messageText);
      let contactId: number | null = null;

      if (isOptOut) {
        contactId = await handleOptOut(normalizedPhone);
      } else {
        // Look up contact for non-STOP replies
        const db = await getDb();
        if (db) {
          const [contact] = await db
            .select({ id: smsContacts.id })
            .from(smsContacts)
            .where(eq(smsContacts.phone, normalizedPhone))
            .limit(1);
          contactId = contact?.id ?? null;
        }
      }

      // Save all inbound messages to inbox
      await saveInboxMessage(normalizedPhone, messageText, isOptOut, contactId);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[SMSWebhook] Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/sms/reply
   * Verification endpoint
   */
  app.get("/api/sms/reply", (_req: Request, res: Response) => {
    res.status(200).json({ status: "SMS webhook active", service: "Mechanical Enterprise", provider: "Telnyx" });
  });
}
