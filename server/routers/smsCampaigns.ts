/**
 * SMS Campaign Router — Telnyx-powered drip campaign management
 * Handles contacts, campaigns, sending, and delivery tracking
 * SMS provider: Telnyx (active). TextBelt is legacy — removed July 2026.
 */
import { sendTelnyxSms, telnyxConfigured } from "../services/telnyxSms";
import {
  sendAndRecordSms,
  logOutboundBestEffort,
  isPhoneOptedOut,
  mechanicalSmsFrom,
  inboxPhoneMatch,
} from "../services/smsOutbound";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { smsContacts, smsCampaigns, smsSends, scheduledSends, smsInboxMessages } from "../../drizzle/schema";
import { eq, desc, and, gte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

type DbInstance = ReturnType<typeof drizzle>;



// Normalize phone to E.164 US format (+1XXXXXXXXXX)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return ten;
  return `+1${ten}`;
}

/** The last 10 digits of any phone string — the stable conversation identity.
 *  +19735181815, 19735181815, 9735181815, and (973) 518-1815 all collapse to
 *  "9735181815". Exported for tests. */
export function last10Digits(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}
/** Last-10-digit SQL match against a (possibly formatted) phone column, so a
 *  conversation resolves regardless of how the row's phone was stored. Mirrors
 *  the same helper used by the inbound webhook (services/smsWebhook.ts). */
function last10Match(column: unknown, raw: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${last10Digits(raw)}`;
}
/** A raw phone string carries enough digits to identify a US number. Exported
 *  for tests. */
export function hasFullPhone(raw: string | undefined | null): raw is string {
  return !!raw && raw.replace(/\D/g, "").length >= 10;
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

export const smsCampaignsRouter = router({
  // ── Quota / Balance ───────────────────────────────────────────────────────
  getQuota: protectedProcedure.query(async () => {
    // Telnyx is pay-as-you-go: no prepaid quota. quotaRemaining=null signals
    // "unlimited/PAYG" to the UI. success reflects whether creds are set.
    return { quotaRemaining: null as number | null, success: telnyxConfigured(), provider: "telnyx" as const };
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
        deliveryStatus: result.success ? "accepted" : null,
        textBeltId: result.messageId ?? null,
        errorMessage: result.error ?? null,
        quotaRemaining: result.quotaRemaining ?? null,
      });

      // Also surface this send in the 2-Way Inbox thread (best-effort).
      await logOutboundBestEffort(db, {
        phone: contact.phone,
        message: personalizedMsg,
        fromNumber: mechanicalSmsFrom(),
        telnyxMessageId: result.messageId ?? null,
        deliveryStatus: result.success ? "accepted" : "failed",
        source: "campaign",
        contactId: input.contactId,
        sentByName: "Campaign",
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
          const result = await sendViaTelnyx(contact.phone, personalizedMsg);

          await db.insert(smsSends).values({
            contactId,
            campaignId: input.campaignId ?? null,
            messageNum: input.messageNum,
            messageText: personalizedMsg,
            phone: contact.phone,
            status: result.success ? "sent" : "failed",
            deliveryStatus: result.success ? "accepted" : null,
            textBeltId: result.messageId ?? null,
            errorMessage: result.error ?? null,
            quotaRemaining: null,
          });

          // Mirror the send into the 2-Way Inbox thread (best-effort).
          await logOutboundBestEffort(db, {
            phone: contact.phone,
            message: personalizedMsg,
            fromNumber: mechanicalSmsFrom(),
            telnyxMessageId: result.messageId ?? null,
            deliveryStatus: result.success ? "accepted" : "failed",
            source: "campaign",
            contactId,
            sentByName: "Campaign",
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
      // A conversation is identified by its normalized phone number. contactId
      // is kept for backwards compatibility but a phone-only thread (number not
      // in Contacts) must still return its full history — a contact record is
      // NOT required to view a thread.
      phone: z.string().optional(),
      contactId: z.number().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      // Prefer phone: every inbox row (inbound + outbound) stores the number in
      // E.164, so a last-10 match returns the complete chronological thread even
      // for rows whose contactId is null (unknown number) or was linked later.
      if (hasFullPhone(input.phone)) {
        return db
          .select()
          .from(smsInboxMessages)
          .where(inboxPhoneMatch(input.phone))
          .orderBy(desc(smsInboxMessages.createdAt))
          .limit(input.limit);
      }
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
    // Accept phone OR contactId so unknown-number conversations (contactId null)
    // can still be marked read. Phone takes precedence and scopes by last-10.
    .input(z.object({
      phone: z.string().optional(),
      contactId: z.number().optional(),
    }).refine((v) => hasFullPhone(v.phone) || v.contactId != null, {
      message: "phone or contactId is required",
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const target = hasFullPhone(input.phone)
        ? inboxPhoneMatch(input.phone)
        : eq(smsInboxMessages.contactId, input.contactId!);
      await db
        .update(smsInboxMessages)
        .set({ isRead: true })
        .where(and(target, eq(smsInboxMessages.isRead, false)));
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

      const result = await sendViaTelnyx(contact.phone, input.message);

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

  /**
   * Reply to a conversation by PHONE — works even when the number is NOT a saved
   * SMS contact (contactId null). Opt-out is enforced before sending; the sent
   * message is recorded as an outbound Inbox row so it appears in the thread.
   */
  replyToConversation: protectedProcedure
    .input(z.object({
      phone: z.string(),
      contactId: z.number().optional(),
      message: z.string().min(1),
      sentByName: z.string().optional(),
    }).refine((v) => hasFullPhone(v.phone), { message: "A valid phone number is required" }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Resolve a contactId from the phone when not supplied (read-only; never
      // creates a contact — unknown numbers stay unlinked).
      let contactId = input.contactId ?? null;
      if (contactId == null) {
        const [c] = await db
          .select({ id: smsContacts.id })
          .from(smsContacts)
          .where(last10Match(smsContacts.phone, input.phone))
          .limit(1);
        contactId = c?.id ?? null;
      }

      const res = await sendAndRecordSms(db, {
        phone: input.phone,
        message: input.message,
        source: "inbox_reply",
        contactId,
        sentByName: input.sentByName ?? "Team",
      });

      // Opted-out numbers are refused outright (nothing sent or recorded).
      if (res.blocked) throw new Error(res.error ?? "This number has opted out of SMS.");
      return { success: res.success, error: res.error ?? null, messageId: res.messageId ?? null };
    }),

  /**
   * Send-eligibility for a conversation phone: whether it is opted out (block
   * sending), whether it is a saved contact, and which Mechanical sender number
   * outbound messages will come from.
   */
  conversationSendState: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const fromNumber = mechanicalSmsFrom();
      if (!hasFullPhone(input.phone)) {
        return { optedOut: false, isContact: false, contactId: null as number | null, fromNumber };
      }
      const [contact] = await db
        .select({ id: smsContacts.id })
        .from(smsContacts)
        .where(last10Match(smsContacts.phone, input.phone))
        .limit(1);
      const optedOut = await isPhoneOptedOut(db, input.phone);
      return { optedOut, isContact: !!contact, contactId: contact?.id ?? null, fromNumber };
    }),

  getConversations: protectedProcedure.query(async () => {
    // Returns one conversation per phone number that has inbox messages, with
    // latest message and unread count.
    const db = await requireDb();
    const messages = await db
      .select()
      .from(smsInboxMessages)
      .orderBy(desc(smsInboxMessages.createdAt))
      .limit(500);

    // Group by NORMALIZED phone (last-10), NOT by contactId. A number whose
    // history is partly linked to a contact and partly unlinked (rows that
    // arrived before the contact existed, contactId null) must collapse into a
    // SINGLE conversation — not split into a "c:<id>" and a "p:<phone>" entry.
    // This matches the phone-based detail thread: one list row ⇄ one thread.
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
      const key = last10Digits(msg.phone) || `raw:${msg.phone}`;
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
      // Adopt a contact link from ANY row for this number, so a conversation
      // with even one linked row shows the contact name and allows replying.
      if (conv.contactId == null && msg.contactId != null) conv.contactId = msg.contactId;
      // Prefer an E.164-formatted phone for display if one exists on any row.
      if (!conv.phone.startsWith("+") && msg.phone.startsWith("+")) conv.phone = msg.phone;
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
