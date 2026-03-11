/**
 * SMS Campaign Router — Telnyx-powered drip campaign management
 * Handles contacts, campaigns, sending, and delivery tracking
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { smsContacts, smsCampaigns, smsSends, scheduledSends } from "../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

type DbInstance = ReturnType<typeof drizzle>;

const TELNYX_API = "https://api.telnyx.com/v2/messages";

// Normalize phone to E.164 US format (+1XXXXXXXXXX) required by Telnyx
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return ten;
  return `+1${ten}`;
}

// Replace {{contact.firstname}} merge tag
function personalize(template: string, firstName: string): string {
  return template
    .replace(/\{\{contact\.firstname\}\}/gi, firstName)
    .replace(/\{\{firstName\}\}/gi, firstName);
}

async function requireDb(): Promise<DbInstance> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// Send a single SMS via Telnyx API
async function sendViaTelnyx(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey) throw new Error("TELNYX_API_KEY not configured");
  if (!fromNumber) throw new Error("TELNYX_FROM_NUMBER not configured");

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

export const smsCampaignsRouter = router({
  // ── Quota / Balance ───────────────────────────────────────────────────────
  getQuota: protectedProcedure.query(async () => {
    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) throw new Error("TELNYX_API_KEY not configured");
    const res = await globalThis.fetch("https://api.telnyx.com/v2/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return { quotaRemaining: 0, success: false, balance: "0.00" };
    const data = (await res.json()) as { data: { balance: string; available_credit: string } };
    const balance = parseFloat(data.data?.balance ?? "0");
    // Estimate remaining texts at ~$0.004 per text
    const quotaRemaining = Math.floor(balance / 0.004);
    return { quotaRemaining, success: true, balance: data.data?.balance ?? "0.00" };
  }),

  // ── Contacts ──────────────────────────────────────────────────────────────
  listContacts: protectedProcedure
    .input(z.object({ segment: z.enum(["A", "B", "C", "all"]).default("all") }))
    .query(async ({ input }) => {
      const db = await requireDb();
      if (input.segment === "all") {
        return db.select().from(smsContacts).orderBy(desc(smsContacts.createdAt));
      }
      return db
        .select()
        .from(smsContacts)
        .where(eq(smsContacts.segment, input.segment as "A" | "B" | "C"))
        .orderBy(desc(smsContacts.createdAt));
    }),

  importContacts: protectedProcedure
    .input(
      z.array(
        z.object({
          firstName: z.string(),
          lastName: z.string().optional(),
          phone: z.string(),
          email: z.string().optional(),
          zip: z.string().optional(),
          segment: z.enum(["A", "B", "C"]).default("A"),
          leadStatus: z.string().optional(),
          smsTag: z.string().optional(),
        })
      )
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      let imported = 0;
      let skipped = 0;
      for (const contact of input) {
        const phone = normalizePhone(contact.phone);
        if (phone.length < 12) { skipped++; continue; }
        const existing = await db
          .select({ id: smsContacts.id })
          .from(smsContacts)
          .where(eq(smsContacts.phone, phone))
          .limit(1);
        if (existing.length > 0) { skipped++; continue; }
        await db.insert(smsContacts).values({
          firstName: contact.firstName,
          lastName: contact.lastName ?? "",
          phone,
          email: contact.email ?? "",
          zip: contact.zip ?? "",
          segment: contact.segment,
          leadStatus: contact.leadStatus ?? "",
          smsTag: contact.smsTag ?? "",
          optedOut: false,
        });
        imported++;
      }
      return { imported, skipped };
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(smsContacts).where(eq(smsContacts.id, input.id));
      return { success: true };
    }),

  updateContact: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      zip: z.string().optional(),
      segment: z.enum(["A", "B", "C"]).optional(),
      leadStatus: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, phone: rawPhone, ...rest } = input;
      const updates: Record<string, unknown> = { ...rest };
      if (rawPhone !== undefined) {
        updates.phone = normalizePhone(rawPhone);
      }
      await db.update(smsContacts).set(updates).where(eq(smsContacts.id, id));
      return { success: true };
    }),

  toggleOptOut: protectedProcedure
    .input(z.object({ id: z.number(), optedOut: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(smsContacts)
        .set({ optedOut: input.optedOut })
        .where(eq(smsContacts.id, input.id));
      return { success: true };
    }),

  // ── Campaigns ─────────────────────────────────────────────────────────────
  listCampaigns: protectedProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt));
  }),

  createCampaign: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        message1: z.string().min(1),
        message2: z.string().min(1),
        message3: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [result] = await db.insert(smsCampaigns).values({
        name: input.name,
        message1: input.message1,
        message2: input.message2,
        message3: input.message3,
        status: "draft",
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updateCampaign: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        message1: z.string().min(1).optional(),
        message2: z.string().min(1).optional(),
        message3: z.string().min(1).optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...updates } = input;
      await db.update(smsCampaigns).set(updates).where(eq(smsCampaigns.id, id));
      return { success: true };
    }),

  // ── Send SMS ───────────────────────────────────────────────────────────────
  sendSingle: protectedProcedure
    .input(
      z.object({
        contactId: z.number(),
        campaignId: z.number().optional(),
        messageNum: z.number().min(1).max(3),
        messageText: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [contact] = await db
        .select()
        .from(smsContacts)
        .where(eq(smsContacts.id, input.contactId))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
      if (contact.optedOut) throw new Error("Contact has opted out");

      const personalizedMsg = personalize(input.messageText, contact.firstName);
      const result = await sendViaTelnyx(contact.phone, personalizedMsg);

      await db.insert(smsSends).values({
        contactId: input.contactId,
        campaignId: input.campaignId ?? null,
        messageNum: input.messageNum,
        messageText: personalizedMsg,
        phone: contact.phone,
        status: result.success ? "sent" : "failed",
        textBeltId: result.messageId ?? null,
        errorMessage: result.error ?? null,
        quotaRemaining: null,
      });

      return {
        success: result.success,
        error: result.error,
      };
    }),

  sendBulk: protectedProcedure
    .input(
      z.object({
        contactIds: z.array(z.number()),
        campaignId: z.number().optional(),
        messageNum: z.number().min(1).max(3),
        messageText: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const contactId of input.contactIds) {
        const [contact] = await db
          .select()
          .from(smsContacts)
          .where(eq(smsContacts.id, contactId))
          .limit(1);

        if (!contact || contact.optedOut) { skipped++; continue; }

        const personalizedMsg = personalize(input.messageText, contact.firstName);

        try {
          const result = await sendViaTelnyx(contact.phone, personalizedMsg);

          await db.insert(smsSends).values({
            contactId,
            campaignId: input.campaignId ?? null,
            messageNum: input.messageNum,
            messageText: personalizedMsg,
            phone: contact.phone,
            status: result.success ? "sent" : "failed",
            textBeltId: result.messageId ?? null,
            errorMessage: result.error ?? null,
            quotaRemaining: null,
          });

          if (result.success) {
            sent++;
          } else {
            failed++;
            errors.push(`${contact.firstName} ${contact.lastName ?? ""}: ${result.error}`);
          }
        } catch (_err: unknown) {
          failed++;
          errors.push(`${contact.firstName}: network error`);
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
      }

      return { sent, failed, skipped, errors };
    }),

  // ── Send History ──────────────────────────────────────────────────────────
  getSendHistory: protectedProcedure
    .input(z.object({ contactId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      if (input.contactId) {
        return db
          .select()
          .from(smsSends)
          .where(eq(smsSends.contactId, input.contactId))
          .orderBy(desc(smsSends.sentAt))
          .limit(input.limit);
      }
      return db
        .select()
        .from(smsSends)
        .orderBy(desc(smsSends.sentAt))
        .limit(input.limit);
    }),

  getCampaignStats: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const sends = await db
        .select()
        .from(smsSends)
        .where(eq(smsSends.campaignId, input.campaignId));
      const total = sends.length;
      const sent = sends.filter((s: typeof sends[0]) => s.status === "sent").length;
      const failed = sends.filter((s: typeof sends[0]) => s.status === "failed").length;
      const msg1 = sends.filter((s: typeof sends[0]) => s.messageNum === 1 && s.status === "sent").length;
      const msg2 = sends.filter((s: typeof sends[0]) => s.messageNum === 2 && s.status === "sent").length;
      const msg3 = sends.filter((s: typeof sends[0]) => s.messageNum === 3 && s.status === "sent").length;
      return { total, sent, failed, msg1, msg2, msg3 };
    }),

  // ── Scheduled Sends ───────────────────────────────────────────────────────
  scheduleSend: protectedProcedure
    .input(
      z.object({
        contactIds: z.array(z.number()),
        campaignId: z.number().optional(),
        messageNum: z.number().min(1).max(3),
        messageText: z.string().min(1),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      let scheduled = 0;
      for (const contactId of input.contactIds) {
        const [contact] = await db
          .select({ id: smsContacts.id, optedOut: smsContacts.optedOut })
          .from(smsContacts)
          .where(eq(smsContacts.id, contactId))
          .limit(1);
        if (!contact || contact.optedOut) continue;
        await db.insert(scheduledSends).values({
          contactId,
          campaignId: input.campaignId ?? null,
          messageNum: input.messageNum,
          messageText: input.messageText,
          scheduledAt: input.scheduledAt,
          status: "pending",
        });
        scheduled++;
      }
      return { scheduled };
    }),

  listScheduledSends: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "sent", "failed", "cancelled", "all"]).default("all") }))
    .query(async ({ input }) => {
      const db = await requireDb();
      if (input.status === "all") {
        return db.select().from(scheduledSends).orderBy(desc(scheduledSends.scheduledAt)).limit(200);
      }
      return db
        .select()
        .from(scheduledSends)
        .where(eq(scheduledSends.status, input.status as "pending" | "sent" | "failed" | "cancelled"))
        .orderBy(desc(scheduledSends.scheduledAt))
        .limit(200);
    }),

  cancelScheduledSend: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(scheduledSends)
        .set({ status: "cancelled" })
        .where(and(eq(scheduledSends.id, input.id), eq(scheduledSends.status, "pending")));
      return { success: true };
    }),

  getPendingScheduledCount: protectedProcedure.query(async () => {
    const db = await requireDb();
    const now = new Date();
    const pending = await db
      .select({ id: scheduledSends.id })
      .from(scheduledSends)
      .where(and(eq(scheduledSends.status, "pending"), gte(scheduledSends.scheduledAt, now)));
    return { count: pending.length };
  }),
});
