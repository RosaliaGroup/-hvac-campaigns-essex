/**
 * Dispatch board (M1 read + M2 assignment) — admin-only.
 *
 * The single-day Dispatch Board data: an active-technician roster, a
 * per-technician workload board for one calendar day, and the unscheduled queue
 * (all read-only, M1); plus assign / reassign / unassign of a single appointment
 * to an active technician (M2).
 *
 * BOUNDED WRITE SURFACE (M2): the only writes this module may perform are (a) an
 * UPDATE of `appointments.assignedToId` and (b) an INSERT into the append-only
 * `appointmentAssignmentEvents` audit table — both inside one transaction. It
 * imports NO side-effecting service: no SMS / email / calendar / QBO / AI /
 * notifications, and it never changes `jobs`, `technicianWorkStatus`, schedule,
 * status, or any external system. `appointments.assignedToId` stays the single
 * authoritative current assignee. Guarded by `adminProcedure` (existing admin
 * model — no new roles). Enforced by the static guard test.
 *
 * Rescheduling, drag-and-drop, live polling, capacity, and the map are later
 * milestones. `technicianWorkStatus` (surfaced per visit via the linked job) is
 * the authoritative live status. Cancelled appointments are excluded from the
 * board and cannot be assigned. "Unscheduled" = `appointments.scheduledAt IS NULL`.
 */
import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { appointments, appointmentAssignmentEvents, customers, jobs, teamMembers } from "../../drizzle/schema";
import { and, asc, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import {
  buildDispatchLanes, resolveDayRange, todayInTimeZone, isValidDay,
  type BoardVisit, type Priority,
} from "../../shared/dispatchBoard";
import { decideAssignment, type AssignmentRejectionCode } from "../../shared/dispatchAssignment";
import { resolveTeamMemberId } from "../../shared/fieldApp";

/** Server day boundaries default to the field views' timezone unless the client sends its own. */
const DEFAULT_TZ = "America/New_York";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** SELECT projection shared by the board + unscheduled queries (appointment + joined names). */
type VisitRow = {
  id: number; fullName: string | null; phone: string | null; propertyAddress: string | null;
  appointmentType: string; priority: string | null; status: string; scheduledAt: Date | null;
  durationMinutes: number | null; assignedToId: number | null; jobId: number | null;
  customerName: string | null; jobNumber: string | null; techStatus: string | null; assigneeName: string | null;
};

/** technicianWorkStatus is authoritative when a job is linked; otherwise fall back to the appointment status. */
function toVisit(r: VisitRow): BoardVisit {
  const liveStatus = r.jobId != null && r.techStatus ? r.techStatus : r.status;
  return {
    appointmentId: r.id,
    scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
    durationMinutes: r.durationMinutes ?? 60,
    customerName: (r.customerName && r.customerName.trim()) || (r.fullName && r.fullName.trim()) || "Unknown customer",
    propertyAddress: (r.propertyAddress && r.propertyAddress.trim()) || null,
    appointmentType: r.appointmentType,
    priority: (r.priority ?? "normal") as Priority,
    liveStatus,
    jobId: r.jobId ?? null,
    jobNumber: r.jobNumber ?? null,
    assignedToId: r.assignedToId ?? null,
    assigneeName: (r.assigneeName && r.assigneeName.trim()) || null,
    phone: (r.phone && r.phone.trim()) || null,
  };
}

const visitColumns = {
  id: appointments.id, fullName: appointments.fullName, phone: appointments.phone,
  propertyAddress: appointments.propertyAddress, appointmentType: appointments.appointmentType,
  priority: appointments.priority, status: appointments.status, scheduledAt: appointments.scheduledAt,
  durationMinutes: appointments.durationMinutes, assignedToId: appointments.assignedToId, jobId: appointments.jobId,
  customerName: customers.displayName, jobNumber: jobs.jobNumber, techStatus: jobs.technicianWorkStatus,
  assigneeName: teamMembers.name,
} as const;

/** Active technicians become the board lanes, alphabetical (deterministic). */
async function activeTechnicians(db: Awaited<ReturnType<typeof requireDb>>) {
  const rows = await db.select({ id: teamMembers.id, name: teamMembers.name, phone: teamMembers.mobilePhone })
    .from(teamMembers).where(eq(teamMembers.status, "active")).orderBy(asc(teamMembers.name));
  return rows.map(t => ({ id: t.id, name: t.name, phone: t.phone ?? null }));
}

/** Map a pure-logic rejection code to a typed tRPC error (CONFLICT for stale). */
const REJECTION_STATUS: Record<AssignmentRejectionCode, "BAD_REQUEST" | "CONFLICT"> = {
  APPOINTMENT_CANCELLED: "BAD_REQUEST",
  TECH_NOT_FOUND: "BAD_REQUEST",
  TECH_NOT_ACTIVE: "BAD_REQUEST",
  STALE_ASSIGNEE: "CONFLICT",
};

/**
 * Apply an assignment change atomically. `targetId` is the new assignee, or null
 * to unassign. The appointment row is locked FOR UPDATE so concurrent dispatchers
 * serialize; the pure `decideAssignment` then validates and classifies over the
 * locked (authoritative) state. A real change updates `assignedToId` AND inserts
 * one audit row in the SAME transaction; a same-assignee / already-unassigned
 * request commits nothing and returns `changed:false`. Stale-client requests
 * (expectedAssignedToId no longer matches) raise CONFLICT and write nothing.
 */
async function applyAssignment(
  ctx: { user?: { id?: number | null; openId?: string | null; name?: string | null } | null },
  input: { appointmentId: number; targetId: number | null; expectedAssignedToId: number | null },
) {
  const db = await requireDb();
  const changedById = resolveTeamMemberId(ctx.user);
  const changedByName = ctx.user?.name ?? null;

  return db.transaction(async (tx) => {
    // Pessimistic row lock — the authoritative current assignee for this decision.
    const [appt] = await tx
      .select({ id: appointments.id, status: appointments.status, assignedToId: appointments.assignedToId })
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId))
      .for("update")
      .limit(1);
    if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });

    // Look up the target technician (only when assigning) — its status decides validity.
    const tech = input.targetId !== null
      ? (await tx.select({ id: teamMembers.id, status: teamMembers.status })
          .from(teamMembers).where(eq(teamMembers.id, input.targetId)).limit(1))[0] ?? null
      : null;

    const decision = decideAssignment(
      { id: appt.id, status: appt.status, assignedToId: appt.assignedToId ?? null },
      input.targetId,
      tech ? { id: tech.id, status: tech.status } : null,
      input.expectedAssignedToId,
    );

    if (!decision.ok)
      throw new TRPCError({ code: REJECTION_STATUS[decision.code], message: decision.reason });

    // No-op success: nothing to persist, no audit event.
    if (!decision.changed)
      return { appointmentId: appt.id, assignedToId: decision.toAssigneeId, changed: false as const };

    // Atomic: the assignment and its audit row commit together or roll back together.
    await tx.update(appointments)
      .set({ assignedToId: decision.toAssigneeId })
      .where(eq(appointments.id, appt.id));
    await tx.insert(appointmentAssignmentEvents).values({
      appointmentId: appt.id,
      fromAssigneeId: decision.fromAssigneeId,
      toAssigneeId: decision.toAssigneeId,
      action: decision.action,
      changedById,
      changedByName,
    });

    return { appointmentId: appt.id, assignedToId: decision.toAssigneeId, changed: true as const };
  });
}

export const dispatchRouter = router({
  /** Active technicians for lane columns / assignee reference. Read-only. */
  roster: adminProcedure.query(async () => {
    return { technicians: await activeTechnicians(await requireDb()) };
  }),

  /**
   * One-day workload board: a lane per active technician + an Unassigned lane.
   * Filters to the selected day's [start, end) window in the caller's timezone
   * and excludes cancelled appointments. Read-only.
   */
  board: adminProcedure
    .input(z.object({ day: z.string().optional(), timeZone: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const tz = input.timeZone || DEFAULT_TZ;
      const day = input.day && isValidDay(input.day) ? input.day : todayInTimeZone(new Date(), tz);
      const { start, endExclusive } = resolveDayRange(day, tz);

      const rows = await db.select(visitColumns).from(appointments)
        .leftJoin(customers, eq(appointments.customerId, customers.id))
        .leftJoin(jobs, eq(appointments.jobId, jobs.id))
        .leftJoin(teamMembers, eq(appointments.assignedToId, teamMembers.id))
        .where(and(
          gte(appointments.scheduledAt, start),
          lt(appointments.scheduledAt, endExclusive),
          ne(appointments.status, "cancelled"),
        ));

      const lanes = buildDispatchLanes(rows.map(toVisit), await activeTechnicians(db));
      return { day, timeZone: tz, range: { from: start.toISOString(), to: endExclusive.toISOString() }, lanes };
    }),

  /** Unscheduled queue: appointments with no scheduledAt (excludes cancelled). Read-only. */
  unscheduled: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db.select(visitColumns).from(appointments)
        .leftJoin(customers, eq(appointments.customerId, customers.id))
        .leftJoin(jobs, eq(appointments.jobId, jobs.id))
        .leftJoin(teamMembers, eq(appointments.assignedToId, teamMembers.id))
        .where(and(isNull(appointments.scheduledAt), ne(appointments.status, "cancelled")))
        .orderBy(desc(appointments.createdAt))
        .limit(input.limit + 1);

      const truncated = rows.length > input.limit;
      const visits = rows.slice(0, input.limit).map(toVisit);
      return { visits, total: visits.length, truncated };
    }),

  /**
   * Assign (or reassign) an appointment to an active technician. Admin-only,
   * atomic, audited. `expectedAssignedToId` is the assignee the client last saw
   * (null = it believed unassigned); a mismatch means someone else changed it
   * first and returns CONFLICT without overwriting. Assigning to the current
   * assignee is a successful no-op. Writes ONLY appointments.assignedToId + one
   * audit row; no external side effects.
   */
  assign: adminProcedure
    .input(z.object({
      appointmentId: z.number().int().positive(),
      technicianId: z.number().int().positive(),
      expectedAssignedToId: z.number().int().positive().nullable(),
    }))
    .mutation(async ({ ctx, input }) =>
      applyAssignment(ctx, {
        appointmentId: input.appointmentId,
        targetId: input.technicianId,
        expectedAssignedToId: input.expectedAssignedToId,
      })),

  /**
   * Unassign an appointment (clear its technician). Admin-only, atomic, audited.
   * Already-unassigned is a successful no-op. Same concurrency/CONFLICT semantics
   * as `assign`. Writes ONLY appointments.assignedToId + one audit row.
   */
  unassign: adminProcedure
    .input(z.object({
      appointmentId: z.number().int().positive(),
      expectedAssignedToId: z.number().int().positive().nullable(),
    }))
    .mutation(async ({ ctx, input }) =>
      applyAssignment(ctx, {
        appointmentId: input.appointmentId,
        targetId: null,
        expectedAssignedToId: input.expectedAssignedToId,
      })),
});
