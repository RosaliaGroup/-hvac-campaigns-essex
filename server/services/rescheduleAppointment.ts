/**
 * Safe rescheduling for the Vapi `rescheduleAppointment` tool (Jessica, the
 * Mechanical Enterprise AI receptionist).
 *
 * Mechanical-only: this uses ONLY the Mechanical database (`appointments`),
 * Mechanical customers/properties (via the appointment row), and the shared,
 * database-driven Google Calendar connection. There is NO external/legacy CRM,
 * API, calendar or SMS dependency and NO global calendar environment variable —
 * the calendar a reschedule mirrors into is resolved from the appointment's own
 * `googleCalendarId` (falling back to the stored connection) inside the existing
 * `syncAppointmentInvites` service.
 *
 * Safety properties (see per-step comments):
 *  1. The appointment is identified only by safe identifiers scoped to the
 *     caller — an explicit id (whose phone must match the caller) or the caller's
 *     own normalized phone.
 *  2. A caller can never touch another customer's appointment.
 *  3. Ambiguous phone matches are rejected for disambiguation, never guessed.
 *  4. Completed / canceled / in-progress ("arrived") appointments are rejected.
 *  5. The new date+time must parse to a real FUTURE instant.
 *  6. The database row is the source of truth; the Google Calendar event is a
 *     downstream mirror updated afterwards through the project's established
 *     `syncAppointmentInvites` reconciliation path (never throws; records
 *     `googleSyncStatus`/`googleSyncError` so drift is visible, never silent).
 *  7. Writes are guarded with an optimistic pre-state check (id + status +
 *     prior scheduledAt) so a concurrent change is detected instead of clobbered.
 *  8. Duplicate Vapi retries are idempotent: a call whose target time already
 *     equals the row's `scheduledAt` re-mirrors the calendar and returns success
 *     without re-writing or re-notifying.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appointments as appointmentsTable, type Appointment } from "../../drizzle/schema";
import { parsePreferredDate, parsePreferredTime } from "./appointmentTime";
import { syncAppointmentInvites } from "./appointmentInvites";
import { notifyOwner } from "../_core/notification";

/** Statuses that may still be moved to a new time. */
const RESCHEDULABLE_STATUSES = ["pending", "confirmed", "rescheduled"] as const;

/**
 * Last-10-digit phone key, identical in meaning to routers/customers
 * `normalizePhone`. Inlined so this module (and its pure core) stay free of the
 * customers-router import weight.
 */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null; // too short to be a real match key
  return digits.slice(-10);
}

export type RescheduleReason =
  | "missing_fields"
  | "invalid_time"
  | "not_found"
  | "ambiguous"
  | "wrong_customer"
  | "completed"
  | "cancelled"
  | "locked"
  | "stale"
  | "internal_error";

/** Outcome of mirroring the change into Google Calendar. */
export type CalendarOutcome =
  | "synced" // event updated/created in Google
  | "no_event" // nothing linked to mirror (no attendees / never synced) — consistent
  | "error" // Google failed; DB is authoritative, drift recorded for reconciliation
  | "skipped"; // row vanished before mirror could run

export interface RescheduleOption {
  appointmentId: number;
  description: string;
  date: string | null;
  time: string | null;
}

export interface RescheduleSuccess {
  success: true;
  /** true when this call moved the time; false when it was an idempotent retry. */
  changed: boolean;
  appointmentId: number;
  fullName: string;
  newDate: string;
  newTime: string;
  /** ISO of the resolved new instant. */
  scheduledAt: string;
  calendar: CalendarOutcome;
  message: string;
  /** Present when the DB updated but the Google mirror still needs reconciliation. */
  warning?: string;
}

export interface RescheduleFailure {
  success: false;
  reason: RescheduleReason;
  message: string;
  /** For `ambiguous`: the upcoming appointments the caller must choose between. */
  options?: RescheduleOption[];
}

export type RescheduleResult = RescheduleSuccess | RescheduleFailure;

export interface RescheduleRequest {
  phone?: string | null;
  /** Optional explicit appointment id (still authorized against the caller phone). */
  appointmentId?: number | null;
  newDate: string;
  newTime: string;
  /** Vapi call id — carried for provenance/logging; idempotency keys off the time. */
  vapiCallId?: string | null;
}

/**
 * Injected side-effect boundary. The real implementation talks to the Mechanical
 * DB and the shared Google Calendar sync; tests provide in-memory fakes.
 */
export interface RescheduleDeps {
  now: Date;
  loadById(id: number): Promise<Appointment | null>;
  /**
   * Reschedulable (pending/confirmed/rescheduled), non-past appointments whose
   * caller phone matches `key`. Already isolated to this caller.
   */
  loadActiveByPhone(key: string): Promise<Appointment[]>;
  /**
   * Optimistically write the new time. The write is guarded on the row still
   * being in the expected pre-state so a concurrent change is detected. Returns
   * affected-row count (0 = stale, lost the race).
   */
  persistReschedule(input: {
    id: number;
    expectedStatus: Appointment["status"];
    expectedScheduledAt: Date | null;
    newDate: string;
    newTime: string;
    scheduledAt: Date;
    notes: string | null;
  }): Promise<number>;
  /** Mirror the appointment into Google Calendar (best-effort). */
  syncCalendar(id: number): Promise<CalendarOutcome>;
  notify(input: { appt: Appointment; newDate: string; newTime: string }): Promise<void>;
}

/**
 * Validate a requested new date+time. STRICT: unlike calendar-placement parsing,
 * a reschedule refuses to guess — both the date and the time must parse, and the
 * result must be in the future. (Booking may default a missing time to 9am;
 * moving an existing appointment to a wrong time is worse than refusing.)
 */
export function validateNewDateTime(
  dateRaw: string | null | undefined,
  timeRaw: string | null | undefined,
  now: Date,
): { ok: true; scheduledAt: Date } | { ok: false } {
  const date = parsePreferredDate(dateRaw, now);
  const time = parsePreferredTime(timeRaw);
  if (!date || !time) return { ok: false };
  const scheduledAt = new Date(date);
  scheduledAt.setHours(time.hours, time.minutes, 0, 0);
  if (scheduledAt.getTime() <= now.getTime()) return { ok: false };
  return { ok: true, scheduledAt };
}

function toOption(appt: Appointment): RescheduleOption {
  return {
    appointmentId: appt.id,
    description: appt.appointmentType,
    date: appt.preferredDate ?? null,
    time: appt.preferredTime ?? null,
  };
}

/** Append a who-rescheduled audit line, preserving any existing notes. */
export function appendRescheduleNote(existing: string | null, newDate: string, newTime: string): string {
  const stamp = `[Rescheduled by Jessica (AI receptionist) → ${newDate} at ${newTime}]`;
  return existing && existing.trim() ? `${existing}\n${stamp}` : stamp;
}

function buildSuccess(
  appt: Appointment,
  req: RescheduleRequest,
  target: Date,
  calendar: CalendarOutcome,
  changed: boolean,
): RescheduleSuccess {
  const base = changed
    ? `Your appointment is rescheduled to ${req.newDate} at ${req.newTime}.`
    : `Your appointment is already set for ${req.newDate} at ${req.newTime}.`;
  // DB is the source of truth. A calendar hiccup does NOT fail the reschedule —
  // the new time is saved and the mirror is flagged for reconciliation — but we
  // tell the caller so nothing is left silently inconsistent.
  const warning =
    calendar === "error" ? "The new time is saved; the calendar invite will refresh shortly." : undefined;
  return {
    success: true,
    changed,
    appointmentId: appt.id,
    fullName: appt.fullName,
    newDate: req.newDate,
    newTime: req.newTime,
    scheduledAt: target.toISOString(),
    calendar,
    message: warning ? `${base} ${warning}` : `${base} A confirmation will be sent shortly.`,
    ...(warning ? { warning } : {}),
  };
}

/**
 * Pure orchestration of a reschedule against injected side effects. All safety
 * decisions live here so they are exhaustively unit-testable without a database.
 */
export async function reschedule(req: RescheduleRequest, deps: RescheduleDeps): Promise<RescheduleResult> {
  // 1. Contract: caller phone + new date + new time are required (unchanged).
  const key = phoneKey(req.phone);
  if (!key || !req.newDate?.trim() || !req.newTime?.trim()) {
    return {
      success: false,
      reason: "missing_fields",
      message: "I need the phone number on the appointment plus the new date and time to reschedule.",
    };
  }

  // 2. The new date+time must be a real, future instant.
  const validated = validateNewDateTime(req.newDate, req.newTime, deps.now);
  if (!validated.ok) {
    return {
      success: false,
      reason: "invalid_time",
      message: `I couldn't read "${req.newDate} at ${req.newTime}" as a valid future date and time. Could you give me a specific day and time?`,
    };
  }
  const target = validated.scheduledAt;

  // 3. Identify the appointment — only ever the caller's own.
  let appt: Appointment | null;
  if (req.appointmentId != null) {
    appt = await deps.loadById(req.appointmentId);
    if (!appt) {
      return { success: false, reason: "not_found", message: "I couldn't find an appointment with that reference." };
    }
    // Customer isolation: an explicit id is only honored when it belongs to the
    // caller's phone. This blocks rescheduling another customer's appointment.
    if (phoneKey(appt.phone) !== key) {
      return {
        success: false,
        reason: "wrong_customer",
        message: "That appointment is under a different phone number, so I'm not able to change it from this call.",
      };
    }
  } else {
    const candidates = await deps.loadActiveByPhone(key);
    if (candidates.length === 0) {
      return {
        success: false,
        reason: "not_found",
        message: "I don't see an upcoming appointment under this number to reschedule. Would you like to book one?",
      };
    }
    if (candidates.length > 1) {
      // Never guess between multiple upcoming appointments.
      return {
        success: false,
        reason: "ambiguous",
        message:
          "I see more than one upcoming appointment under this number. Which one would you like to move — can you tell me the date or type?",
        options: candidates.map(toOption),
      };
    }
    appt = candidates[0];
  }

  // 4. State guards — never move a finished, canceled, or in-progress visit.
  if (appt.status === "completed") {
    return {
      success: false,
      reason: "completed",
      message: "That appointment is already completed, so it can't be rescheduled. I'd be happy to book a new one.",
    };
  }
  if (appt.status === "cancelled") {
    return {
      success: false,
      reason: "cancelled",
      message: "That appointment was canceled. I can book a new one for you instead.",
    };
  }
  if (appt.status === "arrived") {
    return {
      success: false,
      reason: "locked",
      message:
        "A technician is already on the way or on site for that appointment, so I can't move it. Let me connect you with the office.",
    };
  }

  // 5. Idempotency: a duplicate retry whose target time already equals the row's
  //    scheduledAt must not re-write or re-notify — just make sure the calendar
  //    mirror is in place and report success.
  const alreadyAtTarget = appt.scheduledAt != null && new Date(appt.scheduledAt).getTime() === target.getTime();
  if (alreadyAtTarget) {
    const calendar = await deps.syncCalendar(appt.id);
    return buildSuccess(appt, req, target, calendar, false);
  }

  // 6. Persist the new time (guarded on the observed pre-state).
  const notes = appendRescheduleNote(appt.notes, req.newDate, req.newTime);
  let affected: number;
  try {
    affected = await deps.persistReschedule({
      id: appt.id,
      expectedStatus: appt.status,
      expectedScheduledAt: appt.scheduledAt ?? null,
      newDate: req.newDate,
      newTime: req.newTime,
      scheduledAt: target,
      notes,
    });
  } catch (e) {
    // DB write failed BEFORE any calendar change → nothing is inconsistent; the
    // appointment keeps its old time and the (still-current) calendar event.
    console.error("[Reschedule] DB update failed:", (e as Error).message);
    return {
      success: false,
      reason: "internal_error",
      message: "Something went wrong saving the new time. Nothing was changed — please try again in a moment.",
    };
  }
  if (affected === 0) {
    // Optimistic guard tripped: the row changed under us. Do NOT touch the
    // calendar — the DB never moved, so there is nothing to keep consistent.
    return {
      success: false,
      reason: "stale",
      message: "That appointment was just updated somewhere else. Let me re-check it and try again.",
    };
  }

  // 7. Mirror to Google Calendar. The DB is already the source of truth; this
  //    updates the linked event via the appointment's own googleCalendarId
  //    (database-driven) and never throws — a failure is recorded as drift for
  //    reconciliation rather than silently swallowed.
  const calendar = await deps.syncCalendar(appt.id);

  // 8. Owner notification (best-effort — must never fail the reschedule).
  try {
    await deps.notify({ appt, newDate: req.newDate, newTime: req.newTime });
  } catch {
    /* non-fatal */
  }

  return buildSuccess(appt, req, target, calendar, true);
}

// ── Real dependency wiring (Mechanical DB + shared Google Calendar sync) ───────

async function loadRow(id: number): Promise<Appointment | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export function createRescheduleDeps(now: Date = new Date()): RescheduleDeps {
  return {
    now,
    loadById: loadRow,

    async loadActiveByPhone(key: string): Promise<Appointment[]> {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(appointmentsTable)
        .where(inArray(appointmentsTable.status, [...RESCHEDULABLE_STATUSES]))
        .orderBy(desc(appointmentsTable.scheduledAt));
      const cutoff = now.getTime();
      return rows.filter(
        r =>
          phoneKey(r.phone) === key &&
          // Upcoming window: unscheduled backlog rows, or a future scheduledAt.
          (r.scheduledAt == null || new Date(r.scheduledAt).getTime() > cutoff),
      );
    },

    async persistReschedule(input): Promise<number> {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Optimistic pre-state guard: same id, same status, and unchanged prior
      // scheduledAt. If any changed, affectedRows === 0 and we treat it as stale.
      const scheduledGuard =
        input.expectedScheduledAt == null
          ? sql`${appointmentsTable.scheduledAt} IS NULL`
          : eq(appointmentsTable.scheduledAt, input.expectedScheduledAt);
      const result = await db
        .update(appointmentsTable)
        .set({
          preferredDate: input.newDate,
          preferredTime: input.newTime,
          scheduledAt: input.scheduledAt,
          status: "rescheduled",
          notes: input.notes,
          // Customer, property, job description, source and assignment are
          // deliberately left untouched.
        })
        .where(
          and(
            eq(appointmentsTable.id, input.id),
            eq(appointmentsTable.status, input.expectedStatus),
            scheduledGuard,
          ),
        );
      return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
    },

    async syncCalendar(id: number): Promise<CalendarOutcome> {
      // Established reconciliation path: updates the linked Google event (or
      // creates one when attendees exist), records googleSyncStatus, never throws.
      await syncAppointmentInvites({ appointmentId: id });
      const after = await loadRow(id);
      if (!after) return "skipped";
      if (after.googleSyncStatus === "error") return "error";
      return after.googleCalendarEventId ? "synced" : "no_event";
    },

    async notify({ appt, newDate, newTime }): Promise<void> {
      await notifyOwner({
        title: `🔄 Appointment Rescheduled by Jessica`,
        content: `Jessica (AI receptionist) rescheduled an appointment:\n\nName: ${appt.fullName}\nPhone: ${appt.phone}\nNew Date: ${newDate}\nNew Time: ${newTime}\nPrevious: ${appt.preferredDate} at ${appt.preferredTime}\nAppointment: ${appt.appointmentType}\n\nLog in to your dashboard to review.`,
      });
    },
  };
}

/** Entry point used by the Vapi tool handler. */
export async function rescheduleForVapi(req: RescheduleRequest): Promise<RescheduleResult> {
  return reschedule(req, createRescheduleDeps());
}
