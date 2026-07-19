/**
 * Dispatch reconciliation audit (M0) — READ-ONLY, admin-only.
 *
 * Runs the pure dispatch reconciliation (shared/dispatchReconciliation.ts) over
 * production data and returns the report. This module contains ONLY `SELECT`
 * reads: it performs no writes, no remediation, and imports no side-effecting
 * service (no SMS / email / calendar / QuickBooks / AI / notifications). Guarded
 * by `adminProcedure` (the existing admin model — M0 introduces no new roles).
 *
 * Complements — does not duplicate — `jobs.lifecycleReconciliation`: that report
 * covers job status-axis lifecycle conflicts; this one adds the dispatch-board
 * cross-entity checks (assignment integrity, dangling references, completion
 * snapshots, scheduling gaps, map readiness) and reuses the shared conflict
 * classifier for the status-axis overlap.
 */
import { router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { jobs, appointments, teamMembers, jobCompletions, properties } from "../../drizzle/schema";
import { runDispatchReconciliation, type DispatchDataset } from "../../shared/dispatchReconciliation";
import type { OfficeStatus, TechnicianWorkStatus, AppointmentStatus } from "../../shared/jobLifecycle";

export const dispatchAuditRouter = router({
  /**
   * Read-only dispatch reconciliation report over all jobs & appointments.
   * SELECT-only; never writes; no external side effects; deterministic per dataset.
   */
  report: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [jobRows, apptRows, teamRows, compRows, propRows] = await Promise.all([
      db.select({
        id: jobs.id, jobNumber: jobs.jobNumber, officeStatus: jobs.status,
        technicianWorkStatus: jobs.technicianWorkStatus, assignedToId: jobs.assignedToId,
        customerId: jobs.customerId, propertyId: jobs.propertyId, completedAt: jobs.completedAt,
      }).from(jobs),
      db.select({
        id: appointments.id, jobId: appointments.jobId, assignedToId: appointments.assignedToId,
        customerId: appointments.customerId, propertyId: appointments.propertyId,
        status: appointments.status, scheduledAt: appointments.scheduledAt,
        propertyAddress: appointments.propertyAddress,
      }).from(appointments),
      db.select({ id: teamMembers.id, status: teamMembers.status }).from(teamMembers),
      db.select({ jobId: jobCompletions.jobId, completedAt: jobCompletions.completedAt }).from(jobCompletions),
      db.select({ id: properties.id, addressLine1: properties.addressLine1 }).from(properties),
    ]);

    const dataset: DispatchDataset = {
      jobs: jobRows.map(j => ({
        id: j.id, jobNumber: j.jobNumber ?? null,
        officeStatus: (j.officeStatus ?? "new") as OfficeStatus,
        technicianWorkStatus: (j.technicianWorkStatus ?? "assigned") as TechnicianWorkStatus,
        assignedToId: j.assignedToId ?? null, customerId: j.customerId ?? null,
        propertyId: j.propertyId ?? null, completedAt: j.completedAt ?? null,
      })),
      appointments: apptRows.map(a => ({
        id: a.id, jobId: a.jobId ?? null, assignedToId: a.assignedToId ?? null,
        customerId: a.customerId ?? null, propertyId: a.propertyId ?? null,
        status: (a.status ?? "pending") as AppointmentStatus, scheduledAt: a.scheduledAt ?? null,
        hasAddressText: !!(a.propertyAddress && String(a.propertyAddress).trim().length > 0),
      })),
      teamMembers: teamRows.map(m => ({ id: m.id, status: m.status as "invited" | "active" | "suspended" })),
      completions: compRows.map(c => ({ jobId: c.jobId, completedAt: c.completedAt ?? null })),
      properties: propRows.map(p => ({ id: p.id, hasAddress: !!(p.addressLine1 && String(p.addressLine1).trim().length > 0) })),
    };

    return runDispatchReconciliation(dataset, { generatedAt: new Date().toISOString() });
  }),
});
