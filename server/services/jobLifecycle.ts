/**
 * Canonical job-lifecycle service (SHADOW MODE).
 *
 * Persists the derived `jobs.lifecycleState` and records transitions in
 * `jobLifecycleEvents`, idempotently. Nothing here changes legacy behavior or fires
 * external side effects — the legacy status fields remain authoritative and every
 * recorder call is best-effort (never throws to its caller). The pure decision logic
 * (`planLifecycleTransition`, `lifecycleIdempotencyKey`) is separated for unit tests.
 */
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, appointments, jobLifecycleEvents } from "../../drizzle/schema";
import {
  deriveJobLifecycle,
  classifyJobConflicts,
  type LifecycleState,
  type LifecycleInput,
  type OfficeStatus,
  type TechnicianWorkStatus,
  type AppointmentStatus,
} from "@shared/jobLifecycle";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface TransitionCtx {
  /** office | field | completion | appointment | qbo | portal | backfill | manual */
  source: string;
  /** Caller-supplied idempotency token (e.g. a webhook/provider event id). */
  eventKey: string;
  actorId?: number | null;
  actorRole?: string | null;
  actorName?: string | null;
}

export interface TransitionPlan {
  changed: boolean;
  from: LifecycleState | null;
  to: LifecycleState;
  reason: string;
  idempotencyKey: string | null;
}

/** Stable dedup token for one logical transition. */
export function lifecycleIdempotencyKey(
  jobId: number, from: LifecycleState | null, to: LifecycleState, source: string, eventKey: string,
): string {
  return crypto.createHash("sha1").update(`${jobId}|${from ?? "none"}|${to}|${source}|${eventKey}`).digest("hex");
}

/**
 * PURE: decide whether a transition should be recorded. No-op when the derived state
 * equals the currently-persisted state (this is what makes retries idempotent — a
 * re-run after the state already advanced records nothing).
 */
export function planLifecycleTransition(
  current: LifecycleState | null, input: LifecycleInput, jobId: number, ctx: TransitionCtx,
): TransitionPlan {
  const derived = deriveJobLifecycle(input);
  if (current === derived.state) {
    return { changed: false, from: current, to: derived.state, reason: derived.reason, idempotencyKey: null };
  }
  return {
    changed: true, from: current, to: derived.state, reason: derived.reason,
    idempotencyKey: lifecycleIdempotencyKey(jobId, current, derived.state, ctx.source, ctx.eventKey),
  };
}

async function loadInput(db: Db, jobId: number): Promise<{ input: LifecycleInput; persisted: LifecycleState | null } | null> {
  const j = (await db
    .select({ id: jobs.id, office: jobs.status, tech: jobs.technicianWorkStatus, persisted: jobs.lifecycleState })
    .from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!j) return null;
  const appts = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.jobId, jobId));
  return {
    input: {
      officeStatus: j.office as OfficeStatus,
      technicianWorkStatus: j.tech as TechnicianWorkStatus,
      appointmentStatuses: appts.map(a => a.status as AppointmentStatus),
    },
    persisted: (j.persisted as LifecycleState | null) ?? null,
  };
}

/**
 * Idempotent recorder. Recompute → if changed, insert exactly one audit row (dedup on
 * the UNIQUE idempotencyKey — duplicate webhooks collapse to one) and persist the new
 * state. Returns the plan (changed:false on no-op or duplicate).
 */
export async function applyLifecycle(db: Db, jobId: number, ctx: TransitionCtx): Promise<TransitionPlan | null> {
  const loaded = await loadInput(db, jobId);
  if (!loaded) return null;
  const plan = planLifecycleTransition(loaded.persisted, loaded.input, jobId, ctx);
  if (!plan.changed) return plan;
  try {
    await db.insert(jobLifecycleEvents).values({
      jobId, fromState: plan.from ?? null, toState: plan.to, source: ctx.source,
      actorId: ctx.actorId ?? null, actorRole: ctx.actorRole ?? null, actorName: ctx.actorName ?? null,
      reason: plan.reason, idempotencyKey: plan.idempotencyKey!,
    });
  } catch {
    // Duplicate key: another (duplicate/concurrent) delivery already recorded this exact
    // transition. Ensure state is consistent, then report as unchanged.
    await db.update(jobs).set({ lifecycleState: plan.to, lifecycleReason: plan.reason, lifecycleUpdatedAt: new Date() }).where(eq(jobs.id, jobId));
    return { ...plan, changed: false };
  }
  await db.update(jobs).set({ lifecycleState: plan.to, lifecycleReason: plan.reason, lifecycleUpdatedAt: new Date() }).where(eq(jobs.id, jobId));
  return plan;
}

/** Best-effort shadow hook for legacy write paths — swallows every error so it can
 *  never break an existing operation or a rollback (missing columns → silent no-op). */
export async function recordJobLifecycleSafe(jobId: number, ctx: TransitionCtx): Promise<void> {
  try { const db = await getDb(); if (db) await applyLifecycle(db, jobId, ctx); } catch { /* shadow best-effort */ }
}

/** Backfill a canonical state onto EVERY job. Idempotent (per-job backfill eventKey). */
export async function backfillAllJobLifecycles(db: Db): Promise<{ total: number; updated: number; unchanged: number }> {
  const rows = await db.select({ id: jobs.id, office: jobs.status, tech: jobs.technicianWorkStatus, persisted: jobs.lifecycleState }).from(jobs);
  const apptRows = await db.select({ jobId: appointments.jobId, status: appointments.status }).from(appointments).where(sql`${appointments.jobId} IS NOT NULL`);
  const byJob = new Map<number, AppointmentStatus[]>();
  for (const a of apptRows) { if (a.jobId == null) continue; const arr = byJob.get(a.jobId) ?? []; arr.push(a.status as AppointmentStatus); byJob.set(a.jobId, arr); }
  let updated = 0, unchanged = 0;
  for (const j of rows) {
    const input: LifecycleInput = { officeStatus: j.office as OfficeStatus, technicianWorkStatus: j.tech as TechnicianWorkStatus, appointmentStatuses: byJob.get(j.id) ?? [] };
    const plan = planLifecycleTransition((j.persisted as LifecycleState | null) ?? null, input, j.id, { source: "backfill", eventKey: "backfill:" + j.id });
    if (!plan.changed) { unchanged++; continue; }
    try {
      await db.insert(jobLifecycleEvents).values({ jobId: j.id, fromState: plan.from ?? null, toState: plan.to, source: "backfill", reason: plan.reason, idempotencyKey: plan.idempotencyKey! });
    } catch { /* already recorded */ }
    await db.update(jobs).set({ lifecycleState: plan.to, lifecycleReason: plan.reason, lifecycleUpdatedAt: new Date() }).where(eq(jobs.id, j.id));
    updated++;
  }
  return { total: rows.length, updated, unchanged };
}

export interface ReconciliationReport {
  totalJobs: number;
  withConflicts: number;
  missingLifecycleState: number;
  byTag: Record<string, number>;
  samples: Array<{ jobId: number; jobNumber: string | null; office: string; tech: string; derived: LifecycleState; persisted: LifecycleState | null; tags: string[] }>;
}

/** Reconciliation report over 100% of jobs. Report-only; never repairs. */
export async function buildReconciliationReport(db: Db): Promise<ReconciliationReport> {
  const rows = await db.select({ id: jobs.id, jobNumber: jobs.jobNumber, office: jobs.status, tech: jobs.technicianWorkStatus, persisted: jobs.lifecycleState }).from(jobs);
  const apptRows = await db.select({ jobId: appointments.jobId, status: appointments.status }).from(appointments).where(sql`${appointments.jobId} IS NOT NULL`);
  const byJob = new Map<number, AppointmentStatus[]>();
  for (const a of apptRows) { if (a.jobId == null) continue; const arr = byJob.get(a.jobId) ?? []; arr.push(a.status as AppointmentStatus); byJob.set(a.jobId, arr); }

  const byTag: Record<string, number> = {};
  let withConflicts = 0, missing = 0;
  const samples: ReconciliationReport["samples"] = [];
  for (const j of rows) {
    if (j.persisted == null) missing++;
    const input: LifecycleInput = { officeStatus: j.office as OfficeStatus, technicianWorkStatus: j.tech as TechnicianWorkStatus, appointmentStatuses: byJob.get(j.id) ?? [] };
    const tags = classifyJobConflicts({ ...input, persistedState: (j.persisted as LifecycleState | null) ?? null });
    if (tags.length) {
      withConflicts++;
      for (const t of tags) byTag[t] = (byTag[t] ?? 0) + 1;
      if (samples.length < 50) samples.push({ jobId: j.id, jobNumber: j.jobNumber, office: j.office, tech: j.tech, derived: deriveJobLifecycle(input).state, persisted: (j.persisted as LifecycleState | null) ?? null, tags });
    }
  }
  return { totalJobs: rows.length, withConflicts, missingLifecycleState: missing, byTag, samples };
}
