/**
 * Appointment invite orchestration (Task 8).
 *
 * Given an appointment + its attendees, either:
 *  - mirror it into Google Calendar (when connected) — Google emails the
 *    invites/updates/cancellations natively (sendUpdates=all); OR
 *  - fall back to emailing each attendee an .ics attachment they can add to
 *    any calendar app.
 *
 * All side effects are BEST EFFORT: this never throws to its caller, so a
 * failed invite can never break CRM appointment create/update.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  appointments as appointmentsTable,
  appointmentAttendees as attendeesTable,
  teamMembers as teamMembersTable,
  type Appointment,
  type AppointmentAttendee,
} from "../../drizzle/schema";
import { googleCalendarProvider, mapToGoogleEvent, DEFAULT_TIMEZONE } from "../integrations/google/calendar";
import { buildAppointmentTitle, buildAppointmentDescription } from "../../shared/appointmentTypes";
import { buildIcs, type IcsAttendee } from "./ics";
import { sendEmail } from "./emailService";

export type AttendeeRole = "organizer" | "team_member" | "customer" | "guest";

export interface AttendeeInput {
  email: string;
  name?: string | null;
  role: AttendeeRole;
  teamMemberId?: number | null;
}

export interface NormalizedAttendee {
  email: string;
  name: string | null;
  role: AttendeeRole;
  teamMemberId: number | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(v: string | null | undefined): boolean {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

const ROLE_PRIORITY: Record<AttendeeRole, number> = { organizer: 0, team_member: 1, customer: 2, guest: 3 };

/**
 * Normalize + de-duplicate attendees (pure, unit-tested). Invalid emails are
 * dropped; the customer email is added automatically when present; duplicates
 * collapse to the highest-priority role (organizer > team_member > customer > guest).
 */
export function normalizeAttendees(
  raw: AttendeeInput[],
  opts: { customerEmail?: string | null; customerName?: string | null } = {},
): NormalizedAttendee[] {
  const byEmail = new Map<string, NormalizedAttendee>();
  const add = (a: AttendeeInput) => {
    const email = a.email?.trim().toLowerCase();
    if (!isValidEmail(email)) return;
    const next: NormalizedAttendee = {
      email,
      name: a.name?.trim() || null,
      role: a.role,
      teamMemberId: a.teamMemberId ?? null,
    };
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, next);
      return;
    }
    // Keep the higher-priority role; prefer a non-null name / teamMemberId.
    if (ROLE_PRIORITY[next.role] < ROLE_PRIORITY[existing.role]) existing.role = next.role;
    existing.name = existing.name ?? next.name;
    existing.teamMemberId = existing.teamMemberId ?? next.teamMemberId;
  };

  for (const a of raw) add(a);
  if (opts.customerEmail && isValidEmail(opts.customerEmail)) {
    add({ email: opts.customerEmail, name: opts.customerName ?? null, role: "customer" });
  }
  return Array.from(byEmail.values());
}

/** Google/ICS event title: "<Appointment Type> – <Service Type>". */
export function appointmentSummary(appt: Pick<Appointment, "appointmentType" | "serviceType">): string {
  return buildAppointmentTitle(appt.appointmentType, appt.serviceType);
}

/** Resolved technicians for an appointment (primary from assignedToId, additional from attendee rows). */
export interface TechnicianNames {
  assignedTechnician: string | null;
  assignedTechnicianEmail: string | null;
  additionalTechnicians: string[];
}

/**
 * Look up technicians: the primary (appointments.assignedToId) and any
 * additional technicians stored as team_member attendees. Returns display names
 * (for the description) plus the primary's email (to add as an attendee).
 */
export async function resolveTechnicians(appt: Appointment, attendees: AppointmentAttendee[]): Promise<TechnicianNames> {
  const db = await getDb();
  const teamAttendees = attendees.filter(a => a.role === "team_member" && a.teamMemberId != null);
  const ids = new Set<number>();
  if (appt.assignedToId != null) ids.add(appt.assignedToId);
  for (const a of teamAttendees) ids.add(a.teamMemberId as number);

  const byId = new Map<number, { name: string; email: string }>();
  if (db && ids.size) {
    const rows = await db
      .select({ id: teamMembersTable.id, name: teamMembersTable.name, email: teamMembersTable.email })
      .from(teamMembersTable)
      .where(inArray(teamMembersTable.id, Array.from(ids)));
    for (const r of rows) byId.set(r.id, { name: r.name, email: r.email });
  }
  const primary = appt.assignedToId != null ? byId.get(appt.assignedToId) : undefined;
  const additionalTechnicians = teamAttendees
    .filter(a => a.teamMemberId !== appt.assignedToId)
    .map(a => a.name || byId.get(a.teamMemberId as number)?.name || "")
    .filter(Boolean);
  return {
    assignedTechnician: primary?.name ?? null,
    assignedTechnicianEmail: primary?.email ?? null,
    additionalTechnicians,
  };
}

export function appointmentDescription(
  appt: Pick<Appointment, "fullName" | "phone" | "email" | "propertyAddress" | "appointmentType" | "serviceType" | "notes">,
  techs?: TechnicianNames,
): string {
  return buildAppointmentDescription({
    fullName: appt.fullName,
    phone: appt.phone,
    email: appt.email,
    propertyAddress: appt.propertyAddress,
    appointmentType: appt.appointmentType,
    serviceType: appt.serviceType,
    assignedTechnician: techs?.assignedTechnician ?? null,
    additionalTechnicians: techs?.additionalTechnicians ?? [],
    notes: appt.notes,
  });
}

function icsUid(appointmentId: number): string {
  return `appointment-${appointmentId}@mechanicalenterprise.com`;
}

function organizerEmail(connectedEmail?: string | null): string {
  return connectedEmail || process.env.INVITE_ORGANIZER_EMAIL || "appointments@mechanicalenterprise.com";
}

function inviteEmailHtml(summary: string, whenLabel: string, location: string | null, cancel: boolean): string {
  const heading = cancel ? "Appointment Canceled" : "You're Invited";
  const intro = cancel
    ? "This appointment has been canceled. The attached calendar file will remove it from your calendar."
    : "You've been invited to an appointment. Add it to your calendar using the attached file.";
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#374151;">
    <h2 style="color:#1e3a5f;">${heading}</h2>
    <p>${intro}</p>
    <table style="margin:12px 0;font-size:15px;">
      <tr><td style="padding:2px 8px;color:#6b7280;">What</td><td>${summary}</td></tr>
      <tr><td style="padding:2px 8px;color:#6b7280;">When</td><td>${whenLabel}</td></tr>
      ${location ? `<tr><td style="padding:2px 8px;color:#6b7280;">Where</td><td>${location}</td></tr>` : ""}
    </table>
    <p style="color:#9ca3af;font-size:12px;">Mechanical Enterprise · Essex County, NJ · (862) 423-9396</p>
  </body></html>`;
}

/** Send an .ics invite/cancellation to every attendee. Returns per-email success. */
async function sendIcsInvites(
  appt: Appointment,
  attendees: AppointmentAttendee[],
  opts: { cancel: boolean; organizer: string },
): Promise<Map<number, boolean>> {
  const results = new Map<number, boolean>();
  if (!appt.scheduledAt) return results;
  const start = new Date(appt.scheduledAt);
  const end = new Date(start.getTime() + appt.durationMinutes * 60_000);
  const summary = appointmentSummary(appt);
  const whenLabel = start.toLocaleString("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    dateStyle: "full",
    timeStyle: "short",
  });
  // Monotonically increasing sequence so updates/cancellations supersede.
  const sequence = Math.floor(Date.now() / 1000);
  const icsAttendees: IcsAttendee[] = attendees.map(a => ({ email: a.email, name: a.name }));

  for (const a of attendees) {
    const ics = buildIcs({
      uid: icsUid(appt.id),
      sequence,
      method: opts.cancel ? "CANCEL" : "REQUEST",
      status: opts.cancel ? "CANCELLED" : "CONFIRMED",
      start,
      end,
      summary,
      description: appointmentDescription(appt),
      location: appt.propertyAddress,
      organizer: { email: opts.organizer, name: "Mechanical Enterprise" },
      attendees: icsAttendees,
    });
    const ok = await sendEmail({
      to: a.email,
      subject: `${opts.cancel ? "Canceled: " : ""}${summary} — ${whenLabel}`,
      html: inviteEmailHtml(summary, whenLabel, appt.propertyAddress, opts.cancel),
      attachments: [
        {
          filename: opts.cancel ? "cancel.ics" : "invite.ics",
          content: Buffer.from(ics, "utf8"),
          contentType: `text/calendar; method=${opts.cancel ? "CANCEL" : "REQUEST"}; charset=UTF-8`,
        },
      ],
    }).catch(() => false);
    results.set(a.id, ok);
  }
  return results;
}

function rollupInviteStatus(perAttendee: boolean[]): "none" | "sent" | "partial" | "failed" {
  if (perAttendee.length === 0) return "none";
  const sent = perAttendee.filter(Boolean).length;
  if (sent === perAttendee.length) return "sent";
  if (sent === 0) return "failed";
  return "partial";
}

/**
 * Sync one appointment's calendar event + invites. Loads the appointment and
 * its attendees, mirrors to Google (if connected) or emails ICS invites, then
 * persists sync/invite status. Never throws.
 */
export async function syncAppointmentInvites(params: {
  appointmentId: number;
  cancel?: boolean;
}): Promise<void> {
  const cancel = params.cancel ?? false;
  try {
    const db = await getDb();
    if (!db) return;
    const appt = (
      await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.appointmentId)).limit(1)
    )[0];
    if (!appt) return;
    const attendees = await db
      .select()
      .from(attendeesTable)
      .where(eq(attendeesTable.appointmentId, params.appointmentId));

    // Nothing to invite and nothing synced → nothing to do.
    if (attendees.length === 0 && !appt.googleCalendarEventId) return;
    if (!appt.scheduledAt) return;

    const conn = await googleCalendarProvider.getConnection();
    const connected = Boolean(conn && conn.status === "connected");

    // ── Cancellation ──
    if (cancel) {
      let googleSyncStatus = appt.googleSyncStatus;
      let googleSyncError: string | null = null;
      if (appt.googleCalendarEventId && connected) {
        try {
          await googleCalendarProvider.cancelEvent(appt.googleCalendarEventId);
          await googleCalendarProvider.touchLastSync();
          googleSyncStatus = "not_synced";
        } catch (e) {
          googleSyncStatus = "error";
          googleSyncError = (e as Error).message.slice(0, 500);
        }
      } else if (attendees.length) {
        await sendIcsInvites(appt, attendees, { cancel: true, organizer: organizerEmail(conn?.googleAccountEmail) });
      }
      await db
        .update(appointmentsTable)
        .set({ googleSyncStatus, googleSyncError, googleCalendarEventId: null, inviteStatus: "none" })
        .where(eq(appointmentsTable.id, appt.id));
      return;
    }

    // ── Create / update ──
    const techs = await resolveTechnicians(appt, attendees);
    // Google attendees = customer + guests + additional techs + the primary technician.
    const googleAttendees = attendees.map(a => ({ email: a.email, name: a.name }));
    if (
      techs.assignedTechnicianEmail &&
      !googleAttendees.some(x => x.email.toLowerCase() === techs.assignedTechnicianEmail!.toLowerCase())
    ) {
      googleAttendees.push({ email: techs.assignedTechnicianEmail, name: techs.assignedTechnician });
    }
    const eventInput = {
      summary: appointmentSummary(appt),
      description: appointmentDescription(appt, techs),
      location: appt.propertyAddress,
      scheduledAt: new Date(appt.scheduledAt),
      durationMinutes: appt.durationMinutes,
      attendees: googleAttendees,
      timeZone: DEFAULT_TIMEZONE,
      reminderMinutes: appt.reminderMinutes,
      // Request a Meet when the user asked for one and we don't have a link yet
      // (so an existing event's Meet is preserved on update instead of re-created).
      createMeet: appt.googleMeetRequested && !appt.googleMeetUrl,
      meetRequestId: `meet-${appt.id}`,
    };

    if (connected) {
      try {
        const payload = mapToGoogleEvent(eventInput);
        let eventId = appt.googleCalendarEventId ?? null;
        let calendarId = appt.googleCalendarId ?? conn!.googleCalendarId;
        let meetUrl: string | null = appt.googleMeetUrl ?? null;
        if (eventId) {
          const upd = await googleCalendarProvider.updateEvent(eventId, payload);
          if (upd.meetUrl) meetUrl = upd.meetUrl;
        } else {
          const created = await googleCalendarProvider.createEvent(payload);
          eventId = created.id;
          calendarId = created.calendarId;
          if (created.meetUrl) meetUrl = created.meetUrl;
        }
        await googleCalendarProvider.touchLastSync();
        if (attendees.length) {
          await db
            .update(attendeesTable)
            .set({ inviteStatus: "sent" })
            .where(eq(attendeesTable.appointmentId, appt.id));
        }
        await db
          .update(appointmentsTable)
          .set({
            googleCalendarEventId: eventId,
            googleCalendarId: calendarId,
            googleMeetUrl: meetUrl,
            googleSyncStatus: "synced",
            googleSyncError: null,
            inviteStatus: attendees.length ? "sent" : "none",
          })
          .where(eq(appointmentsTable.id, appt.id));
        return;
      } catch (e) {
        // Google failed — fall through to the ICS email fallback so invites still go out.
        await db
          .update(appointmentsTable)
          .set({ googleSyncStatus: "error", googleSyncError: (e as Error).message.slice(0, 500) })
          .where(eq(appointmentsTable.id, appt.id));
      }
    }

    // ── ICS email fallback (not connected, or Google failed) ──
    if (attendees.length) {
      const results = await sendIcsInvites(appt, attendees, {
        cancel: false,
        organizer: organizerEmail(conn?.googleAccountEmail),
      });
      for (const a of attendees) {
        await db
          .update(attendeesTable)
          .set({ inviteStatus: results.get(a.id) ? "sent" : "failed" })
          .where(eq(attendeesTable.id, a.id));
      }
      const rollup = rollupInviteStatus(attendees.map(a => Boolean(results.get(a.id))));
      await db.update(appointmentsTable).set({ inviteStatus: rollup }).where(eq(appointmentsTable.id, appt.id));
    }
  } catch (e) {
    // Absolute backstop — invites must never break the appointment write.
    console.warn("[AppointmentInvites] sync failed:", (e as Error).message);
  }
}

/** Replace an appointment's attendee rows with the given normalized set. */
export async function replaceAttendees(appointmentId: number, attendees: NormalizedAttendee[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(attendeesTable).where(eq(attendeesTable.appointmentId, appointmentId));
  if (attendees.length === 0) return;
  await db.insert(attendeesTable).values(
    attendees.map(a => ({
      appointmentId,
      email: a.email,
      name: a.name,
      role: a.role,
      teamMemberId: a.teamMemberId,
    })),
  );
}
