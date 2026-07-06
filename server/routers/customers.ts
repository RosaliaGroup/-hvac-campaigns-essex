import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  customers,
  properties,
  appointments,
  leads,
  leadCaptures,
  callLogs,
  rebateCalculations,
  type InsertCustomer,
} from "../../drizzle/schema";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────

/** Strip a phone number down to its digits; compare on the last 10. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null; // too short to be a real match key
  return digits.slice(-10);
}

/** Split a free-text full name into first/last ("Mary Ann Smith" → "Mary Ann" / "Smith"). */
export function splitName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const trimmed = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** displayName = companyName, else "First Last", else email/phone fallback. Never empty. */
export function buildDisplayName(c: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  if (c.companyName?.trim()) return c.companyName.trim();
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return c.email?.trim() || c.phone?.trim() || "Unnamed Customer";
}

// ─────────────────────────────────────────────────────────────
// Shared query helpers
// ─────────────────────────────────────────────────────────────

/**
 * Find an existing customer by phone (last-10-digit match) or email
 * (case-insensitive). Used to dedupe on conversion.
 */
async function findExistingCustomer(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  phone: string | null | undefined,
  email: string | null | undefined,
) {
  const phoneKey = normalizePhone(phone);
  const emailKey = email?.trim().toLowerCase() || null;
  const conditions = [];
  if (phoneKey) {
    // MySQL 8 / TiDB: compare last 10 digits after stripping non-digits
    conditions.push(sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneKey}`);
  }
  if (emailKey) {
    conditions.push(sql`LOWER(${customers.email}) = ${emailKey}`);
  }
  if (conditions.length === 0) return null;
  const rows = await db
    .select()
    .from(customers)
    .where(or(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

const customerInput = z.object({
  type: z.enum(["residential", "commercial"]).default("residential"),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
  companyName: z.string().max(255).optional().nullable(),
  email: z.string().email().max(320).optional().nullable().or(z.literal("").transform(() => null)),
  phone: z.string().max(50).optional().nullable(),
  altPhone: z.string().max(50).optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.number().int().optional().nullable(),
});

const propertyInput = z.object({
  label: z.string().max(255).optional().nullable(),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(10).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  propertyType: z.enum(["residential", "commercial"]).default("residential"),
  squareFeet: z.number().int().positive().optional().nullable(),
  existingSystem: z.string().max(255).optional().nullable(),
  systemNotes: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

/**
 * Auto-link helper: resolve a raw phone number to an existing customer id.
 * Used by appointments (staff + Vapi) to attach bookings to customers.
 * Never throws.
 */
export async function findCustomerIdByPhone(phone: string | null | undefined): Promise<number | null> {
  try {
    const phoneKey = normalizePhone(phone);
    if (!phoneKey) return null;
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneKey}`)
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export const customersRouter = router({
  /** Paginated, searchable customer list. */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().max(255).optional(),
        type: z.enum(["residential", "commercial"]).optional(),
        status: z.enum(["active", "inactive", "archived"]).optional(),
        assignedToId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).default({ limit: 50, offset: 0 }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(customers.displayName, q),
            like(customers.email, q),
            like(customers.phone, q),
            like(customers.companyName, q),
          ),
        );
      }
      if (input.type) conditions.push(eq(customers.type, input.type));
      // Default: hide archived unless explicitly requested
      conditions.push(input.status ? eq(customers.status, input.status) : sql`${customers.status} != 'archived'`);
      if (input.assignedToId) conditions.push(eq(customers.assignedToId, input.assignedToId));

      const where = and(...conditions);
      const [items, totalRows] = await Promise.all([
        db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(where),
      ]);
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  /** 360° view: customer + properties + related records. */
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
      const customer = rows[0];
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      const [props, appts, relatedLeads, relatedCaptures, calls, rebates] = await Promise.all([
        db.select().from(properties).where(eq(properties.customerId, input.id)).orderBy(desc(properties.isPrimary), desc(properties.createdAt)),
        db.select().from(appointments).where(eq(appointments.customerId, input.id)).orderBy(desc(appointments.createdAt)).limit(50),
        db.select().from(leads).where(eq(leads.customerId, input.id)).orderBy(desc(leads.createdAt)).limit(50),
        db.select().from(leadCaptures).where(eq(leadCaptures.customerId, input.id)).orderBy(desc(leadCaptures.createdAt)).limit(50),
        db.select().from(callLogs).where(eq(callLogs.customerId, input.id)).orderBy(desc(callLogs.createdAt)).limit(50),
        db.select().from(rebateCalculations).where(eq(rebateCalculations.customerId, input.id)).orderBy(desc(rebateCalculations.createdAt)).limit(20),
      ]);

      return { customer, properties: props, appointments: appts, leads: relatedLeads, captures: relatedCaptures, callLogs: calls, rebateCalculations: rebates };
    }),

  create: protectedProcedure.input(customerInput).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const values: InsertCustomer = {
      ...input,
      displayName: buildDisplayName(input),
    };
    const result = await db.insert(customers).values(values);
    const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    return { id };
  }),

  update: protectedProcedure
    .input(customerInput.partial().extend({ id: z.number().int(), status: z.enum(["active", "inactive", "archived"]).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...patch } = input;
      const existing = (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      const merged = { ...existing, ...patch };
      await db
        .update(customers)
        .set({ ...patch, displayName: buildDisplayName(merged) })
        .where(eq(customers.id, id));
      return { success: true };
    }),

  /** Soft delete — never hard-delete a customer. */
  archive: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(customers).set({ status: "archived" }).where(eq(customers.id, input.id));
      return { success: true };
    }),

  // ── Properties ──────────────────────────────────────────────

  addProperty: protectedProcedure
    .input(propertyInput.extend({ customerId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const owner = (await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
      if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      if (input.isPrimary) {
        await db.update(properties).set({ isPrimary: false }).where(eq(properties.customerId, input.customerId));
      }
      const result = await db.insert(properties).values(input);
      const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      return { id };
    }),

  updateProperty: protectedProcedure
    .input(propertyInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...patch } = input;
      const existing = (await db.select().from(properties).where(eq(properties.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

      if (patch.isPrimary) {
        await db.update(properties).set({ isPrimary: false }).where(eq(properties.customerId, existing.customerId));
      }
      await db.update(properties).set(patch).where(eq(properties.id, id));
      return { success: true };
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const referenced = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(appointments)
        .where(eq(appointments.propertyId, input.id));
      if (Number(referenced[0]?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This property has appointments linked to it and cannot be deleted.",
        });
      }
      await db.delete(properties).where(eq(properties.id, input.id));
      return { success: true };
    }),

  // ── Conversion (with dedupe) ────────────────────────────────

  /**
   * Convert a `leads` row into a customer. If a customer already matches
   * on phone or email, LINK to it instead of creating a duplicate.
   * The lead's own status is left unchanged.
   */
  convertFromLead: protectedProcedure
    .input(z.object({ leadId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const lead = (await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      if (lead.customerId) return { customerId: lead.customerId, merged: true, alreadyConverted: true };

      const phone = lead.contactType === "phone" ? lead.contact : null;
      const email = lead.contactType === "email" ? lead.contact : null;

      const existing = await findExistingCustomer(db, phone, email);
      let customerId: number;
      let merged = false;

      if (existing) {
        customerId = existing.id;
        merged = true;
      } else {
        const { firstName, lastName } = splitName(lead.name);
        const values: InsertCustomer = {
          type: "residential",
          firstName,
          lastName,
          displayName: buildDisplayName({ firstName, lastName, email, phone }),
          email,
          phone,
          source: lead.source,
          notes: lead.notes,
          convertedFromLeadId: lead.id,
        };
        const result = await db.insert(customers).values(values);
        customerId = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      }

      await db.update(leads).set({ customerId, convertedAt: new Date() }).where(eq(leads.id, lead.id));
      return { customerId, merged, alreadyConverted: false };
    }),

  /** Convert a `leadCaptures` row into a customer, with the same dedupe rule. */
  convertFromCapture: protectedProcedure
    .input(z.object({ captureId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const capture = (await db.select().from(leadCaptures).where(eq(leadCaptures.id, input.captureId)).limit(1))[0];
      if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Lead capture not found" });
      if (capture.customerId) return { customerId: capture.customerId, merged: true, alreadyConverted: true };

      const existing = await findExistingCustomer(db, capture.phone, capture.email);
      let customerId: number;
      let merged = false;

      if (existing) {
        customerId = existing.id;
        merged = true;
      } else {
        // Prefer explicit first/last; fall back to splitting `name`
        const fromSplit = splitName(capture.name);
        const firstName = capture.firstName || fromSplit.firstName;
        const lastName = capture.lastName || fromSplit.lastName;
        const isCommercial = capture.captureType?.includes("commercial") ?? false;
        const values: InsertCustomer = {
          type: isCommercial ? "commercial" : "residential",
          firstName,
          lastName,
          displayName: buildDisplayName({ firstName, lastName, email: capture.email, phone: capture.phone }),
          email: capture.email,
          phone: capture.phone,
          source: capture.captureType,
          notes: capture.notes,
          convertedFromCaptureId: capture.id,
        };
        const result = await db.insert(customers).values(values);
        customerId = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      }

      await db.update(leadCaptures).set({ customerId, convertedAt: new Date() }).where(eq(leadCaptures.id, capture.id));
      return { customerId, merged, alreadyConverted: false };
    }),

  /** Dashboard counts by type and status. */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, residential: 0, commercial: 0, active: 0, archived: 0 };

    const rows = await db
      .select({
        type: customers.type,
        status: customers.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(customers)
      .groupBy(customers.type, customers.status);

    const stats = { total: 0, residential: 0, commercial: 0, active: 0, archived: 0 };
    for (const row of rows) {
      const n = Number(row.count);
      stats.total += n;
      if (row.type === "residential") stats.residential += n;
      if (row.type === "commercial") stats.commercial += n;
      if (row.status === "active") stats.active += n;
      if (row.status === "archived") stats.archived += n;
    }
    return stats;
  }),
});
