/**
 * Conversation → CRM router (Phase 2).
 *
 * Read: `context`/`matches` resolve a conversation phone to its CRM workspace +
 * candidate matches. Lazy-loaded by the Inbox after the thread renders.
 *
 * Write (explicit, authenticated office actions only — never automatic):
 *  - `link`/`unlink` set or clear a CONFIRMED link, stored by stable record id.
 *    The server validates that the target record EXISTS before linking, records
 *    an audit actor from the authenticated context (never client-supplied), and
 *    clears a remembered property that no longer belongs to a newly-linked
 *    customer (no internally-inconsistent links).
 *  - `selectProperty` only accepts a property that belongs to the linked customer.
 *  - `quickCreate*` DEDUPE by normalized phone/address and refuse to create a
 *    likely duplicate without an explicit `force` flag (a retry therefore cannot
 *    silently create a second record), then auto-link the result.
 */
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  smsConversationLinks, leads, leadCaptures, customers, properties,
} from "../../drizzle/schema";
import { normalizePhone, splitName, buildDisplayName, findCustomerIdByPhone } from "./customers";
import { resolveConversationContext, matchByPhone } from "../services/conversationCrm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}
type Db = Awaited<ReturnType<typeof requireDb>>;

function phoneMatch(column: unknown, l10: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${l10}`;
}
function requireL10(phone: string): string {
  const l10 = normalizePhone(phone);
  if (!l10) throw new Error("A valid phone number is required");
  return l10;
}
// Actor name for audit — always from the authenticated context, never the client.
function actor(ctx: { user?: { name?: string | null; email?: string | null } | null }): string {
  return ctx.user?.name ?? ctx.user?.email ?? "office";
}

/** Upsert the link row (keyed by phoneLast10). createdBy is set once (insert);
 *  updatedBy on every change. */
async function upsertLink(db: Db, l10: string, patch: Record<string, unknown>, by: string) {
  await db
    .insert(smsConversationLinks)
    .values({ phoneLast10: l10, createdBy: by, updatedBy: by, ...patch })
    .onDuplicateKeyUpdate({ set: { ...patch, updatedBy: by, updatedAt: new Date() } });
}

async function currentLink(db: Db, l10: string) {
  const [row] = await db.select().from(smsConversationLinks).where(eq(smsConversationLinks.phoneLast10, l10)).limit(1);
  return row ?? null;
}
async function propertyBelongsTo(db: Db, propertyId: number, customerId: number): Promise<boolean> {
  const [p] = await db.select({ id: properties.id }).from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.customerId, customerId))).limit(1);
  return !!p;
}

export const conversationCrmRouter = router({
  context: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => resolveConversationContext(await requireDb(), input.phone)),

  matches: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => matchByPhone(await requireDb(), input.phone)),

  /** Confirm a CRM link (explicit action). Validates the target exists; on a new
   *  customer, clears a remembered property that isn't that customer's. */
  link: protectedProcedure
    .input(z.object({ phone: z.string(), target: z.enum(["customer", "lead", "leadCapture"]), id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();

      // Server-side existence validation of the target id.
      const table = input.target === "customer" ? customers : input.target === "lead" ? leads : leadCaptures;
      const [exists] = await db.select({ id: table.id }).from(table).where(eq(table.id, input.id)).limit(1);
      if (!exists) throw new Error(`${input.target} #${input.id} not found`);

      const col = input.target === "customer" ? "customerId" : input.target === "lead" ? "leadId" : "leadCaptureId";
      const patch: Record<string, unknown> = { [col]: input.id };

      // Consistency: if switching customer, drop a property that isn't the new customer's.
      if (input.target === "customer") {
        const link = await currentLink(db, l10);
        if (link?.propertyId && !(await propertyBelongsTo(db, link.propertyId, input.id))) {
          patch.propertyId = null;
        }
      }
      await upsertLink(db, l10, patch, actor(ctx));
      return { success: true };
    }),

  unlink: protectedProcedure
    .input(z.object({ phone: z.string(), target: z.enum(["customer", "lead", "leadCapture", "property", "all"]).default("all") }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();
      const patch: Record<string, unknown> =
        input.target === "all"
          ? { customerId: null, leadId: null, leadCaptureId: null, propertyId: null }
          : { [input.target === "customer" ? "customerId" : input.target === "lead" ? "leadId" : input.target === "leadCapture" ? "leadCaptureId" : "propertyId"]: null };
      await db.update(smsConversationLinks).set({ ...patch, updatedBy: actor(ctx), updatedAt: new Date() }).where(eq(smsConversationLinks.phoneLast10, l10));
      return { success: true };
    }),

  /** Remember a property — only if it belongs to the conversation's linked customer. */
  selectProperty: protectedProcedure
    .input(z.object({ phone: z.string(), propertyId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();
      const link = await currentLink(db, l10);
      if (!link?.customerId) throw new Error("Link a customer before selecting a property");
      if (!(await propertyBelongsTo(db, input.propertyId, link.customerId))) {
        throw new Error("That property does not belong to the linked customer");
      }
      await upsertLink(db, l10, { propertyId: input.propertyId }, actor(ctx));
      return { success: true };
    }),

  /** Create a Lead (deduped by phone) and auto-link. */
  quickCreateLead: protectedProcedure
    .input(z.object({ phone: z.string(), name: z.string().optional(), force: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();
      if (!input.force) {
        const dups = await db.select({ id: leads.id, name: leads.name }).from(leads)
          .where(and(eq(leads.contactType, "phone"), phoneMatch(leads.contact, l10))).limit(5);
        if (dups.length) return { duplicate: true as const, candidates: dups.map((d) => ({ id: d.id, name: d.name })) };
      }
      const [res] = await db.insert(leads).values({
        name: input.name?.trim() || `SMS ${input.phone.slice(-4)}`,
        contact: input.phone, contactType: "phone", source: "sms", service: "SMS Inquiry", status: "new",
      });
      const leadId = (res as { insertId: number }).insertId;
      await upsertLink(db, l10, { leadId }, actor(ctx));
      return { success: true as const, leadId };
    }),

  /** Create a Customer (+optional Property), deduped by phone, and auto-link. */
  quickCreateCustomer: protectedProcedure
    .input(z.object({ phone: z.string(), name: z.string().optional(), address: z.string().optional(), force: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();
      if (!input.force) {
        const existingId = await findCustomerIdByPhone(input.phone);
        if (existingId) {
          const [c] = await db.select({ id: customers.id, name: customers.displayName }).from(customers).where(eq(customers.id, existingId)).limit(1);
          return { duplicate: true as const, candidates: c ? [{ id: c.id, name: c.name }] : [] };
        }
      }
      const { firstName, lastName } = splitName(input.name);
      const displayName = buildDisplayName({ firstName, lastName, phone: input.phone });
      const [res] = await db.insert(customers).values({ displayName, firstName, lastName, phone: input.phone, type: "residential", status: "active" });
      const customerId = (res as { insertId: number }).insertId;

      let propertyId: number | undefined;
      if (input.address?.trim()) {
        const [pr] = await db.insert(properties).values({ customerId, addressLine1: input.address.trim(), label: "Home", propertyType: "residential", isPrimary: true });
        propertyId = (pr as { insertId: number }).insertId;
      }
      await upsertLink(db, l10, { customerId, propertyId: propertyId ?? null }, actor(ctx));
      return { success: true as const, customerId, propertyId: propertyId ?? null };
    }),

  /** Add a Property to the conversation's LINKED customer and remember it. */
  quickCreateProperty: protectedProcedure
    .input(z.object({
      phone: z.string(), addressLine1: z.string().min(1),
      city: z.string().optional(), state: z.string().optional(), zip: z.string().optional(), label: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const l10 = requireL10(input.phone);
      const db = await requireDb();
      // The customer comes from the confirmed link — not the client — so a property
      // can never be attached to a customer the conversation isn't linked to.
      const link = await currentLink(db, l10);
      if (!link?.customerId) throw new Error("Link a customer before adding a property");
      const [pr] = await db.insert(properties).values({
        customerId: link.customerId, addressLine1: input.addressLine1.trim(),
        city: input.city ?? null, state: input.state ?? "NJ", zip: input.zip ?? null,
        label: input.label ?? "Property", propertyType: "residential", isPrimary: false,
      });
      const propertyId = (pr as { insertId: number }).insertId;
      await upsertLink(db, l10, { propertyId }, actor(ctx));
      return { success: true, propertyId };
    }),
});
