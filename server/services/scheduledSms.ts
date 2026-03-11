/**
 * Scheduled SMS Service — Telnyx-powered
 * Processes pending scheduled sends every 5 minutes via a cron-like interval.
 */
import { getDb } from "../db";
import { scheduledSends, smsContacts, smsSends } from "../../drizzle/schema";
import { eq, lte, and } from "drizzle-orm";

const TELNYX_API = "https://api.telnyx.com/v2/messages";

function personalize(template: string, firstName: string): string {
  return template
    .replace(/\{\{contact\.firstname\}\}/gi, firstName)
    .replace(/\{\{firstName\}\}/gi, firstName);
}

async function sendViaTelnyx(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    return { success: false, error: "Telnyx credentials not configured" };
  }

  const res = await globalThis.fetch(TELNYX_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromNumber,
      to: phone,
      text: message,
    }),
  });

  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { data: { id: string } };
    return { success: true, messageId: data.data?.id };
  } else {
    const err = (await res.json()) as { errors?: Array<{ detail: string }> };
    const errorMsg = err.errors?.[0]?.detail ?? `HTTP ${res.status}`;
    return { success: false, error: errorMsg };
  }
}

export async function processScheduledSends(): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    console.warn("[ScheduledSMS] TELNYX_API_KEY not set — skipping");
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
        textBeltId: result.messageId ?? null,
        errorMessage: result.error ?? null,
        quotaRemaining: null,
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
