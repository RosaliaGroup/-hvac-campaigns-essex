/**
 * Vapi `bookHVAC` — Mechanical-only booking tests.
 *
 * The DB, customer lookup, owner notification, and the appointment-invite
 * pipeline are mocked so we assert Mechanical-only routing, customer linkage,
 * idempotency, DELEGATION to the existing database-driven calendar sync
 * (`syncAppointmentInvites`), and safe failure — with NO network, DB, env-var
 * calendar, or Rosalia dependency reachable from this handler.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (paths resolve identically from this file and the handler) ──────────
const createAppointmentMock = vi.fn();
const getByVapiCallIdMock = vi.fn();
const findDuplicateMock = vi.fn();
const findCustomerIdByPhoneMock = vi.fn();
const notifyOwnerMock = vi.fn();
const normalizeAttendeesMock = vi.fn();
const replaceAttendeesMock = vi.fn();
const syncAppointmentInvitesMock = vi.fn();

vi.mock("../db", () => ({
  createAppointment: (...a: unknown[]) => createAppointmentMock(...a),
  getAppointmentByVapiCallId: (...a: unknown[]) => getByVapiCallIdMock(...a),
  findDuplicateAppointment: (...a: unknown[]) => findDuplicateMock(...a),
}));
vi.mock("../routers/customers", () => ({
  findCustomerIdByPhone: (...a: unknown[]) => findCustomerIdByPhoneMock(...a),
}));
vi.mock("../_core/notification", () => ({
  notifyOwner: (...a: unknown[]) => notifyOwnerMock(...a),
}));
vi.mock("../services/appointmentInvites", () => ({
  normalizeAttendees: (...a: unknown[]) => normalizeAttendeesMock(...a),
  replaceAttendees: (...a: unknown[]) => replaceAttendeesMock(...a),
  syncAppointmentInvites: (...a: unknown[]) => syncAppointmentInvitesMock(...a),
}));

import { handleBookHVAC, parseBookHvacArgs } from "./vapiBookHvac";

const BASE_ARGS = {
  full_name: "Maria Gomez",
  phone: "(973) 518-1815",
  email: "maria@example.com",
  property_address: "12 Bloomfield Ave",
  property_type: "residential",
  appointment_type: "technician_dispatch",
  service_type: "furnace_repair",
  preferred_date: "2026-08-01",
  preferred_time: "2:00 PM",
  issue_description: "No heat on the second floor",
};

const fetchMock = vi.fn();

beforeEach(() => {
  createAppointmentMock.mockReset().mockResolvedValue({ insertId: 100 });
  getByVapiCallIdMock.mockReset().mockResolvedValue(null);
  findDuplicateMock.mockReset().mockResolvedValue(null);
  findCustomerIdByPhoneMock.mockReset().mockResolvedValue(null);
  notifyOwnerMock.mockReset().mockResolvedValue(true);
  // By default the customer email produces one attendee, so calendar sync runs.
  normalizeAttendeesMock.mockReset().mockImplementation((_raw, opts: { customerEmail?: string; customerName?: string }) =>
    opts?.customerEmail ? [{ email: opts.customerEmail, name: opts.customerName ?? null, role: "customer", teamMemberId: null }] : [],
  );
  replaceAttendeesMock.mockReset().mockResolvedValue(undefined);
  syncAppointmentInvitesMock.mockReset().mockResolvedValue(undefined);
  // fetch must NEVER be called by this handler (no direct calendar/API traffic).
  fetchMock.mockReset().mockRejectedValue(new Error("fetch must not be called"));
  vi.stubGlobal("fetch", fetchMock);
});

/** Convenience: the single createAppointment payload. */
function insertedRow() {
  return createAppointmentMock.mock.calls[0][0] as Record<string, unknown>;
}

describe("parseBookHvacArgs", () => {
  it("reports missing required fields", () => {
    const r = parseBookHvacArgs({ full_name: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["phone", "preferred_date", "preferred_time"]);
  });

  it("defaults an unknown appointment_type to technician_dispatch (never fails the booking)", () => {
    const r = parseBookHvacArgs({ ...BASE_ARGS, appointment_type: "leasing_tour" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.appointmentType).toBe("technician_dispatch");
  });

  it("folds a second address line into the stored address", () => {
    const r = parseBookHvacArgs({ ...BASE_ARGS, address_line2: "Unit 4B" });
    expect(r.ok && r.value.propertyAddress).toBe("12 Bloomfield Ave, Unit 4B");
  });

  it("omits the second line cleanly when absent (no trailing comma)", () => {
    const r = parseBookHvacArgs(BASE_ARGS);
    expect(r.ok && r.value.propertyAddress).toBe("12 Bloomfield Ave");
  });
});

describe("handleBookHVAC — booking", () => {
  it("links an existing customer matched by phone", async () => {
    findCustomerIdByPhoneMock.mockResolvedValue(42);
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_abc"));

    expect(findCustomerIdByPhoneMock).toHaveBeenCalledWith("(973) 518-1815");
    const row = insertedRow();
    expect(row.customerId).toBe(42);
    expect(row.source).toBe("phone");
    expect(row.bookedBy).toBe("vapi");
    expect(row.vapiCallId).toBe("call_abc");
    expect(out).toMatchObject({ success: true, appointmentId: "ME-100" });
    expect(out.message).toContain("Maria Gomez");
  });

  it("creates an unconverted lead when no customer matches", async () => {
    findCustomerIdByPhoneMock.mockResolvedValue(null);
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_new"));
    expect(insertedRow().customerId).toBeUndefined();
    expect(out.success).toBe(true);
  });

  it("passes the spoken phone to the matcher (normalization happens in the shared util)", async () => {
    findCustomerIdByPhoneMock.mockResolvedValue(7);
    await handleBookHVAC({ ...BASE_ARGS, phone: "973.518.1815 ext" }, "call_norm");
    expect(findCustomerIdByPhoneMock).toHaveBeenCalledWith("973.518.1815 ext");
    expect(insertedRow().customerId).toBe(7);
  });

  it("books without an email (optional field omitted) and skips calendar sync (no attendee)", async () => {
    const noEmail = { ...BASE_ARGS };
    delete (noEmail as Record<string, unknown>).email;
    const out = JSON.parse(await handleBookHVAC(noEmail, "call_noemail"));
    expect(insertedRow().email).toBeUndefined();
    expect(replaceAttendeesMock).toHaveBeenCalledWith(100, []);
    expect(syncAppointmentInvitesMock).not.toHaveBeenCalled();
    expect(out.success).toBe(true);
  });

  it("returns a validation error when required fields are missing", async () => {
    const out = JSON.parse(await handleBookHVAC({ full_name: "Only Name" }, "call_bad"));
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/Missing required fields/);
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });
});

describe("handleBookHVAC — database-driven calendar (delegation)", () => {
  it("delegates calendar sync to syncAppointmentInvites (DB resolves the calendar)", async () => {
    await handleBookHVAC(BASE_ARGS, "call_cal");
    // Customer added as attendee, then the existing DB-driven sync is invoked.
    expect(replaceAttendeesMock).toHaveBeenCalledWith(100, [
      { email: "maria@example.com", name: "Maria Gomez", role: "customer", teamMemberId: null },
    ]);
    expect(syncAppointmentInvitesMock).toHaveBeenCalledWith({ appointmentId: 100 });
  });

  it("reads no global calendar env var and makes no direct calendar/API fetch", async () => {
    // The handler resolves the calendar only through the DB-driven sync service;
    // it consults no process.env calendar id, so no fetch is issued from here.
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_noenv"));
    expect(syncAppointmentInvitesMock).toHaveBeenCalledWith({ appointmentId: 100 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.success).toBe(true);
  });

  it("still books when the calendar connection is invalid/inaccessible (sync throws)", async () => {
    syncAppointmentInvitesMock.mockRejectedValue(new Error("Google Calendar token refresh failed — reconnect required"));
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_calfail"));
    expect(out.success).toBe(true); // calendar failure is non-fatal
  });
});

describe("handleBookHVAC — idempotency (webhook retries)", () => {
  it("returns the original appointment on a Vapi call-id retry, without a second insert", async () => {
    getByVapiCallIdMock.mockResolvedValue({ id: 100 });
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_dupe"));
    expect(createAppointmentMock).not.toHaveBeenCalled();
    expect(syncAppointmentInvitesMock).not.toHaveBeenCalled();
    expect(out).toMatchObject({ success: true, appointmentId: "ME-100" });
  });

  it("falls back to phone+date+time de-dup when there is no call id", async () => {
    findDuplicateMock.mockResolvedValue({ id: 55 });
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS)); // no vapiCallId
    expect(findDuplicateMock).toHaveBeenCalledWith({
      phone: "(973) 518-1815",
      preferredDate: "2026-08-01",
      preferredTime: "2:00 PM",
    });
    expect(createAppointmentMock).not.toHaveBeenCalled();
    expect(out.appointmentId).toBe("ME-55");
  });
});

describe("handleBookHVAC — date/time parsing", () => {
  it("still books when the date is unparseable (scheduledAt left unset)", async () => {
    const out = JSON.parse(await handleBookHVAC({ ...BASE_ARGS, preferred_date: "whenever works" }, "call_baddate"));
    expect(out.success).toBe(true);
    expect(insertedRow().scheduledAt).toBeUndefined();
  });
});

describe("handleBookHVAC — failure isolation", () => {
  it("returns a safe generic error (no internal detail) when the DB write fails", async () => {
    createAppointmentMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:3306 (secret host)"));
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_dbfail"));
    expect(out.success).toBe(false);
    expect(out.error).not.toMatch(/ECONNREFUSED|3306|secret/);
    expect(out.error).toMatch(/couldn't save your appointment/i);
    expect(syncAppointmentInvitesMock).not.toHaveBeenCalled();
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("still books when the owner notification throws", async () => {
    notifyOwnerMock.mockRejectedValue(new Error("notify down"));
    const out = JSON.parse(await handleBookHVAC(BASE_ARGS, "call_notifyfail"));
    expect(out.success).toBe(true);
  });
});

describe("handleBookHVAC — Mechanical isolation (no Rosalia)", () => {
  it("makes no outbound host call and uses Mechanical-only provenance fields", async () => {
    await handleBookHVAC(BASE_ARGS, "call_iso");
    // The handler performs no direct network I/O; all calendar/email goes through
    // the existing (mocked) DB-driven pipeline.
    expect(fetchMock).not.toHaveBeenCalled();
    const note = notifyOwnerMock.mock.calls[0][0] as { title: string; content: string };
    expect(`${note.title} ${note.content}`).not.toMatch(/rosalia|leasing|apartment|tour|textbelt|supabase/i);
    expect(insertedRow().bookedBy).toBe("vapi");
    expect(insertedRow().source).toBe("phone");
  });
});
