/**
 * SMS compliance tests for the Rebate Calculator router.
 *
 * These exercise the REAL gate (`gateRebateSms`) and the REAL opt-out lookup
 * (`isPhoneOptedOut`) — not local mirrors — so they stay honest if the server
 * logic changes. The gate is the single choke point both `sendResultsSms` and
 * `register` route their Telnyx sends through.
 *
 * Guarantees under test:
 *   • Strict E.164: malformed lengths (7, 9, 12 digits) are rejected — never
 *     cleaned or padded — and no opt-out query is even attempted.
 *   • A number with smsContacts.optedOut = true is not sent to.
 *   • A number with an inbound STOP (isOptOut) is not sent to.
 *   • A DB error (or a null DB) fails CLOSED: no send.
 *   • A valid, un-opted-out number passes and yields the E.164 recipient.
 */
import "./testEnvSetup"; // MUST be first
import { describe, it, expect } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";

import { gateRebateSms } from "./routers/rebateCalculator";
import { isPhoneOptedOut } from "./services/smsOutbound";

// ─── Lightweight fake Drizzle db (mirrors services/smsOutbound.test.ts) ──────
// isPhoneOptedOut runs up to two selects: (1) smsContacts opt-out, (2) inbound
// STOP. Each `.limit()` resolves the next queued result set.
const dialect = new MySqlDialect();
function makeFakeDb(selects: unknown[][] = []) {
  const queue = [...selects];
  const cap = (w: SQL) => { try { dialect.sqlToQuery(w); } catch { /* non-SQL */ } };
  const db = {
    select() {
      const chain = {
        from: () => chain,
        where: (w: SQL) => { cap(w); return chain; },
        orderBy: () => chain,
        limit: () => Promise.resolve(queue.shift() ?? []),
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

// A db that throws the moment it is queried — proves fail-closed on DB error,
// and (for malformed numbers) proves the opt-out query is never reached.
function throwingDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { select() { throw new Error("db down"); } } as any;
}

const VALID_10 = "8624239396"; // → +18624239396

describe("gateRebateSms — strict E.164 validation", () => {
  it("rejects a 7-digit number without cleaning or padding", async () => {
    const res = await gateRebateSms("1234567", throwingDb());
    expect(res).toEqual({ ok: false, error: "Invalid phone number" });
  });

  it("rejects a 9-digit number", async () => {
    const res = await gateRebateSms("123456789", throwingDb());
    expect(res).toEqual({ ok: false, error: "Invalid phone number" });
  });

  it("rejects a 12-digit number", async () => {
    const res = await gateRebateSms("123456789012", throwingDb());
    expect(res).toEqual({ ok: false, error: "Invalid phone number" });
  });

  it("rejects an 11-digit number that does not start with 1", async () => {
    const res = await gateRebateSms("28624239396", throwingDb());
    expect(res).toEqual({ ok: false, error: "Invalid phone number" });
  });

  it("does not consult the DB for a malformed number (validation is first)", async () => {
    // throwingDb() would throw if queried; getting the invalid-phone error
    // instead of a thrown error proves toE164 gates before any opt-out lookup.
    await expect(gateRebateSms("1234567", throwingDb())).resolves.toEqual({
      ok: false,
      error: "Invalid phone number",
    });
  });
});

describe("gateRebateSms — opt-out suppression (real isPhoneOptedOut)", () => {
  it("does not send to a number with smsContacts.optedOut = true", async () => {
    const db = makeFakeDb([[{ optedOut: true }]]);
    const res = await gateRebateSms(VALID_10, db, isPhoneOptedOut);
    expect(res).toEqual({ ok: false, error: "This number has opted out of SMS (STOP)." });
  });

  it("does not send to a number with an inbound STOP", async () => {
    // contacts lookup empty → STOP lookup returns a row.
    const db = makeFakeDb([[], [{ id: 1 }]]);
    const res = await gateRebateSms(VALID_10, db, isPhoneOptedOut);
    expect(res).toEqual({ ok: false, error: "This number has opted out of SMS (STOP)." });
  });

  it("passes a valid, un-opted-out number and returns the E.164 recipient", async () => {
    const db = makeFakeDb([[], []]); // not a contact, no STOP
    const res = await gateRebateSms(VALID_10, db, isPhoneOptedOut);
    expect(res).toEqual({ ok: true, to: "+18624239396" });
  });
});

describe("gateRebateSms — fail closed", () => {
  it("does not send when the opt-out lookup throws (DB error)", async () => {
    const res = await gateRebateSms(VALID_10, throwingDb(), isPhoneOptedOut);
    expect(res).toEqual({ ok: false, error: "SMS temporarily unavailable" });
  });

  it("does not send when the DB is unavailable (null)", async () => {
    const res = await gateRebateSms(VALID_10, null);
    expect(res).toEqual({ ok: false, error: "SMS temporarily unavailable" });
  });
});
