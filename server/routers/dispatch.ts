/**
 * Dispatch board (M1) — READ-ONLY, admin-only.
 *
 * The single-day Dispatch Board data: an active-technician roster, a
 * per-technician workload board for one calendar day, and the unscheduled
 * queue. Contains ONLY `SELECT` reads — no writes, no assignment/reschedule
 * mutations, and no side-effecting service imports (SMS / email / calendar /
 * QBO / AI / notifications). Guarded by `adminProcedure` (the existing admin
 * model — M1 introduces no new roles).
 *
 * Assignment, rescheduling, drag-and-drop, live polling, capacity, and the map
 * are later milestones. `technicianWorkStatus` (surfaced per visit via the
 * linked job) is the authoritative live status. Cancelled appointments are
 * excluded. "Unscheduled" = `appointments.scheduledAt IS NULL`.
 */
import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { appointments, customers, jobs, teamMembers } from "../../drizzle/schema";
import { and, asc, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import {
  buildDispatchLanes, resolveDayRange, todayInTimeZone, isValidDay,
  type BoardVisit, type Priority,
} from "../../shared/dispatchBoard";

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
});
