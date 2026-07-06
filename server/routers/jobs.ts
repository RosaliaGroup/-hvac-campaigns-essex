/**
 * Jobs router — Phase 2 Task 6.
 * The Job is the operational record: Customer → Property → Job → N Appointments.
 * QuickBooks fields on jobs are inert placeholders; NO sync logic here.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  jobs,
  jobLineItems,
  appointments,
  customers,
  properties,
  teamMembers,
  type InsertJob,
} from "../../drizzle/schema";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { findCustomerIdByPhone, splitName, buildDisplayName } from "./customers";

// ─────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────

/** Human job number derived from the autoincrement id — race-free, sortable. */
export function makeJobNumber(id: number, year: number = new Date().getFullYear()): string {
  return `ME-${year}-${String(id).padStart(4, "0")}`;
}

/** Line total = quantity × unitPrice, rounded to cents, as a decimal string for MySQL. */
export function computeLineTotal(quantity: number, unitPrice: number): string {
  const total = Math.round(quantity * unitPrice * 100) / 100;
  return total.toFixed(2);
}

export const JOB_STATUSES = [
  "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent",
  "approved", "completed", "invoice_sent", "paid", "closed", "cancelled",
] as const;

const JOB_TYPES = [
  "service_call", "diagnostic", "repair", "maintenance", "installation",
  "replacement", "estimate", "commercial_hvac", "residential_hvac",
  "boiler", "furnace", "ac", "heat_pump", "mini_split", "rooftop_unit",
  "refrigeration", "other",
] as const;

const LINE_ITEM_TYPES = ["labor", "part", "service", "equipment", "other"] as const;

const jobInput = z.object({
  customerId: z.number().int(),
  propertyId: z.number().int().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  jobType: z.enum(JOB_TYPES).optional().nullable(),
  priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  assignedToId: z.number().int().optional().nullable(),
  equipmentServiced: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

const lineItemInput = z.object({
  type: z.enum(LINE_ITEM_TYPES).default("labor"),
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).max(99999),
  unitPrice: z.number().min(0).max(9999999),
  sortOrder: z.number().int().default(0),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export const jobsRouter = router({
  /** Job list with filters + customer name + line-item total, newest first. */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(JOB_STATUSES).optional(),
        customerId: z.number().int().optional(),
        assignedToId: z.number().int().optional(),
        search: z.string().max(255).optional(),
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      }).default({ limit: 100, offset: 0 }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.status) conditions.push(eq(jobs.status, input.status));
      if (input.customerId) conditions.push(eq(jobs.customerId, input.customerId));
      if (input.assignedToId) conditions.push(eq(jobs.assignedToId, input.assignedToId));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(like(jobs.jobNumber, q), like(jobs.title, q), like(customers.displayName, q)));
      }
      const where = conditions.length ? and(...conditions) : undefined;

      const [items, totalRows] = await Promise.all([
        db
          .select({
            job: jobs,
            customerName: customers.displayName,
            assigneeName: teamMembers.name,
            lineTotal: sql<string>`COALESCE((SELECT SUM(li.total) FROM jobLineItems li WHERE li.jobId = ${jobs.id}), 0)`,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .leftJoin(teamMembers, eq(jobs.assignedToId, teamMembers.id))
          .where(where)
          .orderBy(desc(jobs.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(where),
      ]);
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  /** Counts per status for pipeline chips. */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {};
    const rows = await db.select({ status: jobs.status, count: sql<number>`COUNT(*)` }).from(jobs).groupBy(jobs.status);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = Number(r.count);
    return out;
  }),

  /** Full job view: job + customer + property + line items + appointments. */
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const job = (await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      const [customer, property, lineItems, jobAppointments, assignee] = await Promise.all([
        db.select().from(customers).where(eq(customers.id, job.customerId)).limit(1).then(r => r[0] ?? null),
        job.propertyId
          ? db.select().from(properties).where(eq(properties.id, job.propertyId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        db.select().from(jobLineItems).where(eq(jobLineItems.jobId, job.id)).orderBy(jobLineItems.sortOrder, jobLineItems.id),
        db.select().from(appointments).where(eq(appointments.jobId, job.id)).orderBy(desc(appointments.scheduledAt)),
        job.assignedToId
          ? db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, job.assignedToId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
      ]);

      const lineTotal = lineItems.reduce((sum, li) => sum + Number(li.total), 0);
      return { job, customer, property, lineItems, appointments: jobAppointments, assignee, lineTotal };
    }),

  /** Manual job creation (from customer detail or jobs list). */
  create: protectedProcedure.input(jobInput).mutation(async ({ input }) => {
    const db = await requireDb();
    const owner = (await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
    if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

    const values: InsertJob = { ...input, jobNumber: "" };
    const result = await db.insert(jobs).values(values);
    const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    const jobNumber = makeJobNumber(id);
    await db.update(jobs).set({ jobNumber }).where(eq(jobs.id, id));
    return { id, jobNumber };
  }),

  /**
   * Create a job FROM an appointment. Links the appointment to the new job,
   * inherits type/priority/assignee/property, and — if the appointment has no
   * customer — resolves one by phone or creates one from the appointment's
   * contact details (a job requires a customer).
   */
  createFromAppointment: protectedProcedure
    .input(z.object({ appointmentId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.appointmentId)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (appt.jobId) return { id: appt.jobId, jobNumber: null, alreadyLinked: true, customerCreated: false };

      // Resolve or create the customer
      let customerId = appt.customerId ?? (await findCustomerIdByPhone(appt.phone));
      let customerCreated = false;
      if (!customerId) {
        const { firstName, lastName } = splitName(appt.fullName);
        const result = await db.insert(customers).values({
          type: appt.propertyType === "commercial" ? "commercial" : "residential",
          firstName,
          lastName,
          displayName: buildDisplayName({ firstName, lastName, email: appt.email, phone: appt.phone }),
          email: appt.email ?? null,
          phone: appt.phone,
          source: appt.source ?? "phone",
        });
        customerId = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
        customerCreated = true;
      }

      const typeLabel = (appt.jobType ?? appt.appointmentType).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const values: InsertJob = {
        jobNumber: "",
        customerId,
        propertyId: appt.propertyId ?? null,
        title: `${typeLabel} — ${appt.fullName}`,
        description: appt.issueDescription ?? null,
        jobType: appt.jobType ?? null,
        priority: appt.priority ?? "normal",
        status: appt.scheduledAt ? "scheduled" : "new",
        assignedToId: appt.assignedToId ?? null,
      };
      const result = await db.insert(jobs).values(values);
      const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      const jobNumber = makeJobNumber(id);
      await db.update(jobs).set({ jobNumber }).where(eq(jobs.id, id));

      // Link the appointment (and backfill its customerId while we're here)
      await db.update(appointments).set({ jobId: id, customerId }).where(eq(appointments.id, appt.id));

      return { id, jobNumber, alreadyLinked: false, customerCreated };
    }),

  update: protectedProcedure
    .input(jobInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...patch } = input;
      const existing = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
      if (Object.keys(clean).length) await db.update(jobs).set(clean).where(eq(jobs.id, id));
      return { success: true };
    }),

  /** Status pipeline transition; stamps completedAt on first completion. */
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(JOB_STATUSES) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = (await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === "completed" && !existing.completedAt) patch.completedAt = new Date();
      await db.update(jobs).set(patch).where(eq(jobs.id, input.id));
      return { success: true };
    }),

  /** Attach an existing appointment to this job (Job 1→N Appointments). */
  linkAppointment: protectedProcedure
    .input(z.object({ jobId: z.number().int(), appointmentId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const job = (await db.select({ id: jobs.id, customerId: jobs.customerId }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1))[0];
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      await db
        .update(appointments)
        .set({ jobId: input.jobId, customerId: job.customerId })
        .where(eq(appointments.id, input.appointmentId));
      return { success: true };
    }),

  // ── Line items ──────────────────────────────────────────────

  addLineItem: protectedProcedure
    .input(lineItemInput.extend({ jobId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1))[0];
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const result = await db.insert(jobLineItems).values({
        jobId: input.jobId,
        type: input.type,
        description: input.description,
        quantity: input.quantity.toFixed(2),
        unitPrice: input.unitPrice.toFixed(2),
        total: computeLineTotal(input.quantity, input.unitPrice),
        sortOrder: input.sortOrder,
      });
      return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  updateLineItem: protectedProcedure
    .input(lineItemInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...patch } = input;
      const existing = (await db.select().from(jobLineItems).where(eq(jobLineItems.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Line item not found" });
      const quantity = patch.quantity ?? Number(existing.quantity);
      const unitPrice = patch.unitPrice ?? Number(existing.unitPrice);
      await db
        .update(jobLineItems)
        .set({
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
          quantity: quantity.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          total: computeLineTotal(quantity, unitPrice),
        })
        .where(eq(jobLineItems.id, id));
      return { success: true };
    }),

  deleteLineItem: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobLineItems).where(eq(jobLineItems.id, input.id));
      return { success: true };
    }),
});
