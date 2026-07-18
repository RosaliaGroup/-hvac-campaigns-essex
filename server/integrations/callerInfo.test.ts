import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCallerInfo,
  lookupCallerInfo,
  maskPhone,
  type CallerDataBundle,
} from "./callerInfo";

const NOW = new Date("2026-07-17T12:00:00Z");
const KEY = "8624191763"; // normalized last-10 of the numbers used below

function emptyBundle(): CallerDataBundle {
  return { customers: [], appointments: [], properties: [], serviceRecords: [] };
}

function bundle(partial: Partial<CallerDataBundle>): CallerDataBundle {
  return { ...emptyBundle(), ...partial };
}

// ── exact match ────────────────────────────────────────────────
describe("getCallerInfo — exact match", () => {
  it("returns the single matched customer with name/email", () => {
    const result = buildCallerInfo(
      bundle({
        customers: [
          {
            id: 1,
            displayName: "Ana Haynes",
            firstName: "Ana",
            lastName: "Haynes",
            email: "ana@example.com",
            phone: "(862) 419-1763",
          },
        ],
      }),
      KEY,
      NOW,
    );
    expect(result.found).toBe(true);
    expect(result.ambiguous).toBeUndefined();
    expect(result.name).toBe("Ana Haynes");
    expect(result.email).toBe("ana@example.com");
  });
});

// ── no match ───────────────────────────────────────────────────
describe("getCallerInfo — no match", () => {
  it("returns a neutral not-found result", () => {
    const result = buildCallerInfo(emptyBundle(), KEY, NOW);
    expect(result).toEqual({ found: false });
  });
});

// ── multiple customers sharing a phone ─────────────────────────
describe("getCallerInfo — shared phone number", () => {
  it("returns neutral not-found (ambiguous) and leaks no PII", () => {
    const result = buildCallerInfo(
      bundle({
        customers: [
          { id: 1, displayName: "Ana Haynes", email: "ana@example.com", phone: "8624191763" },
          { id: 2, displayName: "Bob Haynes", email: "bob@example.com", phone: "8624191763" },
        ],
        properties: [{ customerId: 1, addressLine1: "1 Main St", city: "Newark", state: "NJ" }],
      }),
      KEY,
      NOW,
    );
    expect(result).toEqual({ found: false, ambiguous: true });
    // No names, emails, or addresses anywhere in the payload.
    const blob = JSON.stringify(result);
    expect(blob).not.toContain("Ana");
    expect(blob).not.toContain("example.com");
    expect(blob).not.toContain("Main St");
  });

  it("appointment-only tier is also ambiguous when names differ", () => {
    const result = buildCallerInfo(
      bundle({
        appointments: [
          { phone: "8624191763", fullName: "Ana Haynes", status: "confirmed", preferredDate: "2026-08-01" },
          { phone: "8624191763", fullName: "Chris Doe", status: "confirmed", preferredDate: "2026-08-02" },
        ],
      }),
      KEY,
      NOW,
    );
    expect(result).toEqual({ found: false, ambiguous: true });
  });
});

// ── normalized number variants ─────────────────────────────────
describe("getCallerInfo — normalized number variants", () => {
  const variants = ["(862) 419-1763", "+1 862-419-1763", "18624191763", "862.419.1763"];
  for (const v of variants) {
    it(`matches customer regardless of formatting: ${v}`, async () => {
      const loader = vi.fn(async () =>
        bundle({ customers: [{ id: 7, displayName: "Ana Haynes", phone: "8624191763" }] }),
      );
      const result = await lookupCallerInfo(v, { loader, now: NOW });
      expect(result.found).toBe(true);
      expect(result.name).toBe("Ana Haynes");
      // Loader always receives the SAME normalized key.
      expect(loader).toHaveBeenCalledWith(KEY);
    });
  }
});

// ── customer with multiple properties ──────────────────────────
describe("getCallerInfo — multiple properties", () => {
  it("returns all formatted property addresses for the one customer", () => {
    const result = buildCallerInfo(
      bundle({
        customers: [{ id: 3, displayName: "Acme HVAC", phone: "8624191763" }],
        properties: [
          { customerId: 3, addressLine1: "10 Warehouse Rd", city: "Elizabeth", state: "NJ", zip: "07201" },
          { customerId: 3, addressLine1: "22 Depot Ave", addressLine2: "Unit 4", city: "Newark", state: "NJ" },
          // A property that belongs to a DIFFERENT customer must never appear.
          { customerId: 999, addressLine1: "SECRET Bldg", city: "Trenton", state: "NJ" },
        ],
      }),
      KEY,
      NOW,
    );
    expect(result.properties).toEqual([
      "10 Warehouse Rd, Elizabeth, NJ 07201",
      "22 Depot Ave Unit 4, Newark, NJ",
    ]);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

// ── upcoming appointment summary ───────────────────────────────
describe("getCallerInfo — upcoming appointment summary", () => {
  it("includes future appointments and excludes past/cancelled", () => {
    const result = buildCallerInfo(
      bundle({
        customers: [{ id: 5, displayName: "Ana Haynes", phone: "8624191763" }],
        appointments: [
          {
            customerId: 5,
            status: "confirmed",
            appointmentType: "maintenance",
            preferredTime: "10:00 AM",
            scheduledAt: "2026-08-01T14:00:00Z",
          },
          { customerId: 5, status: "completed", scheduledAt: "2026-06-01T14:00:00Z" }, // past
          { customerId: 5, status: "cancelled", scheduledAt: "2026-09-01T14:00:00Z" }, // cancelled
        ],
      }),
      KEY,
      NOW,
    );
    expect(result.hasExistingAppointment).toBe(true);
    expect(result.upcomingAppointments).toEqual([
      { date: "2026-08-01", time: "10:00 AM", type: "maintenance", status: "confirmed" },
    ]);
  });
});

// ── privacy filtering ──────────────────────────────────────────
describe("getCallerInfo — privacy filtering", () => {
  it("never surfaces invoices, amounts, notes, QBO ids, or billing", () => {
    // The bundle is intentionally narrow, but simulate an over-broad loader by
    // spreading forbidden keys onto the rows and asserting they cannot escape.
    const dirtyCustomer = {
      id: 8,
      displayName: "Ana Haynes",
      phone: "8624191763",
      email: "ana@example.com",
      // forbidden extras (not on the interface — must be dropped by projection):
      notes: "PRIVATE customer note",
      billingLine1: "99 Billing Way",
      quickbooksCustomerId: "QBO-123",
    } as never;
    const dirtyService = {
      customerId: 8,
      title: "AC tune-up",
      status: "completed",
      completedAt: "2026-05-01T00:00:00Z",
      internalNotes: "INTERNAL margin 45%",
      quickbooksInvoiceId: "INV-777",
      amount: 4200,
    } as never;

    const result = buildCallerInfo(
      bundle({ customers: [dirtyCustomer], serviceRecords: [dirtyService] }),
      KEY,
      NOW,
    );
    const blob = JSON.stringify(result);
    expect(result.found).toBe(true);
    expect(result.recentService).toEqual([{ summary: "AC tune-up", status: "completed", date: "2026-05-01" }]);
    for (const forbidden of ["PRIVATE", "Billing Way", "QBO-123", "INTERNAL", "INV-777", "4200", "margin"]) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it("omits email for ambiguous / unidentified callers", () => {
    const result = buildCallerInfo(
      bundle({
        customers: [
          { id: 1, displayName: "Ana", email: "ana@example.com", phone: "8624191763" },
          { id: 2, displayName: "Bob", email: "bob@example.com", phone: "8624191763" },
        ],
      }),
      KEY,
      NOW,
    );
    expect(result.email).toBeUndefined();
  });
});

// ── no Rosalia / cross-project calls ───────────────────────────
describe("getCallerInfo — Mechanical-only, no cross-project calls", () => {
  const src = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "callerInfo.ts"),
    "utf8",
  );

  it("source makes no outbound HTTP / cross-project call", () => {
    // Strip comments so the doc-comment that *describes* the absence of Rosalia
    // does not trip the check — we only care about executable code.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // No fetch/axios/http client, no URL literal, no cross-project import.
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/from\s+["'][^"']*(rosalia|iron65)/i);
  });

  it("makes no network/fetch call — only the injected data loader", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as never);
    const loader = vi.fn(async () =>
      bundle({ customers: [{ id: 1, displayName: "Ana Haynes", phone: "8624191763" }] }),
    );
    await lookupCallerInfo("862-419-1763", { loader, now: NOW });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── database error ─────────────────────────────────────────────
describe("getCallerInfo — database error", () => {
  it("returns a neutral not-found result and does not throw", async () => {
    const loader = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await lookupCallerInfo("862-419-1763", { loader, now: NOW });
    expect(result).toEqual({ found: false });
    // The log line must not contain the raw number or any customer detail.
    const logged = errSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("8624191763");
    expect(logged).toContain("***1763");
  });

  it("returns not-found for an unusable phone without calling the loader", async () => {
    const loader = vi.fn(async () => emptyBundle());
    const result = await lookupCallerInfo("911", { loader, now: NOW });
    expect(result).toEqual({ found: false });
    expect(loader).not.toHaveBeenCalled();
  });
});

// ── helper ─────────────────────────────────────────────────────
describe("maskPhone", () => {
  it("keeps only the last four digits", () => {
    expect(maskPhone("+1 (862) 419-1763")).toBe("***1763");
    expect(maskPhone("12")).toBe("****");
    expect(maskPhone(null)).toBe("****");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
