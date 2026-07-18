import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { toPatch } from "../_core/zodPatch";
import {
  customers,
  properties,
  appointments,
  jobs,
  leads,
  leadCaptures,
  callLogs,
  rebateCalculations,
  opportunities,
  quickbooksSalesDocuments,
  type InsertCustomer,
} from "../../drizzle/schema";
import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { formatPropertyAddress } from "@shared/address";
import { deriveContactRelationship, type Relationship } from "@shared/leadPipeline";
import { assembleCustomerRelations } from "./customerRelations";

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

/**
 * Does an appointment belong to a given lead/contact? Links, in priority order:
 *  1. customerId (both sides linked to the same customer record)
 *  2. phone (last-10-digit match)
 *  3. email (case-insensitive)
 * Pure — the same rule the SQL fallback query encodes, exported for tests.
 */
export function appointmentMatchesLead(
  appt: { customerId?: number | null; phone?: string | null; email?: string | null },
  lead: { customerId?: number | null; phone?: string | null; email?: string | null },
): boolean {
  if (lead.customerId != null && appt.customerId != null && lead.customerId === appt.customerId) return true;
  const lp = normalizePhone(lead.phone);
  const ap = normalizePhone(appt.phone);
  if (lp && ap && lp === ap) return true;
  const le = lead.email?.trim().toLowerCase() || null;
  const ae = appt.email?.trim().toLowerCase() || null;
  if (le && ae && le === ae) return true;
  return false;
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

/**
 * Pure predicate mirroring the WHERE clause of relinkAppointmentsToCustomer:
 * an appointment is relinked to the converting lead's customer ONLY when it is
 * not already linked (customerId == null) AND it matches the lead by last-10
 * phone or case-insensitive email. Exported for tests. Keep in lockstep with
 * the SQL in relinkAppointmentsToCustomer below.
 */
export function appointmentQualifiesForRelink(
  appt: { customerId?: number | null; phone?: string | null; email?: string | null },
  target: { phone?: string | null; email?: string | null },
): boolean {
  if (appt.customerId != null) return false;
  const tp = normalizePhone(target.phone);
  const ap = normalizePhone(appt.phone);
  if (tp && ap && tp === ap) return true;
  const te = target.email?.trim().toLowerCase() || null;
  const ae = appt.email?.trim().toLowerCase() || null;
  if (te && ae && te === ae) return true;
  return false;
}

/**
 * Re-point appointments to a customer on lead conversion, using the same
 * relationship model applied elsewhere (last-10-digit phone match,
 * case-insensitive email — see appointmentQualifiesForRelink). Only appointments
 * that are NOT already linked (customerId IS NULL) are touched, so an appointment
 * already attributed to a different customer is never stolen. Returns the number
 * of rows relinked. (Call logs are intentionally NOT relinked here — see
 * convertFromLead.)
 */
async function relinkAppointmentsToCustomer(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  customerId: number,
  phone: string | null | undefined,
  email: string | null | undefined,
): Promise<number> {
  const phoneKey = normalizePhone(phone);
  const emailKey = email?.trim().toLowerCase() || null;
  const matchers = [];
  if (phoneKey) {
    matchers.push(sql`RIGHT(REGEXP_REPLACE(${appointments.phone}, '[^0-9]', ''), 10) = ${phoneKey}`);
  }
  if (emailKey) {
    matchers.push(sql`LOWER(${appointments.email}) = ${emailKey}`);
  }
  if (matchers.length === 0) return 0;
  const result = await db
    .update(appointments)
    .set({ customerId })
    .where(and(isNull(appointments.customerId), or(...matchers)));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
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

/**
 * A person whose relationship we want to derive. Used identically for a Contact
 * (a `customers` row, keyed by its own id) and a Lead Inbox row (a `leadCaptures`
 * row). Both screens funnel through the SAME derivation so a person can never
 * read as Lead in one place and Prospect in another.
 */
export interface RelationshipEntity {
  id: number;
  customerId?: number | null;
  phone?: string | null;
  email?: string | null;
  /** Every lead-capture stage tied to this person (for a lead, just its own). */
  leadStages: (string | null | undefined)[];
}

/**
 * Pure per-entity relationship: appointment match (customerId → phone → email)
 * + linked job outcomes + lead stages, all fed to the shared
 * deriveContactRelationship. Exported for tests. This is the single source of
 * truth shared by the Contacts list and the Lead Inbox.
 */
export function relationshipForEntity(
  entity: RelationshipEntity,
  appts: Array<{ customerId?: number | null; phone?: string | null; email?: string | null }>,
  jobStatusesByCustomerId: Map<number, string[]>,
): Relationship {
  const hasAppointment = appts.some(a => appointmentMatchesLead(a, entity));
  const jobStatuses = entity.customerId != null ? (jobStatusesByCustomerId.get(entity.customerId) ?? []) : [];
  return deriveContactRelationship({ leadStages: entity.leadStages, jobStatuses, hasAppointment });
}

/**
 * Batch-derive relationships for many entities with the same signals in both
 * screens: appointments (matched by customerId OR phone/email fallback) and
 * jobs linked to the person's customer record.
 */
export async function computeRelationships(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  entities: RelationshipEntity[],
): Promise<Map<number, Relationship>> {
  const map = new Map<number, Relationship>();
  if (entities.length === 0) return map;

  const customerIds = Array.from(new Set(entities.map(e => e.customerId).filter((x): x is number => x != null)));
  const [appts, jbs] = await Promise.all([
    db.select({ customerId: appointments.customerId, phone: appointments.phone, email: appointments.email }).from(appointments),
    customerIds.length
      ? db.select({ customerId: jobs.customerId, status: jobs.status }).from(jobs).where(inArray(jobs.customerId, customerIds))
      : Promise.resolve([] as { customerId: number | null; status: string }[]),
  ]);

  const jobStatusByCustomer = new Map<number, string[]>();
  for (const j of jbs) {
    if (j.customerId == null) continue;
    (jobStatusByCustomer.get(j.customerId) ?? jobStatusByCustomer.set(j.customerId, []).get(j.customerId)!).push(j.status);
  }

  for (const e of entities) {
    map.set(e.id, relationshipForEntity(e, appts, jobStatusByCustomer));
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export interface SchedulingResult {
  kind: "customer" | "lead";
  /** Stable key for the combobox, e.g. "customer:12" / "lead:7". */
  key: string;
  /** The linked customer id (a customer, or a CONVERTED lead); null for unconverted leads. */
  customerId: number | null;
  /** The underlying row id (customers.id or leadCaptures.id). */
  refId: number;
  displayName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  propertyType: "residential" | "commercial";
  /** Primary/first property address (customers only); "" for leads. */
  address: string;
}

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
      const [rows, totalRows] = await Promise.all([
        db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(where),
      ]);
      // Derive the true relationship (Lead/Prospect/Customer) from real signals
      // instead of assuming every contact is a Customer. Same helper the Lead
      // Inbox uses, so a person reads identically in both screens.
      const stagesByCustomer = new Map<number, string[]>();
      if (rows.length) {
        const caps = await db
          .select({ customerId: leadCaptures.customerId, status: leadCaptures.status })
          .from(leadCaptures)
          .where(inArray(leadCaptures.customerId, rows.map(r => r.id)));
        for (const c of caps) {
          if (c.customerId == null) continue;
          (stagesByCustomer.get(c.customerId) ?? stagesByCustomer.set(c.customerId, []).get(c.customerId)!).push(c.status);
        }
      }
      const relationships = await computeRelationships(db, rows.map(r => ({
        id: r.id, customerId: r.id, phone: r.phone, email: r.email, leadStages: stagesByCustomer.get(r.id) ?? [],
      })));
      const items = rows.map(r => ({ ...r, relationship: relationships.get(r.id) ?? "lead" as Relationship }));
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  /**
   * Unified scheduler search: matches CUSTOMERS and lead captures (LEADS) by name,
   * company, phone, email, and address (incl. a customer's property addresses).
   * Converted leads carry their customerId so selecting them links the appointment.
   */
  searchForScheduling: protectedProcedure
    .input(z.object({ q: z.string().max(255), limit: z.number().int().min(1).max(25).default(10) }).default({ q: "", limit: 10 }))
    .query(async ({ input }): Promise<{ results: SchedulingResult[] }> => {
      const db = await getDb();
      if (!db) return { results: [] };
      const q = input.q.trim();
      if (q.length < 2) return { results: [] };
      const lk = `%${q}%`;
      const digits = q.replace(/\D/g, "");
      const phoneCond = digits.length >= 3 ? [sql`REGEXP_REPLACE(${customers.phone}, '[^0-9]', '') LIKE ${"%" + digits + "%"}`] : [];

      const custRows = await db
        .select({ id: customers.id, displayName: customers.displayName, companyName: customers.companyName, email: customers.email, phone: customers.phone, type: customers.type })
        .from(customers)
        .where(and(
          sql`${customers.status} != 'archived'`,
          or(
            like(customers.displayName, lk), like(customers.companyName, lk), like(customers.email, lk),
            like(customers.phone, lk), like(customers.billingLine1, lk), like(customers.billingCity, lk), like(customers.billingZip, lk),
            ...phoneCond,
          ),
        ))
        .limit(input.limit);

      // Customers matched by a property address.
      const propHits = await db
        .select({ customerId: properties.customerId })
        .from(properties)
        .where(or(like(properties.addressLine1, lk), like(properties.city, lk), like(properties.zip, lk)))
        .limit(input.limit);
      const haveIds = new Set(custRows.map(c => c.id));
      const extraIds = Array.from(new Set(propHits.map(p => p.customerId).filter((id): id is number => id != null && !haveIds.has(id))));
      const extraCust = extraIds.length
        ? await db.select({ id: customers.id, displayName: customers.displayName, companyName: customers.companyName, email: customers.email, phone: customers.phone, type: customers.type })
            .from(customers).where(and(inArray(customers.id, extraIds), sql`${customers.status} != 'archived'`))
        : [];
      const allCust = [...custRows, ...extraCust];

      // Primary/first property address per matched customer.
      const custIds = allCust.map(c => c.id);
      const addrByCustomer = new Map<number, string>();
      if (custIds.length) {
        const props = await db
          .select({ customerId: properties.customerId, addressLine1: properties.addressLine1, addressLine2: properties.addressLine2, city: properties.city, state: properties.state, zip: properties.zip, isPrimary: properties.isPrimary })
          .from(properties).where(inArray(properties.customerId, custIds)).orderBy(desc(properties.isPrimary), desc(properties.createdAt));
        for (const p of props) {
          if (p.customerId == null || addrByCustomer.has(p.customerId)) continue;
          addrByCustomer.set(p.customerId, formatPropertyAddress(p));
        }
      }

      const capRows = await db
        .select({ id: leadCaptures.id, name: leadCaptures.name, firstName: leadCaptures.firstName, lastName: leadCaptures.lastName, email: leadCaptures.email, phone: leadCaptures.phone, customerId: leadCaptures.customerId })
        .from(leadCaptures)
        .where(or(like(leadCaptures.name, lk), like(leadCaptures.firstName, lk), like(leadCaptures.lastName, lk), like(leadCaptures.email, lk), like(leadCaptures.phone, lk)))
        .limit(input.limit);

      const linkedIds = new Set(allCust.map(c => c.id));
      const results: SchedulingResult[] = [
        ...allCust.map((c): SchedulingResult => ({
          kind: "customer", key: `customer:${c.id}`, customerId: c.id, refId: c.id,
          displayName: c.displayName, companyName: c.companyName ?? null, phone: c.phone ?? null, email: c.email ?? null,
          propertyType: c.type, address: addrByCustomer.get(c.id) ?? "",
        })),
        ...capRows
          .filter(c => !(c.customerId != null && linkedIds.has(c.customerId)))
          .map((c): SchedulingResult => ({
            kind: "lead", key: `lead:${c.id}`, customerId: c.customerId ?? null, refId: c.id,
            displayName: c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Lead",
            companyName: null, phone: c.phone ?? null, email: c.email ?? null, propertyType: "residential", address: "",
          })),
      ].slice(0, input.limit);

      return { results };
    }),

  /** Properties for a single customer, with formatted address — powers the dialog property picker. */
  listProperties: protectedProcedure
    .input(z.object({ customerId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { properties: [] };
      const rows = await db.select().from(properties).where(eq(properties.customerId, input.customerId)).orderBy(desc(properties.isPrimary), desc(properties.createdAt));
      return {
        properties: rows.map(p => ({
          id: p.id, label: p.label, isPrimary: p.isPrimary, propertyType: p.propertyType,
          addressLine1: p.addressLine1, addressLine2: p.addressLine2, city: p.city, state: p.state, zip: p.zip,
          address: formatPropertyAddress(p),
        })),
      };
    }),

  /**
   * Create-or-match a customer + first property in one transaction, with dedupe by
   * normalized phone/email (customer) and addressLine1 (property). Surfaces a match
   * instead of creating a silent duplicate. Returns ids + normalized data for prefill.
   */
  createWithProperty: protectedProcedure
    .input(z.object({
      type: z.enum(["residential", "commercial"]).default("residential"),
      firstName: z.string().max(255).optional().nullable(),
      lastName: z.string().max(255).optional().nullable(),
      companyName: z.string().max(255).optional().nullable(),
      email: z.string().email().max(320).optional().nullable().or(z.literal("").transform(() => null)),
      phone: z.string().max(50).optional().nullable(),
      addressLine1: z.string().max(255).optional().nullable(),
      addressLine2: z.string().max(255).optional().nullable(),
      city: z.string().max(120).optional().nullable(),
      state: z.string().max(10).optional().nullable(),
      zip: z.string().max(20).optional().nullable(),
      propertyType: z.enum(["residential", "commercial"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await findExistingCustomer(db, input.phone, input.email);
      const firstName = input.firstName ?? null;
      const lastName = input.lastName ?? null;
      const displayName = buildDisplayName({ firstName, lastName, companyName: input.companyName, email: input.email, phone: input.phone });
      const hasAddress = Boolean(input.addressLine1?.trim());

      const result = await db.transaction(async (tx) => {
        let customerId: number;
        let mergedCustomer = false;
        if (existing) {
          customerId = existing.id;
          mergedCustomer = true;
        } else {
          const values: InsertCustomer = {
            type: input.type, firstName, lastName, companyName: input.companyName ?? null,
            displayName, email: input.email ?? null, phone: input.phone ?? null,
          };
          const ins = await tx.insert(customers).values(values);
          customerId = Number((ins as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
        }

        let propertyId: number | null = null;
        let mergedProperty = false;
        if (hasAddress) {
          const key = input.addressLine1!.trim().toLowerCase();
          const props = await tx.select({ id: properties.id, addressLine1: properties.addressLine1 }).from(properties).where(eq(properties.customerId, customerId));
          const match = props.find(p => (p.addressLine1 ?? "").trim().toLowerCase() === key);
          if (match) {
            propertyId = match.id;
            mergedProperty = true;
          } else {
            const isPrimary = props.length === 0;
            const pins = await tx.insert(properties).values({
              customerId, addressLine1: input.addressLine1!.trim(), addressLine2: input.addressLine2 ?? null,
              city: input.city ?? null, state: input.state ?? null, zip: input.zip ?? null,
              propertyType: input.propertyType ?? (input.type as "residential" | "commercial"), isPrimary,
            });
            propertyId = Number((pins as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
          }
        }
        return { customerId, propertyId, mergedCustomer, mergedProperty };
      });

      const custRow = (await db.select({ id: customers.id, displayName: customers.displayName, phone: customers.phone, email: customers.email, type: customers.type }).from(customers).where(eq(customers.id, result.customerId)).limit(1))[0];
      const propRow = result.propertyId
        ? (await db.select().from(properties).where(eq(properties.id, result.propertyId)).limit(1))[0]
        : null;
      return {
        ...result,
        customer: custRow ? { id: custRow.id, displayName: custRow.displayName, phone: custRow.phone, email: custRow.email, type: custRow.type } : null,
        property: propRow ? { id: propRow.id, propertyType: propRow.propertyType, address: formatPropertyAddress(propRow) } : null,
      };
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

      // Appointments link by customerId, or fall back to a phone/email match so
      // visits booked before conversion still surface under the contact.
      const phoneKey = normalizePhone(customer.phone);
      const emailKey = customer.email?.trim().toLowerCase() || null;
      const apptMatch = [eq(appointments.customerId, input.id)];
      if (phoneKey) apptMatch.push(sql`RIGHT(REGEXP_REPLACE(${appointments.phone}, '[^0-9]', ''), 10) = ${phoneKey}`);
      if (emailKey) apptMatch.push(sql`LOWER(${appointments.email}) = ${emailKey}`);

      // Sales documents (estimates/invoices) reconcile to this customer by:
      //  (a) the resolved local customerId FK,
      //  (b) the raw QBO CustomerRef == the customer's ref, and
      //  (c) the doc's PARENT ref == the customer's ref — i.e. an invoice/estimate
      //      filed under a QBO sub-customer / child project whose parent is this
      //      customer (the 351-vs-354 hierarchy case). Deduplicated in assembleCustomerRelations.
      // A doc RESOLVED to a customer (customerId set) attaches ONLY via that FK,
      // so a document can never be claimed by two customers. Ref / parent-ref
      // matching is a fallback for docs the sync could not resolve (customerId
      // IS NULL) — surfacing them under the right customer without double-claiming
      // any already-resolved document.
      const docMatch = [eq(quickbooksSalesDocuments.customerId, input.id)];
      if (customer.quickbooksCustomerId) {
        docMatch.push(
          and(
            isNull(quickbooksSalesDocuments.customerId),
            or(
              eq(quickbooksSalesDocuments.quickbooksCustomerId, customer.quickbooksCustomerId),
              eq(quickbooksSalesDocuments.quickbooksParentRef, customer.quickbooksCustomerId),
            ),
          )!,
        );
      }

      const [props, appts, relatedLeads, relatedCaptures, calls, rebates, relJobs, relOpps, relDocs] = await Promise.all([
        db.select().from(properties).where(eq(properties.customerId, input.id)).orderBy(desc(properties.isPrimary), desc(properties.createdAt)),
        db.select().from(appointments).where(or(...apptMatch)).orderBy(desc(appointments.scheduledAt), desc(appointments.createdAt)).limit(50),
        db.select().from(leads).where(eq(leads.customerId, input.id)).orderBy(desc(leads.createdAt)).limit(50),
        db.select().from(leadCaptures).where(eq(leadCaptures.customerId, input.id)).orderBy(desc(leadCaptures.createdAt)).limit(50),
        db.select().from(callLogs).where(eq(callLogs.customerId, input.id)).orderBy(desc(callLogs.createdAt)).limit(50),
        db.select().from(rebateCalculations).where(eq(rebateCalculations.customerId, input.id)).orderBy(desc(rebateCalculations.createdAt)).limit(20),
        db.select().from(jobs).where(eq(jobs.customerId, input.id)).orderBy(desc(jobs.createdAt)),
        db.select().from(opportunities).where(eq(opportunities.customerId, input.id)).orderBy(desc(opportunities.createdAt)),
        db.select({
          id: quickbooksSalesDocuments.id,
          docType: quickbooksSalesDocuments.docType,
          docNumber: quickbooksSalesDocuments.docNumber,
          quickbooksId: quickbooksSalesDocuments.quickbooksId,
          quickbooksCustomerId: quickbooksSalesDocuments.quickbooksCustomerId,
          quickbooksParentRef: quickbooksSalesDocuments.quickbooksParentRef,
          customerId: quickbooksSalesDocuments.customerId,
          opportunityId: quickbooksSalesDocuments.opportunityId,
          status: quickbooksSalesDocuments.status,
          totalAmount: quickbooksSalesDocuments.totalAmount,
          balance: quickbooksSalesDocuments.balance,
          dueDate: quickbooksSalesDocuments.dueDate,
          voided: quickbooksSalesDocuments.voided,
          txnDate: quickbooksSalesDocuments.txnDate,
        }).from(quickbooksSalesDocuments).where(or(...docMatch)).orderBy(desc(quickbooksSalesDocuments.txnDate)),
      ]);

      const relationship = deriveContactRelationship({
        leadStages: relatedCaptures.map(c => c.status),
        jobStatuses: relJobs.map(j => j.status),
        hasAppointment: appts.length > 0,
      });

      const relations = assembleCustomerRelations({
        opportunities: relOpps,
        salesDocs: relDocs,
        jobs: relJobs,
        propertyCount: props.length,
      });

      return {
        customer,
        relationship,
        properties: props,
        appointments: appts,
        leads: relatedLeads,
        captures: relatedCaptures,
        callLogs: calls,
        rebateCalculations: rebates,
        opportunities: relations.opportunities,
        estimates: relations.estimates,
        invoices: relations.invoices,
        jobs: relations.jobs,
        counts: relations.counts,
        summary: relations.summary,
      };
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
    .input(toPatch(customerInput).extend({ id: z.number().int(), status: z.enum(["active", "inactive", "archived"]).optional() }))
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
    .input(toPatch(propertyInput).extend({ id: z.number().int() }))
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

      // Keep appointment history linked: re-point matching unlinked appointments to
      // the resolved customer (phone/email match, same model used elsewhere).
      // Call logs are NOT relinked — they have no email, are joined strictly by
      // customerId in read paths (no phone-match precedent), and their leadId FK is
      // not populated, so phone-matching them would be an unsafe new heuristic.
      const relinkedAppointments = await relinkAppointmentsToCustomer(db, customerId, phone, email);
      return { customerId, merged, alreadyConverted: false, relinkedAppointments };
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

      // Re-point matching unlinked appointments so the converted customer keeps its
      // appointment history (same phone/email model as convertFromLead).
      const relinkedAppointments = await relinkAppointmentsToCustomer(db, customerId, capture.phone, capture.email);
      return { customerId, merged, alreadyConverted: false, relinkedAppointments };
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
