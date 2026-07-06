/**
 * Scheduled SMS Service — Telnyx-powered
 * Processes pending scheduled sends every 5 minutes via a cron-like interval.
 * (TextBelt is LEGACY — retired July 2026.)
 */
import { sendTelnyxSms, telnyxConfigured } from "./telnyxSms";
import { getDb } from "../db";
import { scheduledSends, smsContacts, smsSends } from "../../drizzle/schema";
import { eq, lte, and } from "drizzle-orm";


function personalize(template: string, firstName: string): string {
  return template
    .replace(/\{\{contact\.firstname\}\}/gi, firstName)
    .replace(/\{\{firstName\}\}/gi, firstName);
}

/**
 * LEGACY NOTE (July 2026): TextBelt was replaced by Telnyx as the active SMS
 * provider. This wrapper keeps the old call-site shape but sends via Telnyx.
 */
async function sendViaTelnyx(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  quotaRemaining?: number; // legacy field — Telnyx is pay-as-you-go, always undefined
  error?: string;
}> {
  const result = await sendTelnyxSms(phone, message);
  return { success: result.success, messageId: result.messageId, error: result.error };
}

export async function processScheduledSends(): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  if (!telnyxConfigured()) {
    console.warn("[ScheduledSMS] Telnyx not configured (TELNYX_API_KEY / TELNYX_FROM_NUMBER) — skipping");
    return { processed: 0, sent: 0, failed: 0 };
  }

  const now = new Date();
  const due = await db
    .select()
    .from(scheduledSends)
    .where(and(eq(scheduledSends.status, "pending"), lte(scheduledSends.scheduledAt, now)));

  if (due.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const item of due) {
    const [contact] = await db
      .select()
      .from(smsContacts)
      .where(eq(smsContacts.id, item.contactId))
      .limit(1);

    if (!contact || contact.optedOut) {
      await db
        .update(scheduledSends)
        .set({ status: "cancelled" })
        .where(eq(scheduledSends.id, item.id));
      continue;
    }

    const personalizedMsg = personalize(item.messageText, contact.firstName);

    try {
      const result = await sendViaTelnyx(contact.phone, personalizedMsg);

      const [sendResult] = await db.insert(smsSends).values({
        contactId: item.contactId,
        campaignId: item.campaignId ?? null,
        messageNum: item.messageNum,
        messageText: personalizedMsg,
        phone: contact.phone,
        status: result.success ? "sent" : "failed",
        deliveryStatus: result.success ? "accepted" : null,
        textBeltId: result.messageId ?? null, // legacy column name; stores the Telnyx message id
        errorMessage: result.error ?? null,
        quotaRemaining: result.quotaRemaining ?? null,
      });

      await db
        .update(scheduledSends)
        .set({
          status: result.success ? "sent" : "failed",
          smsSendId: (sendResult as { insertId: number }).insertId,
        })
        .where(eq(scheduledSends.id, item.id));

      if (result.success) {
        sent++;
        console.log(`[ScheduledSMS] ✓ Sent Msg${item.messageNum} to ${contact.phone} via Telnyx`);
      } else {
        failed++;
        console.warn(`[ScheduledSMS] ✗ Failed Msg${item.messageNum} to ${contact.phone}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      await db
        .update(scheduledSends)
        .set({ status: "failed" })
        .where(eq(scheduledSends.id, item.id));
      console.error(`[ScheduledSMS] Error for contact ${item.contactId}:`, err);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[ScheduledSMS] Processed ${due.length}: ${sent} sent, ${failed} failed`);
  return { processed: due.length, sent, failed };
}

export function startScheduledSmsProcessor(): void {
  const INTERVAL_MS = 5 * 60 * 1000;
  console.log("[ScheduledSMS] Telnyx processor started — checking every 5 minutes");

  processScheduledSends().catch((err) =>
    console.error("[ScheduledSMS] Startup run error:", err)
  );

  setInterval(() => {
    processScheduledSends().catch((err) =>
      console.error("[ScheduledSMS] Interval run error:", err)
    );
  }, INTERVAL_MS);
}
