/**
 * Conversation → CRM router (Phase 2).
 *
 * Read: `context` resolves a conversation phone to its CRM workspace (linked
 * customer/lead, property, appointment, job, estimate, invoice + candidate
 * matches for the ambiguity selector). Lazy-loaded by the Inbox after the
 * thread renders — it never blocks Phase-1 conversation loading.
 *
 * Write (explicit user actions only — never automatic): `link`/`unlink` set or
 * clear a confirmed CRM link, `selectProperty` remembers a property choice, and
 * the `quickCreate*` procedures create a Lead/Customer/Property prefilled from
 * the conversation and auto-link it.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  smsConversationLinks, leads, customers, properties,
} from "../../drizzle/schema";
import { normalizePhone, splitName, buildDisplayName } from "./customers";
import { resolveConversationContext, matchByPhone } from "../services/conversationCrm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}
type Db = Awaited<ReturnType<typeof requireDb>>;

/** Upsert the conversation link row (keyed by phoneLast10) with a partial patch. */
async function upsertLink(db: Db, l10: string, patch: Record<string, unknown>) {
  await db
    .insert(smsConversationLinks)
    .values({ phoneLast10: l10, ...patch })
    .onDuplicateKeyUpdate({ set: { ...patch, updatedAt: new Date() } });
}

export const conversationCrmRouter = router({
  /** Resolve the CRM workspace for a conversation phone (lazy, read-only). */
  context: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      return resolveConversationContext(db, input.phone);
    }),

  /** Candidate matches only (used to refresh the selector). */
  matches: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      return matchByPhone(db, input.phone);
    }),

  /** Confirm a CRM link (explicit user action). Overwrites only what the user
   *  chose; other link fields are preserved. */
  link: protectedProcedure
    .input(z.object({
      phone: z.string(),
      target: z.enum(["customer", "lead", "leadCapture"]),
      id: z.number(),
      linkedByName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      const col = input.target === "customer" ? "customerId" : input.target === "lead" ? "leadId" : "leadCaptureId";
      await upsertLink(db, l10, { [col]: input.id, linkedByName: input.linkedByName ?? "Team" });
      return { success: true };
    }),

  /** Clear a conversation's CRM link (a specific target, or all of them). */
  unlink: protectedProcedure
    .input(z.object({ phone: z.string(), target: z.enum(["customer", "lead", "leadCapture", "property", "all"]).default("all") }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      const patch: Record<string, unknown> =
        input.target === "all"
          ? { customerId: null, leadId: null, leadCaptureId: null, propertyId: null }
          : { [input.target === "customer" ? "customerId" : input.target === "lead" ? "leadId" : input.target === "leadCapture" ? "leadCaptureId" : "propertyId"]: null };
      await db.update(smsConversationLinks).set({ ...patch, updatedAt: new Date() }).where(eq(smsConversationLinks.phoneLast10, l10));
      return { success: true };
    }),

  /** Remember the selected property for this conversation. */
  selectProperty: protectedProcedure
    .input(z.object({ phone: z.string(), propertyId: z.number() }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      await upsertLink(db, l10, { propertyId: input.propertyId });
      return { success: true };
    }),

  /** Create a Lead from the conversation (prefilled) and auto-link it. */
  quickCreateLead: protectedProcedure
    .input(z.object({ phone: z.string(), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      const [res] = await db.insert(leads).values({
        name: input.name?.trim() || `SMS ${input.phone.slice(-4)}`,
        contact: input.phone,
        contactType: "phone",
        source: "sms",
        service: "SMS Inquiry",
        status: "new",
      });
      const leadId = (res as { insertId: number }).insertId;
      await upsertLink(db, l10, { leadId, linkedByName: "Team" });
      return { success: true, leadId };
    }),

  /** Create a Customer (and optional Property) from the conversation, auto-link. */
  quickCreateCustomer: protectedProcedure
    .input(z.object({ phone: z.string(), name: z.string().optional(), address: z.string().optional() }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      const { firstName, lastName } = splitName(input.name);
      const displayName = buildDisplayName({ firstName, lastName, phone: input.phone });
      const [res] = await db.insert(customers).values({
        displayName, firstName, lastName, phone: input.phone, type: "residential", status: "active",
      });
      const customerId = (res as { insertId: number }).insertId;

      let propertyId: number | undefined;
      if (input.address?.trim()) {
        const [pr] = await db.insert(properties).values({
          customerId, addressLine1: input.address.trim(), label: "Home", propertyType: "residential", isPrimary: true,
        });
        propertyId = (pr as { insertId: number }).insertId;
      }
      await upsertLink(db, l10, { customerId, propertyId: propertyId ?? null, linkedByName: "Team" });
      return { success: true, customerId, propertyId: propertyId ?? null };
    }),

  /** Add a Property to the linked customer and remember it for the conversation. */
  quickCreateProperty: protectedProcedure
    .input(z.object({
      phone: z.string(), customerId: z.number(), addressLine1: z.string().min(1),
      city: z.string().optional(), state: z.string().optional(), zip: z.string().optional(), label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const l10 = normalizePhone(input.phone);
      if (!l10) throw new Error("A valid phone number is required");
      const db = await requireDb();
      const [pr] = await db.insert(properties).values({
        customerId: input.customerId, addressLine1: input.addressLine1.trim(),
        city: input.city ?? null, state: input.state ?? "NJ", zip: input.zip ?? null,
        label: input.label ?? "Property", propertyType: "residential", isPrimary: false,
      });
      const propertyId = (pr as { insertId: number }).insertId;
      await upsertLink(db, l10, { propertyId });
      return { success: true, propertyId };
    }),
});
