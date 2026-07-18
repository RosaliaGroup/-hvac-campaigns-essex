import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import type { Appointment } from "../../drizzle/schema";
import {
  reschedule,
  validateNewDateTime,
  appendRescheduleNote,
  phoneKey,
  type RescheduleDeps,
  type CalendarOutcome,
  type RescheduleRequest,
} from "./rescheduleAppointment";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-07-20T09:00:00");
const CALLER_PHONE = "(973) 555-0142";

function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    fullName: "Jane Doe",
    phone: CALLER_PHONE,
    email: "jane@example.com",
    propertyAddress: "12 Main St, Montclair NJ",
    propertyType: "residential",
    appointmentType: "service_call",
    serviceType: null,
    preferredDate: "2026-08-01",
    preferredTime: "10am",
    scheduledAt: new Date("2026-08-01T10:00:00"),
    durationMinutes: 60,
    assignedToId: 5,
    jobType: null,
    priority: "normal",
    source: "phone",
    issueDescription: "No heat upstairs",
    status: "pending",
    notes: null,
    vapiCallId: "call_original",
    bookedBy: "jessica",
    customerId: 7,
    propertyId: 3,
    jobId: null,
    googleCalendarEventId: "evt_123",
    googleCalendarId: "primary",
    googleSyncStatus: "synced",
    googleSyncError: null,
    inviteStatus: "none",
    reminderMinutes: null,
    googleMeetRequested: false,
    googleMeetUrl: null,
    createdAt: new Date("2026-07-01T00:00:00"),
    updatedAt: new Date("2026-07-01T00:00:00"),
    ...overrides,
  } as Appointment;
}

interface FakeOpts {
  now?: Date;
  calendar?: CalendarOutcome;
  persistFail?: boolean;
  /** Force a specific affected-row count (e.g. 0 to simulate a stale/lost race). */
  persistAffected?: number;
}

function makeDeps(store: Appointment[], opts: FakeOpts = {}) {
  const now = opts.now ?? NOW;
  const calls = {
    loadById: [] as number[],
    loadByPhone: [] as string[],
    persisted: [] as Array<{ id: number; scheduledAt: Date; notes: string | null }>,
    synced: [] as number[],
    notified: [] as number[],
  };
  const active = new Set(["pending", "confirmed", "rescheduled"]);
  const deps: RescheduleDeps = {
    now,
    async loadById(id) {
      calls.loadById.push(id);
      return store.find(a => a.id === id) ?? null;
    },
    async loadActiveByPhone(key) {
      calls.loadByPhone.push(key);
      return store.filter(
        a =>
          phoneKey(a.phone) === key &&
          active.has(a.status) &&
          (a.scheduledAt == null || a.scheduledAt.getTime() > now.getTime()),
      );
    },
    async persistReschedule(input) {
      if (opts.persistFail) throw new Error("db down");
      if (opts.persistAffected != null) {
        if (opts.persistAffected > 0) applyWrite(store, input);
        calls.persisted.push({ id: input.id, scheduledAt: input.scheduledAt, notes: input.notes });
        return opts.persistAffected;
      }
      const appt = store.find(a => a.id === input.id);
      // Mirror the real optimistic guard: id + status + prior scheduledAt.
      if (
        !appt ||
        appt.status !== input.expectedStatus ||
        (appt.scheduledAt?.getTime() ?? null) !== (input.expectedScheduledAt?.getTime() ?? null)
      ) {
        return 0;
      }
      applyWrite(store, input);
      calls.persisted.push({ id: input.id, scheduledAt: input.scheduledAt, notes: input.notes });
      return 1;
    },
    async syncCalendar(id) {
      calls.synced.push(id);
      return opts.calendar ?? "synced";
    },
    async notify({ appt }) {
      calls.notified.push(appt.id);
    },
  };
  return { deps, calls, now };
}

function applyWrite(store: Appointment[], input: Parameters<RescheduleDeps["persistReschedule"]>[0]) {
  const appt = store.find(a => a.id === input.id);
  if (!appt) return;
  appt.status = "rescheduled";
  appt.scheduledAt = input.scheduledAt;
  appt.preferredDate = input.newDate;
  appt.preferredTime = input.newTime;
  appt.notes = input.notes;
}

function baseReq(overrides: Partial<RescheduleRequest> = {}): RescheduleRequest {
  return { phone: CALLER_PHONE, newDate: "2026-08-05", newTime: "2pm", vapiCallId: "call_reschedule", ...overrides };
}

// ── Pure helpers ────────────────────────────────────────────────────────────

describe("phoneKey", () => {
  it("normalizes to last 10 digits regardless of formatting", () => {
    expect(phoneKey("(973) 555-0142")).toBe("9735550142");
    expect(phoneKey("+1 973 555 0142")).toBe("9735550142");
    expect(phoneKey("19735550142")).toBe("9735550142");
  });
  it("rejects too-short / empty input", () => {
    expect(phoneKey("12345")).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe("validateNewDateTime", () => {
  it("accepts a real future date+time", () => {
    const r = validateNewDateTime("2026-08-05", "2pm", NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scheduledAt.getHours()).toBe(14);
  });
  it("rejects an unparseable time (no silent 9am default)", () => {
    expect(validateNewDateTime("2026-08-05", "whenever", NOW).ok).toBe(false);
  });
  it("rejects an unparseable date", () => {
    expect(validateNewDateTime("someday", "2pm", NOW).ok).toBe(false);
  });
  it("rejects a time in the past", () => {
    expect(validateNewDateTime("2026-07-19", "2pm", NOW).ok).toBe(false);
  });
});

describe("appendRescheduleNote", () => {
  it("stamps who rescheduled and preserves prior notes", () => {
    expect(appendRescheduleNote(null, "2026-08-05", "2pm")).toContain("Jessica (AI receptionist)");
    const withPrior = appendRescheduleNote("Gate code 4432", "2026-08-05", "2pm");
    expect(withPrior).toContain("Gate code 4432");
    expect(withPrior).toContain("Rescheduled by Jessica");
  });
});

// ── Orchestration ─────────────────────────────────────────────────────────────

describe("reschedule", () => {
  it("successfully reschedules the caller's appointment and mirrors the calendar", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.changed).toBe(true);
    expect(res.calendar).toBe("synced");
    expect(res.newDate).toBe("2026-08-05");
    expect(calls.persisted).toHaveLength(1);
    expect(calls.synced).toEqual([1]); // calendar mirrored AFTER db write
    expect(calls.notified).toEqual([1]);
    // Identity / assignment / job details preserved.
    expect(store[0].customerId).toBe(7);
    expect(store[0].assignedToId).toBe(5);
    expect(store[0].issueDescription).toBe("No heat upstairs");
    expect(store[0].status).toBe("rescheduled");
  });

  it("finds the appointment by explicit id when it belongs to the caller", async () => {
    const store = [makeAppt({ id: 42 }), makeAppt({ id: 43, phone: "(201) 555-9999" })];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq({ appointmentId: 42 }), deps);

    expect(res.success).toBe(true);
    if (res.success) expect(res.appointmentId).toBe(42);
    expect(calls.loadById).toEqual([42]);
    expect(calls.loadByPhone).toEqual([]); // id path — no phone scan
  });

  it("finds the appointment by caller phone when no id is supplied", async () => {
    const store = [makeAppt({ id: 7 })];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(true);
    if (res.success) expect(res.appointmentId).toBe(7);
    expect(calls.loadByPhone).toEqual(["9735550142"]);
  });

  it("refuses to guess between multiple upcoming appointments (disambiguation)", async () => {
    const store = [
      makeAppt({ id: 1, preferredDate: "2026-08-01" }),
      makeAppt({ id: 2, preferredDate: "2026-08-09", scheduledAt: new Date("2026-08-09T10:00:00") }),
    ];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.reason).toBe("ambiguous");
    expect(res.options).toHaveLength(2);
    expect(res.options?.map(o => o.appointmentId).sort()).toEqual([1, 2]);
    expect(calls.persisted).toHaveLength(0);
    expect(calls.synced).toHaveLength(0);
  });

  it("blocks rescheduling another customer's appointment (wrong-customer)", async () => {
    const store = [makeAppt({ id: 99, phone: "(201) 555-9999", customerId: 88 })];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq({ appointmentId: 99 }), deps);

    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("wrong_customer");
    expect(calls.persisted).toHaveLength(0);
    expect(calls.synced).toHaveLength(0);
  });

  it("rejects a completed appointment", async () => {
    const store = [makeAppt({ status: "completed" })];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq({ appointmentId: 1 }), deps);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("completed");
    expect(calls.persisted).toHaveLength(0);
  });

  it("rejects a canceled appointment", async () => {
    const store = [makeAppt({ status: "cancelled" })];
    const { deps } = makeDeps(store);
    const res = await reschedule(baseReq({ appointmentId: 1 }), deps);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("cancelled");
  });

  it("rejects an in-progress (arrived) appointment as locked", async () => {
    const store = [makeAppt({ status: "arrived" })];
    const { deps } = makeDeps(store);
    const res = await reschedule(baseReq({ appointmentId: 1 }), deps);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("locked");
  });

  it("rejects an invalid new time without touching anything", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store);
    const res = await reschedule(baseReq({ newTime: "sometime soon" }), deps);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("invalid_time");
    expect(calls.persisted).toHaveLength(0);
    expect(calls.synced).toHaveLength(0);
  });

  it("reports not_found when no appointment matches (by phone or id)", async () => {
    const byPhone = await reschedule(baseReq(), makeDeps([]).deps);
    expect(byPhone.success).toBe(false);
    if (!byPhone.success) expect(byPhone.reason).toBe("not_found");

    const byId = await reschedule(baseReq({ appointmentId: 123 }), makeDeps([]).deps);
    expect(byId.success).toBe(false);
    if (!byId.success) expect(byId.reason).toBe("not_found");
  });

  it("still succeeds (consistently) when there is no linked calendar event", async () => {
    const store = [makeAppt({ googleCalendarEventId: null, googleCalendarId: null })];
    const { deps } = makeDeps(store, { calendar: "no_event" });
    const res = await reschedule(baseReq(), deps);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.calendar).toBe("no_event");
      expect(res.warning).toBeUndefined();
    }
  });

  it("keeps the DB authoritative and warns when the Google Calendar update fails", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store, { calendar: "error" });
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(true); // DB is the source of truth; new time is saved
    if (!res.success) return;
    expect(res.calendar).toBe("error");
    expect(res.warning).toBeTruthy();
    expect(store[0].status).toBe("rescheduled"); // db write happened
    expect(calls.synced).toEqual([1]); // mirror was attempted
  });

  it("fails safely (no calendar change) when the DB write throws", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store, { persistFail: true });
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("internal_error");
    expect(calls.synced).toHaveLength(0); // never mirrored — nothing to keep consistent
    expect(store[0].status).toBe("pending"); // unchanged
  });

  it("treats a lost optimistic race as stale and does not mirror", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store, { persistAffected: 0 });
    const res = await reschedule(baseReq(), deps);

    expect(res.success).toBe(false);
    if (!res.success) expect(res.reason).toBe("stale");
    expect(calls.synced).toHaveLength(0);
  });

  it("is idempotent across duplicate Vapi retries", async () => {
    const store = [makeAppt()];
    const { deps, calls } = makeDeps(store);

    const first = await reschedule(baseReq(), deps);
    expect(first.success && first.changed).toBe(true);

    // Same call again (webhook retry): target time already applied.
    const retry = await reschedule(baseReq(), deps);
    expect(retry.success).toBe(true);
    if (retry.success) expect(retry.changed).toBe(false);

    expect(calls.persisted).toHaveLength(1); // written once
    expect(calls.notified).toEqual([1]); // notified once
    expect(calls.synced).toEqual([1, 1]); // calendar re-mirrored (idempotent) but not re-written
  });

  it("requires the caller phone and a new date/time (contract)", async () => {
    const store = [makeAppt()];
    const { deps } = makeDeps(store);
    const noPhone = await reschedule({ phone: null, newDate: "2026-08-05", newTime: "2pm" }, deps);
    expect(noPhone.success).toBe(false);
    if (!noPhone.success) expect(noPhone.reason).toBe("missing_fields");
  });
});

// ── Mechanical-only guard: no Rosalia / foreign dependencies in the source ─────

describe("no Rosalia or foreign calendar dependencies", () => {
  const source = readFileSync(join(__dirname, "rescheduleAppointment.ts"), "utf8");
  it("contains no Rosalia references", () => {
    expect(source).not.toMatch(/rosalia/i);
    expect(source).not.toMatch(/rosaliagroup/i);
  });
  it("does not introduce a global calendar env var or foreign SMS providers", () => {
    expect(source).not.toContain("MECHANICAL_CALENDAR_ID");
    expect(source).not.toMatch(/textbelt/i);
    expect(source).not.toMatch(/twilio/i);
  });
});
