/**
 * SMS Campaign Router — TextBelt-powered drip campaign management
 * Handles contacts, campaigns, sending, and delivery tracking
 * Note: Telnyx is configured but pending 10DLC approval; using TextBelt in the meantime
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { smsContacts, smsCampaigns, smsSends, scheduledSends, smsInboxMessages } from "../../drizzle/schema";
import { eq, desc, and, gte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

type DbInstance = ReturnType<typeof drizzle>;

const TEXTBELT_API = "https://textbelt.com/text";

// Normalize phone to E.164 US format (+1XXXXXXXXXX)
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

// Send a single SMS via TextBelt API
async function sendViaTextBelt(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  quotaRemaining?: number;
  error?: string;
}> {
  const apiKey = process.env.TEXTBELT_API_KEY;
  if (!apiKey) throw new Error("TEXTBELT_API_KEY not configured");

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

export const smsCampaignsRouter = router({
  // ── Quota / Balance ───────────────────────────────────────────────────────
  getQuota: protectedProcedure.query(async () => {
    const apiKey = process.env.TEXTBELT_API_KEY;
    if (!apiKey) throw new Error("TEXTBELT_API_KEY not configured");
    const res = await globalThis.fetch(`https://textbelt.com/quota/${apiKey}`);
    if (!res.ok) return { quotaRemaining: 0, success: false };
    const data = (await res.json()) as { success: boolean; quotaRemaining: number };
    return { quotaRemaining: data.quotaRemaining ?? 0, success: data.success };
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
      const result = await sendViaTextBelt(contact.phone, personalizedMsg);

      await db.insert(smsSends).values({
        contactId: input.contactId,
        campaignId: input.campaignId ?? null,
        messageNum: input.messageNum,
        messageText: personalizedMsg,
        phone: contact.phone,
        status: result.success ? "sent" : "failed",
        textBeltId: result.messageId ?? null,
        errorMessage: result.error ?? null,
        quotaRemaining: result.quotaRemaining ?? null,
      });

      return {
        success: result.success,
        error: result.error,
        quotaRemaining: result.quotaRemaining,
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
          const result = await sendViaTextBelt(contact.phone, personalizedMsg);

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

  // ── 2-Way SMS Inbox ───────────────────────────────────────────────────────
  listInboxMessages: protectedProcedure
    .input(z.object({
      contactId: z.number().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      if (input.contactId) {
        return db
          .select()
          .from(smsInboxMessages)
          .where(eq(smsInboxMessages.contactId, input.contactId))
          .orderBy(desc(smsInboxMessages.createdAt))
          .limit(input.limit);
      }
      return db
        .select()
        .from(smsInboxMessages)
        .orderBy(desc(smsInboxMessages.createdAt))
        .limit(input.limit);
    }),

  getUnreadCount: protectedProcedure.query(async () => {
    const db = await requireDb();
    const unread = await db
      .select({ id: smsInboxMessages.id })
      .from(smsInboxMessages)
      .where(and(eq(smsInboxMessages.isRead, false), eq(smsInboxMessages.direction, "inbound")));
    return { count: unread.length };
  }),

  markAsRead: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      for (const id of input.ids) {
        await db
          .update(smsInboxMessages)
          .set({ isRead: true })
          .where(eq(smsInboxMessages.id, id));
      }
      return { success: true };
    }),

  markConversationRead: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(smsInboxMessages)
        .set({ isRead: true })
        .where(and(
          eq(smsInboxMessages.contactId, input.contactId),
          eq(smsInboxMessages.isRead, false)
        ));
      return { success: true };
    }),

  replyToContact: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      message: z.string().min(1),
      sentByName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [contact] = await db
        .select()
        .from(smsContacts)
        .where(eq(smsContacts.id, input.contactId))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
      if (contact.optedOut) throw new Error("Contact has opted out");

      const result = await sendViaTextBelt(contact.phone, input.message);

      // Save outbound reply to inbox
      await db.insert(smsInboxMessages).values({
        contactId: input.contactId,
        phone: contact.phone,
        direction: "outbound",
        message: input.message,
        isOptOut: false,
        isRead: true,
        sentByName: input.sentByName ?? "Team",
        textBeltId: result.messageId ?? null,
      });

      return {
        success: result.success,
        error: result.error,
        quotaRemaining: result.quotaRemaining,
      };
    }),

  getConversations: protectedProcedure.query(async () => {
    // Returns one row per contact that has inbox messages, with latest message and unread count
    const db = await requireDb();
    const messages = await db
      .select()
      .from(smsInboxMessages)
      .orderBy(desc(smsInboxMessages.createdAt))
      .limit(500);

    // Group by contactId (or phone for unknown contacts)
    const convMap = new Map<string, {
      key: string;
      contactId: number | null;
      phone: string;
      latestMessage: string;
      latestAt: Date;
      unreadCount: number;
      totalCount: number;
    }>();

    for (const msg of messages) {
      const key = msg.contactId ? `c:${msg.contactId}` : `p:${msg.phone}`;
      if (!convMap.has(key)) {
        convMap.set(key, {
          key,
          contactId: msg.contactId ?? null,
          phone: msg.phone,
          latestMessage: msg.message,
          latestAt: msg.createdAt,
          unreadCount: 0,
          totalCount: 0,
        });
      }
      const conv = convMap.get(key)!;
      conv.totalCount++;
      if (!msg.isRead && msg.direction === "inbound") conv.unreadCount++;
      // Keep the latest message (messages are desc so first is latest)
      if (msg.createdAt > conv.latestAt) {
        conv.latestMessage = msg.message;
        conv.latestAt = msg.createdAt;
      }
    }

    // Fetch contact names for known contacts
    const conversations = Array.from(convMap.values());
    const contactIds = conversations
      .filter((c) => c.contactId !== null)
      .map((c) => c.contactId as number);

    const contactMap = new Map<number, { firstName: string; lastName: string | null }>();
    if (contactIds.length > 0) {
      const contacts = await db
        .select({ id: smsContacts.id, firstName: smsContacts.firstName, lastName: smsContacts.lastName })
        .from(smsContacts)
        .where(or(...contactIds.map((id) => eq(smsContacts.id, id))));
      for (const c of contacts) contactMap.set(c.id, c);
    }

    return conversations
      .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
      .map((conv) => ({
        ...conv,
        contactName: conv.contactId
          ? `${contactMap.get(conv.contactId)?.firstName ?? ""} ${contactMap.get(conv.contactId)?.lastName ?? ""}`
          : null,
      }));
  }),
});
