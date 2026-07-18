/**
 * Vapi `bookHVAC` — confirmation-SMS honesty (production incident regression).
 *
 * The incident: tools reported success but no SMS arrived (the spoken number was
 * an invalid 11-digit non-E.164 value). bookHVAC previously ALWAYS said
 * "Confirmation will be sent shortly" while never sending anything. These tests
 * assert the appointment is still created, but the tool response only claims a
 * confirmation text when one actually sent, and never re-sends on a retry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const createAppointmentMock = vi.fn();
const getByVapiCallIdMock = vi.fn();
const findDuplicateMock = vi.fn();
const confirmationMock = vi.fn();

vi.mock("../db", () => ({
  createAppointment: (...a: unknown[]) => createAppointmentMock(...a),
  getAppointmentByVapiCallId: (...a: unknown[]) => getByVapiCallIdMock(...a),
  findDuplicateAppointment: (...a: unknown[]) => findDuplicateMock(...a),
  getDb: vi.fn(async () => null), // normalization is best-effort; skipped here
}));
vi.mock("../routers/customers", () => ({ findCustomerIdByPhone: vi.fn(async () => null) }));
vi.mock("../_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));
vi.mock("../services/appointmentInvites", () => ({
  normalizeAttendees: vi.fn().mockReturnValue([]),
  replaceAttendees: vi.fn().mockResolvedValue(undefined),
  syncAppointmentInvites: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/appointmentSms", () => ({
  sendAppointmentConfirmationSms: (...a: unknown[]) => confirmationMock(...a),
}));

import { handleBookHVAC } from "./vapiBookHvac";

// The invalid destination from the incident: 11 digits, no leading 1.
const ARGS = {
  full_name: "Maria Gomez", phone: "364-622-69189", email: "maria@example.com",
  property_address: "12 Bloomfield Ave", property_type: "residential",
  appointment_type: "technician_dispatch", service_type: "furnace_repair",
  preferred_date: "2026-08-01", preferred_time: "2:00 PM", issue_description: "No heat",
};
const out = async (callId?: string) => JSON.parse(await handleBookHVAC(ARGS, callId));

beforeEach(() => {
  createAppointmentMock.mockReset().mockResolvedValue({ insertId: 100 });
  getByVapiCallIdMock.mockReset().mockResolvedValue(null);
  findDuplicateMock.mockReset().mockResolvedValue(null);
  // Default: confirmation fails safely (mirrors the invalid-phone incident).
  confirmationMock.mockReset().mockResolvedValue({ sent: false, reason: "Invalid phone number: 364-622-69189" });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
});

describe("bookHVAC — confirmation SMS honesty", () => {
  it("creates the appointment but does NOT claim a text when the confirmation fails", async () => {
    const r = await out("call_1");
    expect(createAppointmentMock).toHaveBeenCalledTimes(1); // booking still succeeds
    expect(r.success).toBe(true);
    expect(r.confirmationSms).toBe("not_sent");
    expect(r.message).not.toMatch(/on the way|will be sent|shortly/i); // no false "text coming" claim
    expect(confirmationMock).toHaveBeenCalledTimes(1); // confirmation WAS attempted (Telnyx service)
  });

  it("claims a confirmation text only when it actually sent", async () => {
    confirmationMock.mockResolvedValue({ sent: true });
    const r = await out("call_2");
    expect(r.confirmationSms).toBe("sent");
    expect(r.message).toMatch(/on the way/i);
  });

  it("exposes a Telnyx rejection as not_sent while the booking still succeeds", async () => {
    confirmationMock.mockResolvedValue({ sent: false, reason: "Telnyx 400" });
    const r = await out("call_3");
    expect(r.success).toBe(true);
    expect(r.confirmationSms).toBe("not_sent");
    expect(JSON.stringify(r)).not.toMatch(/on the way/i);
  });

  it("does NOT re-send a confirmation on an idempotent retry (no duplicate SMS)", async () => {
    getByVapiCallIdMock.mockResolvedValue({ id: 55 }); // same vapiCallId → duplicate booking
    const r = await out("call_1");
    expect(r.confirmationSms).toBe("duplicate");
    expect(confirmationMock).not.toHaveBeenCalled(); // no second confirmation send
    expect(createAppointmentMock).not.toHaveBeenCalled(); // no second appointment
  });
});
