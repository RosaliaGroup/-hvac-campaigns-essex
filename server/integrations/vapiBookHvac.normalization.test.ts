/**
 * Vapi `bookHVAC` — property/context normalization (PR #47 parity) tests.
 *
 * These verify that bookHVAC routes a matched customer's booking through the
 * shared `resolveAppointmentContext` / `matchPropertyByFreeText` normalization:
 *  - a spoken free-text address is matched to ONE of the customer's properties,
 *  - an ambiguous/unmatched address fails safe (no property guessed),
 *  - resolved fields are persisted (customerId, propertyId, backfilled fields),
 *  - resolution is best-effort: a failure never blocks the booking.
 * The DB and normalization helpers are mocked so the wiring is asserted without
 * a database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const createAppointmentMock = vi.fn();
const getByVapiCallIdMock = vi.fn();
const findDuplicateMock = vi.fn();
const getDbMock = vi.fn();
const findCustomerIdByPhoneMock = vi.fn();
const resolveAppointmentContextMock = vi.fn();
const matchPropertyByFreeTextMock = vi.fn();

vi.mock("../db", () => ({
  createAppointment: (...a: unknown[]) => createAppointmentMock(...a),
  getAppointmentByVapiCallId: (...a: unknown[]) => getByVapiCallIdMock(...a),
  findDuplicateAppointment: (...a: unknown[]) => findDuplicateMock(...a),
  getDb: (...a: unknown[]) => getDbMock(...a),
}));
vi.mock("../routers/customers", () => ({
  findCustomerIdByPhone: (...a: unknown[]) => findCustomerIdByPhoneMock(...a),
}));
vi.mock("../_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("../services/appointmentInvites", () => ({
  normalizeAttendees: vi.fn().mockReturnValue([]),
  replaceAttendees: vi.fn().mockResolvedValue(undefined),
  syncAppointmentInvites: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/appointmentNormalization", () => ({
  resolveAppointmentContext: (...a: unknown[]) => resolveAppointmentContextMock(...a),
  matchPropertyByFreeText: (...a: unknown[]) => matchPropertyByFreeTextMock(...a),
}));

import { handleBookHVAC } from "./vapiBookHvac";

const ARGS = {
  full_name: "Maria Gomez",
  phone: "(973) 518-1815",
  email: "maria@example.com",
  property_address: "45 Oak St",
  property_type: "residential",
  appointment_type: "technician_dispatch",
  service_type: "furnace_repair",
  preferred_date: "2026-08-01",
  preferred_time: "2:00 PM",
  issue_description: "No heat upstairs",
};

const row = () => createAppointmentMock.mock.calls[0][0] as Record<string, unknown>;

beforeEach(() => {
  createAppointmentMock.mockReset().mockResolvedValue({ insertId: 100 });
  getByVapiCallIdMock.mockReset().mockResolvedValue(null);
  findDuplicateMock.mockReset().mockResolvedValue(null);
  getDbMock.mockReset().mockResolvedValue({ __db: true }); // truthy DB handle
  findCustomerIdByPhoneMock.mockReset().mockResolvedValue(42);
  resolveAppointmentContextMock.mockReset();
  matchPropertyByFreeTextMock.mockReset().mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
});

describe("bookHVAC — property/context normalization", () => {
  it("passes the matched customer + spoken fields into resolveAppointmentContext", async () => {
    resolveAppointmentContextMock.mockResolvedValue({ customerId: 42, propertyId: null });
    await handleBookHVAC(ARGS, "call_1");
    expect(resolveAppointmentContextMock).toHaveBeenCalledTimes(1);
    const [, input] = resolveAppointmentContextMock.mock.calls[0];
    expect(input).toMatchObject({ customerId: 42, propertyId: null, phone: ARGS.phone, propertyAddress: "45 Oak St" });
  });

  it("resolves a free-text address to ONE of the customer's properties (multi-property case)", async () => {
    resolveAppointmentContextMock.mockResolvedValue({ customerId: 42, propertyId: null });
    // Among several properties, the spoken address matches this one.
    matchPropertyByFreeTextMock.mockResolvedValue({
      id: 7, customerId: 42, addressLine1: "45 Oak St", addressLine2: null, city: "Newark", state: "NJ", zip: "07102", propertyType: "residential",
    });
    const out = JSON.parse(await handleBookHVAC(ARGS, "call_1"));
    expect(out.success).toBe(true);
    expect(matchPropertyByFreeTextMock).toHaveBeenCalledWith({ __db: true }, 42, "45 Oak St");
    expect(row().propertyId).toBe(7);
    expect(row().customerId).toBe(42);
    expect(String(row().propertyAddress)).toContain("45 Oak St"); // formatted from the matched property
  });

  it("fails SAFE on an ambiguous address: no property is guessed, free text is kept", async () => {
    resolveAppointmentContextMock.mockResolvedValue({ customerId: 42, propertyId: null });
    matchPropertyByFreeTextMock.mockResolvedValue(null); // ambiguous / no confident match
    const out = JSON.parse(await handleBookHVAC(ARGS, "call_1"));
    expect(out.success).toBe(true);
    expect(row().propertyId).toBeUndefined();
    expect(row().propertyAddress).toBe("45 Oak St"); // the spoken value, unchanged
    expect(row().customerId).toBe(42);
  });

  it("persists a property the resolver linked directly (no free-text match needed)", async () => {
    resolveAppointmentContextMock.mockResolvedValue({ customerId: 42, propertyId: 9, propertyAddress: "9 Elm Rd, Newark, NJ" });
    const out = JSON.parse(await handleBookHVAC({ ...ARGS, property_address: "" }, "call_1"));
    expect(out.success).toBe(true);
    expect(matchPropertyByFreeTextMock).not.toHaveBeenCalled(); // already had a propertyId
    expect(row().propertyId).toBe(9);
    expect(row().propertyAddress).toBe("9 Elm Rd, Newark, NJ");
  });

  it("backfills a blank name/email from the resolved customer (backfill-only)", async () => {
    resolveAppointmentContextMock.mockResolvedValue({ customerId: 42, propertyId: null, fullName: "Maria G. Gomez", email: "maria@crm.example" });
    await handleBookHVAC(ARGS, "call_1");
    expect(row().fullName).toBe("Maria G. Gomez");
    expect(row().email).toBe("maria@crm.example");
  });

  it("is best-effort: a resolver failure never blocks the booking (falls back to spoken values)", async () => {
    resolveAppointmentContextMock.mockRejectedValue(new Error("CONFLICT: property belongs to another customer"));
    const out = JSON.parse(await handleBookHVAC(ARGS, "call_1"));
    expect(out.success).toBe(true);
    expect(row().propertyId).toBeUndefined();
    expect(row().propertyAddress).toBe("45 Oak St");
    expect(row().fullName).toBe("Maria Gomez");
  });

  it("skips normalization safely when no DB handle is available", async () => {
    getDbMock.mockResolvedValue(null);
    const out = JSON.parse(await handleBookHVAC(ARGS, "call_1"));
    expect(out.success).toBe(true);
    expect(resolveAppointmentContextMock).not.toHaveBeenCalled();
    expect(row().propertyId).toBeUndefined();
  });
});
