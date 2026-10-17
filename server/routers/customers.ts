import { contactDisplayName } from "../../shared/contactName";
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
import {
  deriveContactRelationship,
  type Relationship,
} from "@shared/leadPipeline";
import { contactClassification } from "@shared/contactClassification";
import { assembleCustomerRelations } from "./customerRelations";

// ─────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────

/** Strip a phone number down to its digits; compare on the last 10. */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null; // too short to be a real match key
  return digits.slice(-10);
}

/** Split a free-text full name into first/last ("Mary Ann Smith" → "Mary Ann" / "Smith"). */
export function splitName(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Does an appointment belong to a given lead/contact? Links, in priority order:
 *  1. customerId (both sides linked to the same customer record)
 *  2. phone (last-10-digit match)
 *  3. email (case-insensitive)
 * Pure — the same rule the SQL fallback query encodes, exported for tests.
 */
export function appointmentMatchesLead(
  appt: {
    customerId?: number | null;
    phone?: string | null;
    email?: string | null;
  },
  lead: {
    customerId?: number | null;
    phone?: string | null;
    email?: string | null;
  }
): boolean {
  if (
    lead.customerId != null &&
    appt.customerId != null &&
    lead.customerId === appt.customerId
  )
    return true;
  const lp = normalizePhone(lead.phone);
  const ap = normalizePhone(appt.phone);
  if (lp && ap && lp === ap) return true;
  const le = lead.email?.trim().toLowerCase() || null;
  const ae = appt.email?.trim().toLowerCase() || null;
  if (le && ae && le === ae) return true;
  return false;
}

/** Prefer the person name; company stays in its own field. */
export function buildDisplayName(c: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  return contactDisplayName(c);
}

// ─────────────────────────────────────────────────────────────
// Shared query helpers
// ─────────────────────────────────────────────────────────────

/**
 * Find an existing customer by phone (last-10-digit match) or email
 * (case-insensitive). Used to dedupe on conversion and by the lead→QBO
 * auto-sync job (server/services/leadCustomerAutoSync.ts).
 */
export async function findExistingCustomer(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  phone: string | null | undefined,
  email: string | null | undefined
) {
  const phoneKey = normalizePhone(phone);
  const emailKey = email?.trim().toLowerCase() || null;
  const conditions = [];
  if (phoneKey) {
    // MySQL 8 / TiDB: compare last 10 digits after stripping non-digits
    conditions.push(
      sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneKey}`
    );
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
  appt: {
    customerId?: number | null;
    phone?: string | null;
    email?: string | null;
  },
  target: { phone?: string | null; email?: string | null }
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
  email: string | null | undefined
): Promise<number> {
  const phoneKey = normalizePhone(phone);
  const emailKey = email?.trim().toLowerCase() || null;
  const matchers = [];
  if (phoneKey) {
    matchers.push(
      sql`RIGHT(REGEXP_REPLACE(${appointments.phone}, '[^0-9]', ''), 10) = ${phoneKey}`
    );
  }
  if (emailKey) {
    matchers.push(sql`LOWER(${appointments.email}) = ${emailKey}`);
  }
  if (matchers.length === 0) return 0;
  const result = await db
    .update(appointments)
    .set({ customerId })
    .where(and(isNull(appointments.customerId), or(...matchers)));
  return Number(
    (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0
  );
}

const customerInput = z.object({
  type: z.enum(["residential", "commercial"]).default("residential"),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
  companyName: z.string().max(255).optional().nullable(),
  email: z
    .string()
    .email()
    .max(320)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
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
export async function findCustomerIdByPhone(
  phone: string | null | undefined
): Promise<number | null> {
  try {
    const phoneKey = normalizePhone(phone);
    if (!phoneKey) return null;
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneKey}`
      )
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
  appts: Array<{
    customerId?: number | null;
    phone?: string | null;
    email?: string | null;
  }>,
  jobStatusesByCustomerId: Map<number, string[]>
): Relationship {
  const hasAppointment = appts.some(a => appointmentMatchesLead(a, entity));
  const jobStatuses =
    entity.customerId != null
      ? (jobStatusesByCustomerId.get(entity.customerId) ?? [])
      : [];
  return deriveContactRelationship({
    leadStages: entity.leadStages,
    jobStatuses,
    hasAppointment,
  });
}

/**
 * Batch-derive relationships for many entities with the same signals in both
 * screens: appointments (matched by customerId OR phone/email fallback) and
 * jobs linked to the person's customer record.
 */
export async function computeRelationships(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  entities: RelationshipEntity[]
): Promise<Map<number, Relationship>> {
  const map = new Map<number, Relationship>();
  if (entities.length === 0) return map;

  const customerIds = Array.from(
    new Set(
      entities.map(e => e.customerId).filter((x): x is number => x != null)
    )
  );
  const [appts, jbs] = await Promise.all([
    db
      .select({
        customerId: appointments.customerId,
        phone: appointments.phone,
        email: appointments.email,
      })
      .from(appointments),
    customerIds.length
      ? db
          .select({ customerId: jobs.customerId, status: jobs.status })
          .from(jobs)
          .where(inArray(jobs.customerId, customerIds))
      : Promise.resolve([] as { customerId: number | null; status: string }[]),
  ]);

  const jobStatusByCustomer = new Map<number, string[]>();
  for (const j of jbs) {
    if (j.customerId == null) continue;
    (
      jobStatusByCustomer.get(j.customerId) ??
      jobStatusByCustomer.set(j.customerId, []).get(j.customerId)!
    ).push(j.status);
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
      z
        .object({
          search: z.string().max(255).optional(),
          type: z.enum(["residential", "commercial"]).optional(),
          status: z.enum(["active", "inactive", "archived"]).optional(),
          assignedToId: z.number().int().optional(),
          source: z.enum(["gmail", "other"]).optional(),
          completedOnly: z.boolean().default(false),
          sort: z.enum(["newest", "name"]).default("newest"),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({ limit: 50, offset: 0, sort: "newest", completedOnly: false })
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
            like(customers.firstName, q),
            like(customers.lastName, q),
            like(customers.email, q),
            like(customers.phone, q),
            like(customers.companyName, q)
          )
        );
      }
      if (input.type) conditions.push(eq(customers.type, input.type));
      if (input.source === "gmail")
        conditions.push(input.completedOnly
          ? sql`${customers.source} IN ('Gmail Selected','HVAC Prospecting Task')`
          : eq(customers.source, "Gmail Sent"));
      if (input.source === "other")
        conditions.push(input.completedOnly
          ? sql`(${customers.source} IS NULL OR ${customers.source} NOT IN ('Gmail Selected','HVAC Prospecting Task','Gmail Sent'))`
          : sql`(${customers.source} IS NULL OR ${customers.source} != 'Gmail Sent')`);
      if (input.completedOnly) {
        // Only the visible CRM Contacts page is strict. Scheduling and
        // inbound lead history still retain incomplete people.
        conditions.push(sql`(${customers.source} IS NULL OR ${customers.source} != 'Gmail Sent')`);
        conditions.push(sql`${customers.email} LIKE '%@%.%'`);
        // Email-only outreach recipients remain visible while phone research is pending.
      }
      // Default: hide archived unless explicitly requested
      conditions.push(
        input.status
          ? eq(customers.status, input.status)
          : sql`${customers.status} != 'archived'`
      );
      if (input.assignedToId)
        conditions.push(eq(customers.assignedToId, input.assignedToId));

      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(where)
          .orderBy(
            input.sort === "name"
              ? customers.displayName
              : desc(customers.createdAt),
            customers.id
          )
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(customers)
          .where(where),
      ]);
      // Derive the true relationship (Lead/Prospect/Customer) from real signals
      // instead of assuming every contact is a Customer. Same helper the Lead
      // Inbox uses, so a person reads identically in both screens.
      const stagesByCustomer = new Map<number, string[]>();
      if (rows.length) {
        const caps = await db
          .select({
            customerId: leadCaptures.customerId,
            status: leadCaptures.status,
          })
          .from(leadCaptures)
          .where(
            inArray(
              leadCaptures.customerId,
              rows.map(r => r.id)
            )
          );
        for (const c of caps) {
          if (c.customerId == null) continue;
          (
            stagesByCustomer.get(c.customerId) ??
            stagesByCustomer.set(c.customerId, []).get(c.customerId)!
          ).push(c.status);
        }
      }
      const relationships = await computeRelationships(
        db,
        rows.map(r => ({
          id: r.id,
          customerId: r.id,
          phone: r.phone,
          email: r.email,
          leadStages: stagesByCustomer.get(r.id) ?? [],
        }))
      );
      const items = rows.map(r => {
        const relationship =
          relationships.get(r.id) ?? ("lead" as Relationship);
        return {
          ...r,
          relationship,
          ...contactClassification(
            r,
            relationship,
            Boolean(stagesByCustomer.get(r.id)?.length)
          ),
        };
      });
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  /**
   * Unified scheduler search: matches CUSTOMERS and lead captures (LEADS) by name,
   * company, phone, email, and address (incl. a customer's property addresses).
   * Converted leads carry their customerId so selecting them links the appointment.
   */
  searchForScheduling: protectedProcedure
    .input(
      z
        .object({
          q: z.string().max(255),
          limit: z.number().int().min(1).max(25).default(10),
        })
        .default({ q: "", limit: 10 })
    )
    .query(async ({ input }): Promise<{ results: SchedulingResult[] }> => {
      const db = await getDb();
      if (!db) return { results: [] };
      const q = input.q.trim();
      if (q.length < 2) return { results: [] };
      const lk = `%${q}%`;
      const digits = q.replace(/\D/g, "");
      const phoneCond =
        digits.length >= 3
          ? [
              sql`REGEXP_REPLACE(${customers.phone}, '[^0-9]', '') LIKE ${"%" + digits + "%"}`,
            ]
          : [];

      const custRows = await db
        .select({
          id: customers.id,
          displayName: customers.displayName,
          companyName: customers.companyName,
          email: customers.email,
          phone: customers.phone,
          type: customers.type,
        })
        .from(customers)
        .where(
          and(
            sql`${customers.status} != 'archived'`,
            or(
              like(customers.displayName, lk),
              like(customers.companyName, lk),
              like(customers.email, lk),
              like(customers.phone, lk),
              like(customers.billingLine1, lk),
              like(customers.billingCity, lk),
              like(customers.billingZip, lk),
              ...phoneCond
            )
          )
        )
        .limit(input.limit);

      // Customers matched by a property address.
      const propHits = await db
        .select({ customerId: properties.customerId })
        .from(properties)
        .where(
          or(
            like(properties.addressLine1, lk),
            like(properties.city, lk),
            like(properties.zip, lk)
          )
        )
        .limit(input.limit);
      const haveIds = new Set(custRows.map(c => c.id));
      const extraIds = Array.from(
        new Set(
          propHits
            .map(p => p.customerId)
            .filter((id): id is number => id != null && !haveIds.has(id))
        )
      );
      const extraCust = extraIds.length
        ? await db
            .select({
              id: customers.id,
              displayName: customers.displayName,
              companyName: customers.companyName,
              email: customers.email,
              phone: customers.phone,
              type: customers.type,
            })
            .from(customers)
            .where(
              and(
                inArray(customers.id, extraIds),
                sql`${customers.status} != 'archived'`
              )
            )
        : [];
      const allCust = [...custRows, ...extraCust];

      // Primary/first property address per matched customer.
      const custIds = allCust.map(c => c.id);
      const addrByCustomer = new Map<number, string>();
      if (custIds.length) {
        const props = await db
          .select({
            customerId: properties.customerId,
            addressLine1: properties.addressLine1,
            addressLine2: properties.addressLine2,
            city: properties.city,
            state: properties.state,
            zip: properties.zip,
            isPrimary: properties.isPrimary,
          })
          .from(properties)
          .where(inArray(properties.customerId, custIds))
          .orderBy(desc(properties.isPrimary), desc(properties.createdAt));
        for (const p of props) {
          if (p.customerId == null || addrByCustomer.has(p.customerId))
            continue;
          addrByCustomer.set(p.customerId, formatPropertyAddress(p));
        }
      }

      const capRows = await db
        .select({
          id: leadCaptures.id,
          name: leadCaptures.name,
          firstName: leadCaptures.firstName,
          lastName: leadCaptures.lastName,
          email: leadCaptures.email,
          phone: leadCaptures.phone,
          customerId: leadCaptures.customerId,
        })
        .from(leadCaptures)
        .where(
          or(
            like(leadCaptures.name, lk),
            like(leadCaptures.firstName, lk),
            like(leadCaptures.lastName, lk),
            like(leadCaptures.email, lk),
            like(leadCaptures.phone, lk)
          )
        )
        .limit(input.limit);

      const linkedIds = new Set(allCust.map(c => c.id));
      const results: SchedulingResult[] = [
        ...allCust.map(
          (c): SchedulingResult => ({
            kind: "customer",
            key: `customer:${c.id}`,
            customerId: c.id,
            refId: c.id,
            displayName: c.displayName,
            companyName: c.companyName ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            propertyType: c.type,
            address: addrByCustomer.get(c.id) ?? "",
          })
        ),
        ...capRows
          .filter(c => !(c.customerId != null && linkedIds.has(c.customerId)))
          .map(
            (c): SchedulingResult => ({
              kind: "lead",
              key: `lead:${c.id}`,
              customerId: c.customerId ?? null,
              refId: c.id,
              displayName:
                c.name ||
                [c.firstName, c.lastName].filter(Boolean).join(" ") ||
                c.email ||
                c.phone ||
                "Lead",
              companyName: null,
              phone: c.phone ?? null,
              email: c.email ?? null,
              propertyType: "residential",
              address: "",
            })
          ),
      ].slice(0, input.limit);

      return { results };
    }),

  /** Properties for a single customer, with formatted address — powers the dialog property picker. */
  listProperties: protectedProcedure
    .input(z.object({ customerId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { properties: [] };
      const rows = await db
        .select()
        .from(properties)
        .where(eq(properties.customerId, input.customerId))
        .orderBy(desc(properties.isPrimary), desc(properties.createdAt));
      return {
        properties: rows.map(p => ({
          id: p.id,
          label: p.label,
          isPrimary: p.isPrimary,
          propertyType: p.propertyType,
          addressLine1: p.addressLine1,
          addressLine2: p.addressLine2,
          city: p.city,
          state: p.state,
          zip: p.zip,
          address: formatPropertyAddress(p),
      …11205 tokens truncated…alidateResearch(
      { company, social: [person] },
      [companySource, personUrl],
      { name: "Sample Person", email: "sample@example.com" }
    );
    expect(result.company.name?.value).toBe("Example Company");
    expect(result.social[0].platform).toBe("LinkedIn");
  });
  it("does not assign an employer to a Gmail contact without a known company", () => {
    expect(
      validateResearch(
        { company, social: [person] },
        [companySource, personUrl],
        { name: "Sample Person", email: "sample@gmail.com" }
      )
    ).toMatchObject({ company: {}, social: [], status: "not_found" });
  });
  it("requires employer or exact email evidence, not a name-only social match", () => {
    const result = validateResearch(
      { company, social: [{ ...person, evidence: "Sample Person" }] },
      [companySource, personUrl],
      { name: "Sample Person", email: "sample@example.com" }
    );
    expect(result.social).toEqual([]);
  });
  it("accepts known employer evidence for personal email contacts", () => {
    const result = validateResearch(
      { company, social: [person] },
      [companySource, personUrl],
      {
        name: "Sample Person",
        email: "sample@gmail.com",
        company: "Example Company",
      }
    );
    expect(result.social).toHaveLength(1);
  });
  it("rejects company LinkedIn pages as person profiles", () => {
    expect(
      validateResearch(
        {
          social: [
            { ...person, url: "https://www.linkedin.com/company/example" },
          ],
        },
        ["https://www.linkedin.com/company/example", personUrl],
        { name: "Sample Person", company: "Example Company" }
      ).social
    ).toEqual([]);
  });
  it("shows unavailable without calling an unconfigured research provider", async () => {
    const fetcher = vi.fn();
    expect(
      await researchContact({ name: "Sample Person" }, {}, fetcher)
    ).toMatchObject({ status: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("accepts equivalent cited URL variants and bare company domains", () => {
  const result = validateResearch(
    {
      company: {
        ...company,
        website: fact("www.example.com"),
        name: { ...company.name, source: "http://www.example.com/about/" },
      },
      social: [{ ...person, url: personUrl + "/", source: personUrl + "/" }],
    },
    [companySource, personUrl],
    { name: "Sample Person", email: "sample@example.com" }
  );
  expect(result.company.name?.value).toBe("Example Company");
  expect(result.company.website?.value).toBe("https://example.com/");
  expect(result.social).toHaveLength(1);
});

it("accepts cited Google business listings with domain evidence, rejects searches and namesakes", () => {
  const listing = "https://www.google.com/maps/place/Example+Company";
  const query = "https://www.google.com/maps/search/Example+Company";
  const input = (url:string,evidence:string) => ({company,companySocial:[{url,source:url,evidence}]});
  const identity={name:"Sample Person",email:"sample@example.com",company:"Example Company"};
  expect(validateResearch(input(listing,"Example Company example.com"),[companySource,listing],identity).companySocial?.[0].platform).toBe("Google Business Profile");
  expect(validateResearch(input(query,"Example Company example.com"),[companySource,query],identity).companySocial).toBeUndefined();
  expect(validateResearch(input(listing,"Example Company unrelated.com"),[companySource,listing],identity).companySocial).toBeUndefined();
  expect(validateResearch(input(listing,"Example Company example.com"),[companySource],identity).companySocial).toBeUndefined();
});
it("accepts a cited professional directory with matching employer and domain", () => {
  const url="https://www.zillow.com/profile/example";
  const result=validateResearch({company,companySocial:[{url,source:url,evidence:"Example Company example.com"}]},[companySource,url],{name:"Sample Person",email:"sample@example.com"});
  expect(result.companySocial?.[0].platform).toBe("Zillow");
});

it("requires a cited exact-email identity before filling an unknown person's name",()=>{
 const source="https://example.com/team";
 const named=(evidence:string)=>({person:{firstName:{value:"Mary Ann",source,evidence},lastName:{value:"Smith",source,evidence}}});
 const identity={name:"person@example.com",email:"person@example.com",company:"Example Company"};
 expect(validateResearch(named("Mary Ann Smith person@example.com"),[source],identity).person?.firstName.value).toBe("Mary Ann");
 expect(validateResearch(named("Mary Ann Smith Example Company"),[source],identity).person).toBeUndefined();
 expect(validateResearch(named("Mary Ann Smith person@example.com"),[],identity).person).toBeUndefined();
 expect(validateResearch(named("Other Person person@example.com"),[source],identity).person).toBeUndefined();
});
