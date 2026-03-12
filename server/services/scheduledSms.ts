/**
 * Scheduled SMS Service — TextBelt-powered
 * Processes pending scheduled sends every 5 minutes via a cron-like interval.
 * Note: Telnyx pending 10DLC approval; using TextBelt in the meantime.
 */
import { getDb } from "../db";
import { scheduledSends, smsContacts, smsSends } from "../../drizzle/schema";
import { eq, lte, and } from "drizzle-orm";

const TEXTBELT_API = "https://textbelt.com/text";

function personalize(template: string, firstName: string): string {
  return template
    .replace(/\{\{contact\.firstname\}\}/gi, firstName)
    .replace(/\{\{firstName\}\}/gi, firstName);
}

async function sendViaTextBelt(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  quotaRemaining?: number;
  error?: string;
}> {
  const apiKey = process.env.TEXTBELT_API_KEY;
  if (!apiKey) {
    return { success: false, error: "TEXTBELT_API_KEY not configured" };
  }

  const body = new URLSearchParams({
    phone,
    message,
    key: apiKey,
    replyWebhookUrl: "https://mechanicalenterprise.com/api/sms/reply",
  });

  const res = await globalThis.fetch(TEXTBELT_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as { success: boolean; textId?: string; quotaRemaining?: number; error?: string };
  if (data.success) {
    return { success: true, messageId: data.textId, quotaRemaining: data.quotaRemaining };
  } else {
    return { success: false, error: data.error ?? "Unknown TextBelt error", quotaRemaining: data.quotaRemaining };
  }
}

export async function processScheduledSends(): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  const apiKey = process.env.TEXTBELT_API_KEY;
  if (!apiKey) {
    console.warn("[ScheduledSMS] TEXTBELT_API_KEY not set — skipping");
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
      const result = await sendViaTextBelt(contact.phone, personalizedMsg);

      const [sendResult] = await db.insert(smsSends).values({
        contactId: item.contactId,
        campaignId: item.campaignId ?? null,
        messageNum: item.messageNum,
        messageText: personalizedMsg,
        phone: contact.phone,
        status: result.success ? "sent" : "failed",
        textBeltId: result.messageId ?? null,
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
  console.log("[ScheduledSMS] TextBelt processor started — checking every 5 minutes");

  processScheduledSends().catch((err) =>
    console.error("[ScheduledSMS] Startup run error:", err)
  );

  setInterval(() => {
    processScheduledSends().catch((err) =>
      console.error("[ScheduledSMS] Interval run error:", err)
    );
  }, INTERVAL_MS);
}
