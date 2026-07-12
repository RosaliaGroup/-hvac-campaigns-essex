/**
 * Appointment confirmation workflow tests (Task 12: outbound workflow +
 * opted-out recipients). The Telnyx sender and the DB are mocked so we assert
 * routing + opt-out gating + message content without any network or DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
const getDbMock = vi.fn();

vi.mock("./telnyxSms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./telnyxSms")>();
  return { ...actual, sendTelnyxSms: (...args: unknown[]) => sendMock(...args) };
});
vi.mock("../db", () => ({ getDb: (...args: unknown[]) => getDbMock(...args) }));

import { sendAppointmentConfirmationSms } from "./appointmentSms";

const APPT = {
  fullName: "Maria Gomez",
  phone: "862-423-9396",
  appointmentType: "technician_dispatch",
  scheduledAt: new Date("2026-08-01T18:00:00Z"),
  preferredDate: "2026-08-01",
  preferredTime: "2:00 PM",
};

// Fake db whose opt-out lookup returns the queued rows.
function dbReturning(rows: unknown[]) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }),
  };
}

describe("sendAppointmentConfirmationSms", () => {
  beforeEach(() => {
    sendMock.mockReset();
    getDbMock.mockReset();
    sendMock.mockResolvedValue({ success: true, messageId: "msg_1" });
  });

  it("sends a confirmation via the shared Telnyx sender", async () => {
    getDbMock.mockResolvedValue(dbReturning([{ optedOut: false }]));
    const res = await sendAppointmentConfirmationSms(APPT);
    expect(res.sent).toBe(true);
    expect(sendMock).toHaveBeenCalledOnce();
    const [phone, message] = sendMock.mock.calls[0];
    expect(phone).toBe("862-423-9396");
    expect(message).toContain("Maria"); // first name
    expect(message).toContain("Service Visit"); // technician_dispatch label
    expect(message).toContain("Reply STOP to opt out.");
  });

  it("uses reschedule wording when isReschedule is set", async () => {
    getDbMock.mockResolvedValue(dbReturning([{ optedOut: false }]));
    await sendAppointmentConfirmationSms(APPT, { isReschedule: true });
    const [, message] = sendMock.mock.calls[0];
    expect(message).toMatch(/rescheduled/i);
  });

  it("does NOT send to an opted-out recipient", async () => {
    getDbMock.mockResolvedValue(dbReturning([{ optedOut: true }]));
    const res = await sendAppointmentConfirmationSms(APPT);
    expect(res.sent).toBe(false);
    expect(res.reason).toMatch(/opted out/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips when there is no phone number", async () => {
    getDbMock.mockResolvedValue(null);
    const res = await sendAppointmentConfirmationSms({ ...APPT, phone: "" });
    expect(res.sent).toBe(false);
    expect(res.reason).toMatch(/no phone/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws when the sender fails", async () => {
    getDbMock.mockResolvedValue(null);
    sendMock.mockResolvedValue({ success: false, error: "Telnyx 500" });
    const res = await sendAppointmentConfirmationSms(APPT);
    expect(res.sent).toBe(false);
    expect(res.reason).toMatch(/Telnyx 500/);
  });
});
