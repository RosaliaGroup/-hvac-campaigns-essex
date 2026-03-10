/**
 * Scheduled SMS Service
 * Processes pending scheduled sends every 5 minutes via a cron-like interval.
 * Runs server-side — no external job queue needed.
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

export async function processScheduledSends(): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  const apiKey = process.env.TEXTBELT_API_KEY;
  if (!apiKey) {
    console.warn("[ScheduledSMS] TEXTBELT_API_KEY not set — skipping");
    return { processed: 0, sent: 0, failed: 0 };
  }

  // Find all pending sends that are due (scheduledAt <= now)
  const now = new Date();
  const due = await db
    .select()
    .from(scheduledSends)
    .where(and(eq(scheduledSends.status, "pending"), lte(scheduledSends.scheduledAt, now)));

  if (due.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const item of due) {
    // Get contact
    const [contact] = await db
      .select()
      .from(smsContacts)
      .where(eq(smsContacts.id, item.contactId))
      .limit(1);

    if (!contact || contact.optedOut) {
      // Cancel — contact opted out or deleted
      await db
        .update(scheduledSends)
        .set({ status: "cancelled" })
        .where(eq(scheduledSends.id, item.id));
      continue;
    }

    const personalizedMsg = personalize(item.messageText, contact.firstName);

    try {
      const res = await globalThis.fetch(TEXTBELT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: contact.phone,
          message: personalizedMsg,
          key: apiKey,
          sender: "Mechanical Enterprise",
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        quotaRemaining?: number;
        textId?: string | number;
        error?: string;
      };

      // Log the actual send
      const [sendResult] = await db.insert(smsSends).values({
        contactId: item.contactId,
        campaignId: item.campaignId ?? null,
        messageNum: item.messageNum,
        messageText: personalizedMsg,
        phone: contact.phone,
        status: data.success ? "sent" : "failed",
        textBeltId: data.textId ? String(data.textId) : null,
        errorMessage: data.error ?? null,
        quotaRemaining: data.quotaRemaining ?? null,
      });

      // Update scheduled send status
      await db
        .update(scheduledSends)
        .set({
          status: data.success ? "sent" : "failed",
          smsSendId: (sendResult as { insertId: number }).insertId,
        })
        .where(eq(scheduledSends.id, item.id));

      if (data.success) {
        sent++;
        console.log(`[ScheduledSMS] ✓ Sent Msg${item.messageNum} to ${contact.phone}`);
      } else {
        failed++;
        console.warn(`[ScheduledSMS] ✗ Failed Msg${item.messageNum} to ${contact.phone}: ${data.error}`);
      }
    } catch (err) {
      failed++;
      await db
        .update(scheduledSends)
        .set({ status: "failed" })
        .where(eq(scheduledSends.id, item.id));
      console.error(`[ScheduledSMS] Error for contact ${item.contactId}:`, err);
    }

    // Small delay between sends
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[ScheduledSMS] Processed ${due.length}: ${sent} sent, ${failed} failed`);
  return { processed: due.length, sent, failed };
}

/**
 * Start the background scheduler — runs every 5 minutes.
 * Call this once from server startup.
 */
export function startScheduledSmsProcessor(): void {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  console.log("[ScheduledSMS] Processor started — checking every 5 minutes");

  // Run immediately on startup to catch any overdue sends
  processScheduledSends().catch((err) =>
    console.error("[ScheduledSMS] Startup run error:", err)
  );

  setInterval(() => {
    processScheduledSends().catch((err) =>
      console.error("[ScheduledSMS] Interval run error:", err)
    );
  }, INTERVAL_MS);
}
