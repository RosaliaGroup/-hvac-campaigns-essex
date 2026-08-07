/**
 * Opt-out gate on follow-up SMS DISPATCH (processDueFollowups).
 *
 * The gate runs at dispatch, not at task creation, because a STOP that arrives
 * AFTER a text task is queued is exactly the case that matters. Terminal blocks
 * (opted out / invalid number) cancel the task so it is never retried; a
 * transient block (opt-out status unreadable) leaves the task "open" for the
 * existing retry lifecycle.
 *
 * Uses a lightweight fake Drizzle db — no real connection — and the REAL
 * isPhoneOptedOut via the real gateSmsRecipient (only the Telnyx transport is
 * mocked, so no network and we can assert "never sent").
 */
import "../../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Telnyx transport. toE164 keeps real validation behavior (the gate
// depends on it); sendTelnyxSms is a spy so we can assert it is never called on
// a blocked recipient.
const sendTelnyxSmsMock = vi.fn();
vi.mock("../../services/telnyxSms", () => ({
  sendTelnyxSms: (...args: unknown[]) => sendTelnyxSmsMock(...args),
  toE164: (p: string | null | undefined) => {
    if (!p) return null;
    const d = String(p).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  },
}));

import { processDueFollowups } from "./followups";

type Row = Record<string, unknown>;

/**
 * First `.select()` (the "due tasks" query) resolves `dueRows`. Every later
 * `.select()` is an opt-out lookup: it shifts `optoutQueue`, or — when
 * `throwOnOptout` — throws (used to prove the DB is not consulted, and to
 * simulate a DB error). Captures updates + inserts for assertions.
 */
function makeDispatchDb(
  dueRows: Row[],
  optoutQueue: unknown[][] = [],
  opts: { throwOnOptout?: boolean } = {},
) {
  const queue = [...optoutQueue];
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  let selectCalls = 0;
  const db = {
    updates,
    inserts,
    select() {
      const n = ++selectCalls;
      const chain: Record<string, unknown> = {
        from: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => {
          if (n === 1) return Promise.resolve(dueRows); // the "due tasks" query
          if (opts.throwOnOptout) throw new Error("db down");
          return Promise.resolve(queue.shift() ?? []);
        },
      };
      return chain;
    },
    update() {
      return { set(s: Record<string, unknown>) { return { where() { updates.push(s); return Promise.resolve([{ affectedRows: 1 }]); } }; } };
    },
    insert() {
      return { values(v: Record<string, unknown>) { inserts.push(v); return Promise.resolve([{ insertId: inserts.length }]); } };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

function textTask(overrides: Row = {}): Row {
  return {
    id: 1,
    opportunityId: 10,
    type: "text",
    title: "Text follow-up on estimate 123",
    body: "Hi there, checking in on your estimate.",
    customerId: 5,
    email: null,
    phone: "8624239396", // valid 10-digit
    ...overrides,
  };
}

beforeEach(() => {
  sendTelnyxSmsMock.mockReset();
  process.env.SMS_FOLLOWUPS_ENABLED = "true"; // reach the dispatch gate
});

describe("processDueFollowups — opt-out gate at dispatch", () => {
  it("opted-out contact → not sent, task cancelled, suppression event recorded", async () => {
    const db = makeDispatchDb([textTask()], [[{ optedOut: true }]]);
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(res.textsSent).toBe(0);
    expect(res.textsSuppressed).toBe(1);
    expect(res.failed).toBe(0);
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "cancelled" }));
    expect(db.inserts).toContainEqual(
      expect.objectContaining({ type: "followup_suppressed", metadata: { taskId: 1, reason: "opted_out" } }),
    );
  });

  it("inbound STOP (not a saved contact) → not sent, task cancelled", async () => {
    // contacts lookup empty, STOP lookup returns a row.
    const db = makeDispatchDb([textTask()], [[], [{ id: 99 }]]);
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(res.textsSuppressed).toBe(1);
    expect(res.textsSent).toBe(0);
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "cancelled" }));
    expect(db.inserts).toContainEqual(
      expect.objectContaining({ type: "followup_suppressed", metadata: { taskId: 1, reason: "opted_out" } }),
    );
  });

  it("invalid phone → cancelled, and the DB is never consulted for opt-out", async () => {
    // throwOnOptout: any opt-out select throws. Getting a clean cancellation
    // proves toE164 rejected first, before any opt-out query.
    const db = makeDispatchDb([textTask({ phone: "1234567" })], [], { throwOnOptout: true });
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(res.textsSuppressed).toBe(1);
    expect(res.failed).toBe(0);
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "cancelled" }));
    expect(db.inserts).toContainEqual(
      expect.objectContaining({ type: "followup_suppressed", metadata: { taskId: 1, reason: "invalid_phone" } }),
    );
  });

  it("DB error during opt-out check → not sent, task stays OPEN, retried (not cancelled)", async () => {
    const db = makeDispatchDb([textTask()], [], { throwOnOptout: true });
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(res.textsSent).toBe(0);
    expect(res.textsSuppressed).toBe(0);
    expect(res.failed).toBe(1); // surfaced through the existing retry path
    // transient path only records lastError — it must NOT cancel or complete.
    expect(db.updates.every(u => u.status !== "cancelled" && u.status !== "done")).toBe(true);
    expect(db.updates).toContainEqual(expect.objectContaining({ lastError: expect.any(String) }));
    expect(db.inserts).not.toContainEqual(expect.objectContaining({ type: "followup_suppressed" }));
  });

  it("valid, un-opted-out number → sent, task completed", async () => {
    sendTelnyxSmsMock.mockResolvedValue({ success: true, messageId: "tx_1" });
    const db = makeDispatchDb([textTask()], [[], []]); // not a contact, no STOP
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(sendTelnyxSmsMock).toHaveBeenCalledOnce();
    expect(sendTelnyxSmsMock).toHaveBeenCalledWith("+18624239396", expect.any(String));
    expect(res.textsSent).toBe(1);
    expect(res.textsSuppressed).toBe(0);
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "done" }));
  });

  it("a sent follow-up is logged to the SMS Inbox keyed by the Telnyx id (delivery-status wiring)", async () => {
    // Every other outbound path persists a row so the Telnyx delivery webhook can
    // stamp delivered/failed onto it (matched on textBeltId == telnyxMessageId).
    // The follow-up path must too — this is the 40010 blind spot being closed.
    sendTelnyxSmsMock.mockResolvedValue({ success: true, messageId: "tx_deliver_1" });
    const db = makeDispatchDb([textTask()], [[], []]);
    const res = await processDueFollowups({ db, now: new Date(0) });

    expect(res.textsSent).toBe(1);
    expect(db.inserts).toContainEqual(expect.objectContaining({
      direction: "outbound",
      source: "followup",
      customerId: 5,
      textBeltId: "tx_deliver_1",        // the webhook's match key
      providerMessageId: "tx_deliver_1",
      deliveryStatus: "accepted",
    }));
  });
});
