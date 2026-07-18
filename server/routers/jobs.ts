/**
 * Jobs router — Phase 2 Task 6.
 * The Job is the operational record: Customer → Property → Job → N Appointments.
 * QuickBooks fields on jobs are inert placeholders; NO sync logic here.
 */
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  jobs,
  jobLineItems,
  jobLaborEntries,
  jobPartsItems,
  jobTechnicians,
  jobNotes,
  jobAttachments,
  jobAttachmentBlobs,
  jobStatusHistory,
  jobWorkStatusEvents,
  jobTimeEvents,
  jobFieldParts,
  jobSignatures,
  jobCompletions,
  companySettings,
  appointments,
  customers,
  properties,
  teamMembers,
  opportunities,
  quickbooksSalesDocuments,
  type InsertJob,
} from "../../drizzle/schema";
import { and, asc, desc, eq, gte, isNull, isNotNull, like, lte, or, sql } from "drizzle-orm";
import { findCustomerIdByPhone, splitName, buildDisplayName } from "./customers";
import {
  computeLaborMinutes, resolveJobSort, normalizeArchivedFilter, statusTransitionStamps,
  canAccessWorkOrder,
} from "./jobsLogic";
import { toPatch } from "../_core/zodPatch";
import { resolveTeamMemberId } from "../../shared/fieldApp";
import {
  TECHNICIAN_WORK_STATUSES,
  canTransitionWorkStatus,
  DEFAULT_WORK_STATUS,
  type TechnicianWorkStatus,
} from "../../shared/workStatus";
import {
  NOTE_TYPES,
  PHOTO_CATEGORIES,
  canEditNote,
  validatePhotoUpload,
  type NoteType,
  type PhotoRejectReason,
} from "../../shared/jobMedia";
import {
  TIME_EVENT_TYPES,
  canAddTimeEvent,
  computeTimeSummary,
  type TimeState,
} from "../../shared/jobTime";
import {
  canMutateField,
  validateJobCompletion,
  COMPLETION_BLOCK_MESSAGE,
} from "../../shared/jobCompletion";

/** Append a job status-history row. Best-effort audit trail; never blocks the write it follows. */
async function recordStatusChange(
  db: Awaited<ReturnType<typeof requireDb>>,
  jobId: number,
  fromStatus: string | null,
  toStatus: string,
  changedById: number | null,
  note?: string | null,
) {
  await db.insert(jobStatusHistory).values({ jobId, fromStatus, toStatus, changedById, note: note ?? null });
}

/**
 * Field work-order authorization. Loads the job and enforces that a technician
 * may only reach work assigned to them; admins may reach any. "Assigned" means
 * the job's assignee, an additional technician on the job, or the assignee of
 * any appointment linked to the job (the field app reaches a work order via an
 * appointment). Returns the job + resolved identity, or throws:
 *   - NOT_FOUND   when the job doesn't exist
 *   - FORBIDDEN   when a technician requests a job that isn't theirs
 * Server-side only — the client can never widen this by passing another id.
 */
async function resolveFieldJobAccess(
  db: Awaited<ReturnType<typeof requireDb>>,
  jobId: number,
  user: { id?: number | null; openId?: string | null; role?: string | null } | null | undefined,
) {
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });

  const isAdmin = user?.role === "admin";
  const memberId = resolveTeamMemberId(user);
  if (isAdmin) return { job, memberId, isAdmin };

  if (memberId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your login isn't linked to a technician profile." });
  }

  // Compute the access inputs lazily (skip the extra queries once satisfied),
  // then let the pure rule decide (canAccessWorkOrder — unit-tested exhaustively).
  let viaAppointment = false;
  let viaTechnician = false;
  if (job.assignedToId !== memberId) {
    viaAppointment = (await db.select({ id: appointments.id }).from(appointments)
      .where(and(eq(appointments.jobId, jobId), eq(appointments.assignedToId, memberId))).limit(1)).length > 0;
    if (!viaAppointment) {
      viaTechnician = (await db.select({ id: jobTechnicians.id }).from(jobTechnicians)
        .where(and(eq(jobTechnicians.jobId, jobId), eq(jobTechnicians.technicianId, memberId))).limit(1)).length > 0;
    }
  }
  if (!canAccessWorkOrder({ isAdmin, memberId, assignedToId: job.assignedToId, viaAppointment, viaTechnician })) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This work order isn't assigned to you." });
  }
  return { job, memberId, isAdmin };
}

/** Human message for a rejected photo upload (server-side guard). */
function photoRejectMessage(reason: PhotoRejectReason): string {
  switch (reason) {
    case "unsupported_type": return "Unsupported file type. Please upload a JPEG, PNG, or WebP image.";
    case "too_large": return "Image is too large. Please use a smaller or more compressed photo.";
    case "empty": return "The image appears to be empty.";
    case "not_data_url": return "Invalid image data.";
  }
}

/** Join a property's parts into a single-line address, or null if empty. */
function formatPropertyAddress(p: {
  addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; state?: string | null; zip?: string | null;
} | null): string | null {
  if (!p) return null;
  const line1 = [p.addressLine1, p.addressLine2].filter(Boolean).join(" ").trim();
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  const full = [line1, cityState, p.zip].filter(Boolean).join(", ").trim();
  return full.length ? full : null;
}

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

const WARRANTY_STATUSES = ["none", "manufacturer", "labor", "extended", "warranty_call"] as const;

const jobInput = z.object({
  customerId: z.number().int(),
  propertyId: z.number().int().optional().nullable(),
  opportunityId: z.number().int().optional().nullable(),
  originatingAppointmentId: z.number().int().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  jobType: z.enum(JOB_TYPES).optional().nullable(),
  priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  assignedToId: z.number().int().optional().nullable(),
  equipmentServiced: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  customerVisibleNotes: z.string().optional().nullable(),
  warrantyStatus: z.enum(WARRANTY_STATUSES).optional().nullable(),
  completionSummary: z.string().optional().nullable(),
  scheduledStartAt: z.coerce.date().optional().nullable(),
  scheduledEndAt: z.coerce.date().optional().nullable(),
  actualArrivalAt: z.coerce.date().optional().nullable(),
  actualCompletionAt: z.coerce.date().optional().nullable(),
});

const lineItemInput = z.object({
  type: z.enum(LINE_ITEM_TYPES).default("labor"),
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).max(99999),
  unitPrice: z.number().min(0).max(9999999),
  sortOrder: z.number().int().default(0),
});

const laborInput = z.object({
  technicianId: z.number().int().optional().nullable(),
  workDate: z.coerce.date().optional().nullable(),
  startTime: z.coerce.date().optional().nullable(),
  endTime: z.coerce.date().optional().nullable(),
  durationMinutes: z.number().int().min(0).max(100000).optional().nullable(),
  description: z.string().min(1).max(500),
  billable: z.boolean().default(true),
});

const partInput = z.object({
  itemName: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  quantity: z.number().min(0).max(99999).default(1),
  unit: z.string().max(32).optional().nullable(),
  unitCost: z.number().min(0).max(9999999).default(0),
  unitPrice: z.number().min(0).max(9999999).default(0),
  billable: z.boolean().default(true),
});

const noteInput = z.object({
  jobId: z.number().int(),
  body: z.string().min(1).max(5000),
  visibility: z.enum(["internal", "customer"]).default("internal"),
});

const attachmentInput = z.object({
  jobId: z.number().int(),
  kind: z.enum(["photo", "document", "other"]).default("photo"),
  fileName: z.string().min(1).max(255),
  url: z.string().min(1).max(1024),
  mimeType: z.string().max(128).optional().nullable(),
  sizeBytes: z.number().int().min(0).optional().nullable(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Throw NOT_FOUND unless the job exists. Used by child-entity mutations. */
async function assertJobExists(db: Awaited<ReturnType<typeof requireDb>>, jobId: number) {
  const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export const jobsRouter = router({
  /** Job list with filters, sort, and pagination + customer/assignee names and line total. */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(JOB_STATUSES).optional(),
        jobType: z.enum(JOB_TYPES).optional(),
        priority: z.enum(["normal", "urgent", "emergency"]).optional(),
        customerId: z.number().int().optional(),
        propertyId: z.number().int().optional(),
        assignedToId: z.number().int().optional(),
        /** Filter on scheduledStartAt within [dateFrom, dateTo]. */
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        archived: z.enum(["active", "archived", "all"]).default("active"),
        search: z.string().max(255).optional(),
        sortBy: z.string().max(40).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }).default({ limit: 50, offset: 0, archived: "active" }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.status) conditions.push(eq(jobs.status, input.status));
      if (input.jobType) conditions.push(eq(jobs.jobType, input.jobType));
      if (input.priority) conditions.push(eq(jobs.priority, input.priority));
      if (input.customerId) conditions.push(eq(jobs.customerId, input.customerId));
      if (input.propertyId) conditions.push(eq(jobs.propertyId, input.propertyId));
      if (input.assignedToId) conditions.push(eq(jobs.assignedToId, input.assignedToId));
      if (input.dateFrom) conditions.push(gte(jobs.scheduledStartAt, input.dateFrom));
      if (input.dateTo) conditions.push(lte(jobs.scheduledStartAt, input.dateTo));
      const archived = normalizeArchivedFilter(input.archived);
      if (archived === "active") conditions.push(isNull(jobs.archivedAt));
      else if (archived === "archived") conditions.push(isNotNull(jobs.archivedAt));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(like(jobs.jobNumber, q), like(jobs.title, q), like(customers.displayName, q)));
      }
      const where = conditions.length ? and(...conditions) : undefined;

      const sort = resolveJobSort(input.sortBy, input.sortDir);
      const sortCol = jobs[sort.field];
      const orderBy = sort.desc ? desc(sortCol) : asc(sortCol);

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
          .orderBy(orderBy)
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

  /** Full job view: job + all related records for the detail page. Read-only. */
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const job = (await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      const [
        customer, property, lineItems, jobAppointments, assignee, opportunity,
        labor, parts, notes, attachments, extraTechs, statusHistory, salesDocs,
      ] = await Promise.all([
        db.select().from(customers).where(eq(customers.id, job.customerId)).limit(1).then(r => r[0] ?? null),
        job.propertyId
          ? db.select().from(properties).where(eq(properties.id, job.propertyId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        db.select().from(jobLineItems).where(eq(jobLineItems.jobId, job.id)).orderBy(jobLineItems.sortOrder, jobLineItems.id),
        db.select().from(appointments).where(eq(appointments.jobId, job.id)).orderBy(desc(appointments.scheduledAt)),
        job.assignedToId
          ? db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, job.assignedToId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        // Phase A: the opportunity this job was converted from (Job → Opportunity link).
        job.opportunityId
          ? db.select({ id: opportunities.id, title: opportunities.title, stage: opportunities.stage })
              .from(opportunities).where(eq(opportunities.id, job.opportunityId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        // Labor entries with technician name.
        db.select({ labor: jobLaborEntries, technicianName: teamMembers.name })
          .from(jobLaborEntries)
          .leftJoin(teamMembers, eq(jobLaborEntries.technicianId, teamMembers.id))
          .where(eq(jobLaborEntries.jobId, job.id)).orderBy(desc(jobLaborEntries.workDate), jobLaborEntries.id),
        db.select().from(jobPartsItems).where(eq(jobPartsItems.jobId, job.id)).orderBy(jobPartsItems.id),
        db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).orderBy(desc(jobNotes.createdAt)),
        db.select().from(jobAttachments).where(eq(jobAttachments.jobId, job.id)).orderBy(desc(jobAttachments.createdAt)),
        db.select({ link: jobTechnicians, name: teamMembers.name })
          .from(jobTechnicians)
          .leftJoin(teamMembers, eq(jobTechnicians.technicianId, teamMembers.id))
          .where(eq(jobTechnicians.jobId, job.id)),
        db.select().from(jobStatusHistory).where(eq(jobStatusHistory.jobId, job.id)).orderBy(desc(jobStatusHistory.createdAt)),
        // Related estimates/invoices via the linked opportunity. Display-only; QBO
        // untouched. Select explicit columns so the raw QBO payload (`raw`) is
        // never shipped to the client (matches opportunities.get's guard).
        job.opportunityId
          ? db.select({
              id: quickbooksSalesDocuments.id,
              docType: quickbooksSalesDocuments.docType,
              docNumber: quickbooksSalesDocuments.docNumber,
              quickbooksId: quickbooksSalesDocuments.quickbooksId,
              quickbooksCustomerId: quickbooksSalesDocuments.quickbooksCustomerId,
              status: quickbooksSalesDocuments.status,
              totalAmount: quickbooksSalesDocuments.totalAmount,
              txnDate: quickbooksSalesDocuments.txnDate,
              opportunityId: quickbooksSalesDocuments.opportunityId,
            }).from(quickbooksSalesDocuments).where(eq(quickbooksSalesDocuments.opportunityId, job.opportunityId)).orderBy(desc(quickbooksSalesDocuments.txnDate))
          : Promise.resolve([]),
      ]);

      const estimates = salesDocs.filter(d => d.docType === "estimate");
      const invoices = salesDocs.filter(d => d.docType === "invoice");
      const lineTotal = lineItems.reduce((sum, li) => sum + Number(li.total), 0);
      const partsTotal = parts.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unitPrice), 0);

      return {
        job, customer, property, lineItems, appointments: jobAppointments, assignee, opportunity,
        labor, parts, notes, attachments, additionalTechnicians: extraTechs, statusHistory,
        estimates, invoices,
        lineTotal, partsTotal,
      };
    }),

  /**
   * Field work-order view — technician-scoped, read-only, NO financial data.
   * Returns exactly what a technician needs to run the service call: customer
   * contact, property/address (for directions), the originating appointment,
   * assignment, history (prior visits / notes / photos), and the technician
   * work-status lifecycle + audit trail. Access enforced server-side by
   * resolveFieldJobAccess (assigned-only for technicians; admins see all).
   */
  fieldWorkOrder: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, isAdmin } = await resolveFieldJobAccess(db, input.id, ctx.user);

      const [customer, property, assignee, originatingAppt, visits, notes, photos, events] = await Promise.all([
        db.select({ displayName: customers.displayName, phone: customers.phone, email: customers.email })
          .from(customers).where(eq(customers.id, job.customerId)).limit(1).then(r => r[0] ?? null),
        job.propertyId
          ? db.select().from(properties).where(eq(properties.id, job.propertyId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        job.assignedToId
          ? db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, job.assignedToId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        job.originatingAppointmentId
          ? db.select().from(appointments).where(eq(appointments.id, job.originatingAppointmentId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        // Prior visits = appointments linked to this job (newest first) + tech name.
        db.select({
            id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status,
            appointmentType: appointments.appointmentType, serviceType: appointments.serviceType,
            technicianName: teamMembers.name,
          })
          .from(appointments)
          .leftJoin(teamMembers, eq(appointments.assignedToId, teamMembers.id))
          .where(eq(appointments.jobId, job.id)).orderBy(desc(appointments.scheduledAt)),
        db.select({ id: jobNotes.id, body: jobNotes.body, createdAt: jobNotes.createdAt, authorName: teamMembers.name })
          .from(jobNotes).leftJoin(teamMembers, eq(jobNotes.authorId, teamMembers.id))
          .where(eq(jobNotes.jobId, job.id)).orderBy(desc(jobNotes.createdAt)),
        // Previous photos (if available) — attachments of kind "photo"; metadata/URL only.
        db.select({ id: jobAttachments.id, fileName: jobAttachments.fileName, url: jobAttachments.url, mimeType: jobAttachments.mimeType, createdAt: jobAttachments.createdAt })
          .from(jobAttachments).where(and(eq(jobAttachments.jobId, job.id), eq(jobAttachments.kind, "photo"))).orderBy(desc(jobAttachments.createdAt)),
        db.select().from(jobWorkStatusEvents).where(eq(jobWorkStatusEvents.jobId, job.id)).orderBy(desc(jobWorkStatusEvents.createdAt)),
      ]);

      // Prefer the structured property address; fall back to the appointment's free-text address.
      const address = formatPropertyAddress(property) ?? originatingAppt?.propertyAddress ?? null;

      return {
        isAdmin,
        job: {
          id: job.id, jobNumber: job.jobNumber, title: job.title, description: job.description,
          priority: job.priority, customerId: job.customerId,
          technicianWorkStatus: (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) as TechnicianWorkStatus,
          scheduledStartAt: job.scheduledStartAt,
        },
        customer,
        property: { address, directionsAvailable: Boolean(address) },
        appointment: originatingAppt ? {
          appointmentType: originatingAppt.appointmentType, serviceType: originatingAppt.serviceType,
          priority: originatingAppt.priority, description: originatingAppt.issueDescription,
          scheduledAt: originatingAppt.scheduledAt, dispatcherNotes: originatingAppt.notes,
          source: originatingAppt.source,
        } : null,
        assignee,
        history: { visits, notes, photos },
        workStatusEvents: events,
      };
    }),

  /**
   * Advance the technician work status on a work order. Enforces the shared
   * single-step transition rules and records prev/new/user/timestamp in
   * jobWorkStatusEvents. Never touches jobs.status or appointments.status.
   * Access enforced by resolveFieldJobAccess (assigned-only / admin).
   */
  setTechnicianWorkStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(TECHNICIAN_WORK_STATUSES) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId } = await resolveFieldJobAccess(db, input.id, ctx.user);
      const current = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) as TechnicianWorkStatus;
      if (input.status === current) return { success: true, status: current, unchanged: true };
      // Completion is atomic and only via jobs.completeJob (stamps actuals +
      // writes the jobCompletions snapshot + enforces note/signature). The generic
      // status control must never set `completed` (that produced a partial-
      // completion glitch). Defense-in-depth even though TRANSITIONS excludes it.
      if (input.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Finish a work order with the Complete Job action, not the status control." });
      }
      if (!canTransitionWorkStatus(current, input.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot move from ${current} to ${input.status}.` });
      }
      // Denormalized display name for the audit row (technician or admin).
      let changedByName: string | null = ctx.user?.name ?? null;
      if (memberId != null) {
        const m = (await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1))[0];
        changedByName = m?.name ?? changedByName;
      }
      await db.update(jobs).set({ technicianWorkStatus: input.status }).where(eq(jobs.id, job.id));
      await db.insert(jobWorkStatusEvents).values({
        jobId: job.id, fromStatus: current, toStatus: input.status,
        changedById: memberId ?? null, changedByName,
      });
      return { success: true, status: input.status };
    }),

  // ── Field work-order notes (PR #40) ───────────────────────────────────────
  // Technician-scoped, access-enforced via resolveFieldJobAccess. Distinct from
  // the office addNote/deleteNote (which stay untouched for backward-compat).

  /** Add a note (internal or customer) to a work order. */
  fieldAddNote: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      body: z.string().min(1).max(5000),
      visibility: z.enum(NOTE_TYPES).default("internal"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { memberId } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const result = await db.insert(jobNotes).values({
        jobId: input.jobId, body: input.body, visibility: input.visibility,
        authorId: memberId ?? null, edited: false,
      });
      return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  /**
   * Edit a note's text. Enforces the shared canEditNote rule (own-notes-only for
   * technicians; after completion, internal→admin-only and customer→locked). Sets
   * the edited flag; updatedAt is stamped by the column.
   */
  fieldUpdateNote: protectedProcedure
    .input(z.object({ id: z.number().int(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const note = (await db.select().from(jobNotes).where(eq(jobNotes.id, input.id)).limit(1))[0];
      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, note.jobId, ctx.user);
      const jobCompleted = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canEditNote({ isAdmin, memberId, note: { authorId: note.authorId, visibility: note.visibility as NoteType }, jobCompleted })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can't edit this note." });
      }
      await db.update(jobNotes).set({ body: input.body, edited: true }).where(eq(jobNotes.id, input.id));
      return { success: true };
    }),

  /** Notes on a work order, newest first, with author name/photo + per-note editability. */
  fieldListNotes: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const jobCompleted = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      const rows = await db.select({
        id: jobNotes.id, body: jobNotes.body, visibility: jobNotes.visibility, authorId: jobNotes.authorId,
        edited: jobNotes.edited, createdAt: jobNotes.createdAt, updatedAt: jobNotes.updatedAt,
        attachmentId: jobNotes.attachmentId,
        authorName: teamMembers.name, authorPhoto: teamMembers.profilePhoto,
      })
        .from(jobNotes).leftJoin(teamMembers, eq(jobNotes.authorId, teamMembers.id))
        .where(eq(jobNotes.jobId, input.jobId)).orderBy(desc(jobNotes.createdAt));
      return {
        jobCompleted,
        notes: rows.map(n => ({
          ...n,
          canEdit: canEditNote({ isAdmin, memberId, note: { authorId: n.authorId, visibility: n.visibility as NoteType }, jobCompleted }),
        })),
      };
    }),

  // ── Field work-order photos (PR #40) ──────────────────────────────────────
  // Bytes live in jobAttachmentBlobs (separate table → lean gallery queries) and
  // are served ONLY through fieldGetPhoto (authorized; no guessable public URL).

  /** Upload a compressed photo (data URL) to a work order under a category. */
  fieldAddPhoto: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      category: z.enum(PHOTO_CATEGORIES).default("general"),
      fileName: z.string().min(1).max(255),
      dataUrl: z.string().min(1),
      noteId: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { memberId } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const check = validatePhotoUpload(input.dataUrl);
      if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: photoRejectMessage(check.reason) });
      const { mime, base64, bytes } = check.value;
      const result = await db.insert(jobAttachments).values({
        jobId: input.jobId, kind: "photo", category: input.category, fileName: input.fileName,
        url: null, mimeType: mime, sizeBytes: bytes, uploadedById: memberId ?? null,
        noteId: input.noteId ?? null,
      });
      const attachmentId = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      await db.insert(jobAttachmentBlobs).values({ attachmentId, data: base64 });
      // If attached to a note, back-link the note to this photo.
      if (input.noteId) await db.update(jobNotes).set({ attachmentId }).where(eq(jobNotes.id, input.noteId));
      return { id: attachmentId };
    }),

  /** Photo metadata for a work order (NO bytes) — feeds the category gallery. */
  fieldListPhotos: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const photos = await db.select({
        id: jobAttachments.id, category: jobAttachments.category, fileName: jobAttachments.fileName,
        mimeType: jobAttachments.mimeType, sizeBytes: jobAttachments.sizeBytes,
        createdAt: jobAttachments.createdAt, noteId: jobAttachments.noteId,
        uploaderName: teamMembers.name,
      })
        .from(jobAttachments).leftJoin(teamMembers, eq(jobAttachments.uploadedById, teamMembers.id))
        .where(and(eq(jobAttachments.jobId, input.jobId), eq(jobAttachments.kind, "photo")))
        .orderBy(desc(jobAttachments.createdAt));
      return { photos };
    }),

  /**
   * Return one photo's bytes as a data URL, authorized by the photo's job. This
   * is the ONLY way to read a field photo — there is no public URL to guess.
   */
  fieldGetPhoto: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      const att = (await db.select().from(jobAttachments).where(eq(jobAttachments.id, input.id)).limit(1))[0];
      if (!att || att.kind !== "photo") throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found" });
      await resolveFieldJobAccess(db, att.jobId, ctx.user); // enforce access by the photo's job
      const blob = (await db.select({ data: jobAttachmentBlobs.data })
        .from(jobAttachmentBlobs).where(eq(jobAttachmentBlobs.attachmentId, att.id)).limit(1))[0];
      if (!blob) {
        // Legacy/office attachment stored by URL rather than blob.
        return { id: att.id, mimeType: att.mimeType, dataUrl: null as string | null, url: att.url };
      }
      return {
        id: att.id, mimeType: att.mimeType,
        dataUrl: `data:${att.mimeType ?? "image/jpeg"};base64,${blob.data}` as string | null,
        url: null as string | null,
      };
    }),

  // ── Job completion workflow (PR #41): time / parts / signature / complete ──
  // All access-scoped via resolveFieldJobAccess. Field mutations respect the
  // completion lock (technicians locked after completion; admins override).

  /** True when the technician is locked out (job completed and caller is not admin). */
  // (helper inlined per-procedure below via canMutateField)

  /** Append a time-clock event (Start Travel / Arrived / … / Finish Work). */
  fieldAddTimeEvent: protectedProcedure
    .input(z.object({ jobId: z.number().int(), eventType: z.enum(TIME_EVENT_TYPES) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canMutateField(completed, isAdmin)) throw new TRPCError({ code: "FORBIDDEN", message: "Job is completed — time entries are locked." });
      const prior = await db.select({ eventType: jobTimeEvents.eventType, occurredAt: jobTimeEvents.occurredAt }).from(jobTimeEvents).where(eq(jobTimeEvents.jobId, input.jobId)).orderBy(asc(jobTimeEvents.occurredAt));
      const state: TimeState = computeTimeSummary(prior as any).state;
      if (!canAddTimeEvent(state, input.eventType)) throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot ${input.eventType} from ${state}.` });
      await db.insert(jobTimeEvents).values({ jobId: input.jobId, eventType: input.eventType, createdById: memberId ?? null });
      // Stamp job actuals on milestones (reuse existing columns; additive).
      if (input.eventType === "arrived") await db.update(jobs).set({ actualArrivalAt: new Date() }).where(eq(jobs.id, input.jobId));
      return { success: true };
    }),

  /** Time events + computed travel/labor/pause/elapsed summary for a job. */
  fieldListTime: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const events = await db.select({ id: jobTimeEvents.id, eventType: jobTimeEvents.eventType, occurredAt: jobTimeEvents.occurredAt })
        .from(jobTimeEvents).where(eq(jobTimeEvents.jobId, input.jobId)).orderBy(asc(jobTimeEvents.occurredAt));
      return { events, summary: computeTimeSummary(events as any, new Date()) };
    }),

  // ── Parts used ──
  fieldAddPart: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      partNumber: z.string().max(120).optional().nullable(),
      description: z.string().min(1).max(500),
      quantity: z.number().min(0).max(999999).default(1),
      unit: z.string().max(32).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canMutateField(completed, isAdmin)) throw new TRPCError({ code: "FORBIDDEN", message: "Job is completed — parts are locked." });
      const res = await db.insert(jobFieldParts).values({
        jobId: input.jobId, partNumber: input.partNumber ?? null, description: input.description,
        quantity: String(input.quantity), unit: input.unit ?? null, notes: input.notes ?? null, createdById: memberId ?? null,
      });
      return { id: Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  fieldUpdatePart: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      partNumber: z.string().max(120).optional().nullable(),
      description: z.string().min(1).max(500).optional(),
      quantity: z.number().min(0).max(999999).optional(),
      unit: z.string().max(32).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const part = (await db.select().from(jobFieldParts).where(eq(jobFieldParts.id, input.id)).limit(1))[0];
      if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "Part not found" });
      const { job, isAdmin } = await resolveFieldJobAccess(db, part.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canMutateField(completed, isAdmin)) throw new TRPCError({ code: "FORBIDDEN", message: "Job is completed — parts are locked." });
      const set: Record<string, unknown> = {};
      if (input.partNumber !== undefined) set.partNumber = input.partNumber;
      if (input.description !== undefined) set.description = input.description;
      if (input.quantity !== undefined) set.quantity = String(input.quantity);
      if (input.unit !== undefined) set.unit = input.unit;
      if (input.notes !== undefined) set.notes = input.notes;
      if (Object.keys(set).length) await db.update(jobFieldParts).set(set).where(eq(jobFieldParts.id, input.id));
      return { success: true };
    }),

  fieldDeletePart: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const part = (await db.select().from(jobFieldParts).where(eq(jobFieldParts.id, input.id)).limit(1))[0];
      if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "Part not found" });
      const { job, isAdmin } = await resolveFieldJobAccess(db, part.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canMutateField(completed, isAdmin)) throw new TRPCError({ code: "FORBIDDEN", message: "Job is completed — parts are locked." });
      await db.delete(jobFieldParts).where(eq(jobFieldParts.id, input.id));
      return { success: true };
    }),

  fieldListParts: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      const parts = await db.select().from(jobFieldParts).where(eq(jobFieldParts.jobId, input.jobId)).orderBy(desc(jobFieldParts.createdAt));
      return { parts, editable: canMutateField(completed, isAdmin) };
    }),

  // ── Signature ──
  fieldSaveSignature: protectedProcedure
    .input(z.object({ jobId: z.number().int(), dataUrl: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const completed = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) === "completed";
      if (!canMutateField(completed, isAdmin)) throw new TRPCError({ code: "FORBIDDEN", message: "Job is completed — signature is read-only." });
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl.trim());
      if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "Signature must be a PNG image." });
      const existing = (await db.select({ id: jobSignatures.id }).from(jobSignatures).where(eq(jobSignatures.jobId, input.jobId)).limit(1))[0];
      if (existing) await db.update(jobSignatures).set({ data: m[1], technicianId: memberId ?? null, signedAt: new Date() }).where(eq(jobSignatures.jobId, input.jobId));
      else await db.insert(jobSignatures).values({ jobId: input.jobId, data: m[1], technicianId: memberId ?? null });
      return { success: true };
    }),

  fieldGetSignature: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const sig = (await db.select().from(jobSignatures).where(eq(jobSignatures.jobId, input.jobId)).limit(1))[0];
      if (!sig) return { hasSignature: false, dataUrl: null as string | null, signedAt: null as Date | null };
      return { hasSignature: true, dataUrl: `data:image/png;base64,${sig.data}`, signedAt: sig.signedAt };
    }),

  // ── Completion settings (admin) ──
  getCompletionSettings: protectedProcedure.query(async () => {
    const db = await requireDb();
    const row = (await db.select().from(companySettings).where(eq(companySettings.id, 1)).limit(1))[0];
    return { requireCompletionSignature: row?.requireCompletionSignature ?? false };
  }),
  setCompletionSettings: adminProcedure
    .input(z.object({ requireCompletionSignature: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const row = (await db.select({ id: companySettings.id }).from(companySettings).where(eq(companySettings.id, 1)).limit(1))[0];
      if (row) await db.update(companySettings).set({ requireCompletionSignature: input.requireCompletionSignature }).where(eq(companySettings.id, 1));
      else await db.insert(companySettings).values({ id: 1, requireCompletionSignature: input.requireCompletionSignature });
      return { success: true };
    }),

  // ── Complete the job ──
  completeJob: protectedProcedure
    .input(z.object({ jobId: z.number().int(), noCompletionNote: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job, memberId, isAdmin } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const current = (job.technicianWorkStatus ?? DEFAULT_WORK_STATUS) as TechnicianWorkStatus;
      if (current === "completed") return { success: true, alreadyCompleted: true };

      const [custNote] = await db.select({ id: jobNotes.id }).from(jobNotes)
        .where(and(eq(jobNotes.jobId, input.jobId), eq(jobNotes.visibility, "customer"))).limit(1);
      const [sig] = await db.select({ id: jobSignatures.id }).from(jobSignatures).where(eq(jobSignatures.jobId, input.jobId)).limit(1);
      const settings = (await db.select().from(companySettings).where(eq(companySettings.id, 1)).limit(1))[0];
      const requireSignature = settings?.requireCompletionSignature ?? false;

      const v = validateJobCompletion({
        currentWorkStatus: current,
        hasCustomerNote: !!custNote,
        noCompletionNote: input.noCompletionNote,
        requireSignature,
        hasSignature: !!sig,
      });
      if (!v.ok) throw new TRPCError({ code: "BAD_REQUEST", message: COMPLETION_BLOCK_MESSAGE[v.reason] });

      const events = await db.select({ eventType: jobTimeEvents.eventType, occurredAt: jobTimeEvents.occurredAt }).from(jobTimeEvents).where(eq(jobTimeEvents.jobId, input.jobId)).orderBy(asc(jobTimeEvents.occurredAt));
      const summary = computeTimeSummary(events as any, new Date());
      const now = new Date();

      // Finalize status (preserve status history), stamp actuals, snapshot completion.
      await db.update(jobs).set({ technicianWorkStatus: "completed", completedAt: now, actualCompletionAt: now }).where(eq(jobs.id, input.jobId));
      let changedByName: string | null = ctx.user?.name ?? null;
      if (memberId != null) { const mm = (await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1))[0]; changedByName = mm?.name ?? changedByName; }
      await db.insert(jobWorkStatusEvents).values({ jobId: input.jobId, fromStatus: current, toStatus: "completed", changedById: memberId ?? null, changedByName });
      await db.insert(jobCompletions).values({
        jobId: input.jobId, completedById: memberId ?? null, completedAt: now,
        noteMode: custNote ? "note" : "no_note", hadSignature: !!sig,
        travelMs: summary.travelMs, laborMs: summary.laborMs, pauseMs: summary.pauseMs, elapsedMs: summary.elapsedMs,
      });
      return { success: true, completedAt: now };
    }),

  /**
   * Structured completion summary (PR #41) — read-only. Assembles customer,
   * property, technician, time totals, status timeline, notes, parts, photos,
   * signature presence and the completion stamp. No PDF/AI/email/portal.
   */
  jobCompletionSummary: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();
      const { job } = await resolveFieldJobAccess(db, input.jobId, ctx.user);
      const [customer, property, assignee, timeEvents, statusTimeline, notes, parts, photos, sig, completion] = await Promise.all([
        db.select({ displayName: customers.displayName, phone: customers.phone, email: customers.email }).from(customers).where(eq(customers.id, job.customerId)).limit(1).then(r => r[0] ?? null),
        job.propertyId ? db.select().from(properties).where(eq(properties.id, job.propertyId)).limit(1).then(r => r[0] ?? null) : Promise.resolve(null),
        job.assignedToId ? db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, job.assignedToId)).limit(1).then(r => r[0] ?? null) : Promise.resolve(null),
        db.select({ eventType: jobTimeEvents.eventType, occurredAt: jobTimeEvents.occurredAt }).from(jobTimeEvents).where(eq(jobTimeEvents.jobId, input.jobId)).orderBy(asc(jobTimeEvents.occurredAt)),
        db.select().from(jobWorkStatusEvents).where(eq(jobWorkStatusEvents.jobId, input.jobId)).orderBy(asc(jobWorkStatusEvents.createdAt)),
        db.select({ id: jobNotes.id, body: jobNotes.body, visibility: jobNotes.visibility, createdAt: jobNotes.createdAt }).from(jobNotes).where(eq(jobNotes.jobId, input.jobId)).orderBy(desc(jobNotes.createdAt)),
        db.select().from(jobFieldParts).where(eq(jobFieldParts.jobId, input.jobId)).orderBy(asc(jobFieldParts.createdAt)),
        db.select({ id: jobAttachments.id, category: jobAttachments.category, fileName: jobAttachments.fileName }).from(jobAttachments).where(and(eq(jobAttachments.jobId, input.jobId), eq(jobAttachments.kind, "photo"))),
        db.select({ signedAt: jobSignatures.signedAt }).from(jobSignatures).where(eq(jobSignatures.jobId, input.jobId)).limit(1).then(r => r[0] ?? null),
        db.select().from(jobCompletions).where(eq(jobCompletions.jobId, input.jobId)).limit(1).then(r => r[0] ?? null),
      ]);
      return {
        job: { id: job.id, jobNumber: job.jobNumber, title: job.title, technicianWorkStatus: job.technicianWorkStatus ?? DEFAULT_WORK_STATUS, completedAt: job.completedAt },
        customer, property, technician: assignee,
        time: computeTimeSummary(timeEvents as any),
        statusTimeline, notes, parts,
        photos: { count: photos.length, byCategory: photos },
        signature: { hasSignature: !!sig, signedAt: sig?.signedAt ?? null },
        completion,
      };
    }),

  /** Manual job creation (from customer / property / opportunity / jobs list). */
  create: protectedProcedure.input(jobInput).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    const owner = (await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
    if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

    // Invalid-relationship prevention: a property must belong to the job's customer.
    if (input.propertyId != null) {
      const prop = (await db.select({ customerId: properties.customerId }).from(properties).where(eq(properties.id, input.propertyId)).limit(1))[0];
      if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      if (prop.customerId !== input.customerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not belong to this customer" });
      }
    }

    const values: InsertJob = { ...input, jobNumber: "", createdById: ctx.user?.id ?? null };
    const result = await db.insert(jobs).values(values);
    const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    const jobNumber = makeJobNumber(id);
    await db.update(jobs).set({ jobNumber }).where(eq(jobs.id, id));
    await recordStatusChange(db, id, null, values.status ?? "new", ctx.user?.id ?? null, "Job created");
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
    .mutation(async ({ input, ctx }) => {
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
      const initialStatus = appt.scheduledAt ? "scheduled" : "new";
      const values: InsertJob = {
        jobNumber: "",
        customerId,
        propertyId: appt.propertyId ?? null,
        originatingAppointmentId: appt.id,
        title: `${typeLabel} — ${appt.fullName}`,
        description: appt.issueDescription ?? null,
        jobType: appt.jobType ?? null,
        priority: appt.priority ?? "normal",
        status: initialStatus,
        assignedToId: appt.assignedToId ?? null,
        scheduledStartAt: appt.scheduledAt ?? null,
        createdById: ctx.user?.id ?? null,
      };
      const result = await db.insert(jobs).values(values);
      const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      const jobNumber = makeJobNumber(id);
      await db.update(jobs).set({ jobNumber }).where(eq(jobs.id, id));
      await recordStatusChange(db, id, null, initialStatus, ctx.user?.id ?? null, "Created from appointment");

      // Link the appointment (and backfill its customerId while we're here)
      await db.update(appointments).set({ jobId: id, customerId }).where(eq(appointments.id, appt.id));

      return { id, jobNumber, alreadyLinked: false, customerCreated };
    }),

  update: protectedProcedure
    .input(toPatch(jobInput).extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...patch } = input;
      const existing = (await db.select({ id: jobs.id, customerId: jobs.customerId }).from(jobs).where(eq(jobs.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      // Invalid-relationship prevention on re-parenting a property.
      if (patch.propertyId != null) {
        const prop = (await db.select({ customerId: properties.customerId }).from(properties).where(eq(properties.id, patch.propertyId)).limit(1))[0];
        if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        const targetCustomer = patch.customerId ?? existing.customerId;
        if (prop.customerId !== targetCustomer) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not belong to this customer" });
        }
      }
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
      if (Object.keys(clean).length) await db.update(jobs).set(clean).where(eq(jobs.id, id));
      return { success: true };
    }),

  /** Status pipeline transition; stamps actual timestamps + writes the history row. */
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(JOB_STATUSES), note: z.string().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const existing = (await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (existing.status === input.status) return { success: true, unchanged: true };
      const patch: Record<string, unknown> = { status: input.status, ...statusTransitionStamps(input.status, existing, new Date()) };
      await db.update(jobs).set(patch).where(eq(jobs.id, input.id));
      await recordStatusChange(db, input.id, existing.status, input.status, ctx.user?.id ?? null, input.note);
      return { success: true };
    }),

  /** Archive (soft-delete) a job — hidden from the default list; fully reversible. */
  archive: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const existing = (await db.select({ id: jobs.id, status: jobs.status, archivedAt: jobs.archivedAt }).from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (existing.archivedAt) return { success: true, alreadyArchived: true };
      await db.update(jobs).set({ archivedAt: new Date() }).where(eq(jobs.id, input.id));
      await recordStatusChange(db, input.id, existing.status, existing.status, ctx.user?.id ?? null, "Archived");
      return { success: true };
    }),

  /** Restore an archived job. */
  restore: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const existing = (await db.select({ id: jobs.id, status: jobs.status, archivedAt: jobs.archivedAt }).from(jobs).where(eq(jobs.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (!existing.archivedAt) return { success: true, notArchived: true };
      await db.update(jobs).set({ archivedAt: null }).where(eq(jobs.id, input.id));
      await recordStatusChange(db, input.id, existing.status, existing.status, ctx.user?.id ?? null, "Restored");
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
    .input(toPatch(lineItemInput).extend({ id: z.number().int() }))
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

  // ── Labor entries (normalized) ──────────────────────────────
  addLabor: protectedProcedure
    .input(laborInput.extend({ jobId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await assertJobExists(db, input.jobId);
      const durationMinutes = computeLaborMinutes(input);
      const result = await db.insert(jobLaborEntries).values({
        jobId: input.jobId,
        technicianId: input.technicianId ?? null,
        workDate: input.workDate ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        durationMinutes,
        description: input.description,
        billable: input.billable,
      });
      return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  updateLabor: protectedProcedure
    .input(toPatch(laborInput).extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...patch } = input;
      const existing = (await db.select().from(jobLaborEntries).where(eq(jobLaborEntries.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Labor entry not found" });
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
      // Recompute duration when the inputs that feed it change.
      if (patch.durationMinutes !== undefined || patch.startTime !== undefined || patch.endTime !== undefined) {
        clean.durationMinutes = computeLaborMinutes({
          durationMinutes: patch.durationMinutes ?? existing.durationMinutes,
          startTime: patch.startTime ?? existing.startTime,
          endTime: patch.endTime ?? existing.endTime,
        });
      }
      if (Object.keys(clean).length) await db.update(jobLaborEntries).set(clean).where(eq(jobLaborEntries.id, id));
      return { success: true };
    }),

  deleteLabor: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobLaborEntries).where(eq(jobLaborEntries.id, input.id));
      return { success: true };
    }),

  // ── Parts / materials (normalized) ──────────────────────────
  addPart: protectedProcedure
    .input(partInput.extend({ jobId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await assertJobExists(db, input.jobId);
      const result = await db.insert(jobPartsItems).values({
        jobId: input.jobId,
        itemName: input.itemName,
        description: input.description ?? null,
        quantity: input.quantity.toFixed(2),
        unit: input.unit ?? null,
        unitCost: input.unitCost.toFixed(2),
        unitPrice: input.unitPrice.toFixed(2),
        billable: input.billable,
      });
      return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  updatePart: protectedProcedure
    .input(toPatch(partInput).extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...patch } = input;
      const existing = (await db.select().from(jobPartsItems).where(eq(jobPartsItems.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Part not found" });
      const clean: Record<string, unknown> = {};
      if (patch.itemName !== undefined) clean.itemName = patch.itemName;
      if (patch.description !== undefined) clean.description = patch.description;
      if (patch.unit !== undefined) clean.unit = patch.unit;
      if (patch.billable !== undefined) clean.billable = patch.billable;
      if (patch.quantity !== undefined) clean.quantity = patch.quantity.toFixed(2);
      if (patch.unitCost !== undefined) clean.unitCost = patch.unitCost.toFixed(2);
      if (patch.unitPrice !== undefined) clean.unitPrice = patch.unitPrice.toFixed(2);
      if (Object.keys(clean).length) await db.update(jobPartsItems).set(clean).where(eq(jobPartsItems.id, id));
      return { success: true };
    }),

  deletePart: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobPartsItems).where(eq(jobPartsItems.id, input.id));
      return { success: true };
    }),

  // ── Notes ───────────────────────────────────────────────────
  addNote: protectedProcedure.input(noteInput).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    await assertJobExists(db, input.jobId);
    const result = await db.insert(jobNotes).values({
      jobId: input.jobId, body: input.body, visibility: input.visibility, authorId: ctx.user?.id ?? null,
    });
    return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
  }),

  deleteNote: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobNotes).where(eq(jobNotes.id, input.id));
      return { success: true };
    }),

  // ── Attachments / photos (metadata only; no upload handling here) ──
  addAttachment: protectedProcedure.input(attachmentInput).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    await assertJobExists(db, input.jobId);
    const result = await db.insert(jobAttachments).values({
      jobId: input.jobId, kind: input.kind, fileName: input.fileName, url: input.url,
      mimeType: input.mimeType ?? null, sizeBytes: input.sizeBytes ?? null, uploadedById: ctx.user?.id ?? null,
    });
    return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
  }),

  deleteAttachment: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobAttachments).where(eq(jobAttachments.id, input.id));
      return { success: true };
    }),

  // ── Additional technicians ──────────────────────────────────
  addTechnician: protectedProcedure
    .input(z.object({ jobId: z.number().int(), technicianId: z.number().int(), role: z.string().max(64).optional().nullable() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const job = (await db.select({ assignedToId: jobs.assignedToId }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1))[0];
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (job.assignedToId === input.technicianId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That technician is already the primary assignee" });
      }
      const dupe = (await db.select({ id: jobTechnicians.id }).from(jobTechnicians)
        .where(and(eq(jobTechnicians.jobId, input.jobId), eq(jobTechnicians.technicianId, input.technicianId))).limit(1))[0];
      if (dupe) return { id: dupe.id, alreadyAssigned: true };
      const result = await db.insert(jobTechnicians).values({ jobId: input.jobId, technicianId: input.technicianId, role: input.role ?? null });
      return { id: Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  removeTechnician: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(jobTechnicians).where(eq(jobTechnicians.id, input.id));
      return { success: true };
    }),
});
