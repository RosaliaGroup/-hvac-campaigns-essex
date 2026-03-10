/**
 * SMS Webhook Service — handles TextBelt inbound reply webhooks
 *
 * TextBelt sends a POST to your webhook URL when a recipient replies.
 * Payload: { fromNumber, text, data }
 *
 * This handler:
 *  1. Detects STOP / UNSUBSCRIBE / QUIT / CANCEL / END keywords
 *  2. Marks the matching contact as optedOut in the database
 *  3. Cancels any pending scheduled sends for that contact
 *  4. Returns 200 OK to TextBelt
 *
 * Register your webhook URL in TextBelt dashboard:
 *   https://textbelt.com/dashboard → Webhook URL → https://yourdomain.com/api/sms/reply
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { smsContacts, scheduledSends } from "../../drizzle/schema";
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

// Normalize phone to 10-digit US format (matches how contacts are stored)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function registerSmsWebhookRoutes(app: Express): void {
  /**
   * POST /api/sms/reply
   * TextBelt inbound reply webhook
   */
  app.post("/api/sms/reply", async (req: Request, res: Response) => {
    try {
      const { fromNumber, text } = req.body as { fromNumber?: string; text?: string };

      if (!fromNumber || !text) {
        return res.status(400).json({ error: "Missing fromNumber or text" });
      }

      const phone = normalizePhone(fromNumber);
      console.log(`[SMSWebhook] Reply from ${phone}: "${text}"`);

      if (isOptOutMessage(text)) {
        const db = await getDb();
        if (db) {
          // Find contact by phone
          const [contact] = await db
            .select({ id: smsContacts.id, firstName: smsContacts.firstName })
            .from(smsContacts)
            .where(eq(smsContacts.phone, phone))
            .limit(1);

          if (contact) {
            // Mark as opted out
            await db
              .update(smsContacts)
              .set({ optedOut: true })
              .where(eq(smsContacts.id, contact.id));

            // Cancel all pending scheduled sends for this contact
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
              `[SMSWebhook] ✓ Opted out contact ${contact.firstName} (${phone}) — pending sends cancelled`
            );
          } else {
            console.log(`[SMSWebhook] STOP from unknown number ${phone} — no contact found`);
          }
        }
      }

      // Always return 200 to TextBelt
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[SMSWebhook] Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/sms/reply
   * Verification endpoint (some webhook providers do a GET to verify the URL)
   */
  app.get("/api/sms/reply", (_req: Request, res: Response) => {
    res.status(200).json({ status: "SMS webhook active", service: "Mechanical Enterprise" });
  });
}
