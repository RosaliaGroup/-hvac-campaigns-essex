/**
 * Inbound webhook processing tests (Task 12):
 *   • inbound reply processing + entity matching
 *   • unknown phone numbers (no contact created)
 *   • opted-out recipients (STOP) and opt-in (START) / HELP
 *   • duplicate webhook delivery / idempotency
 *   • delivery-status updates (with out-of-order regression guard)
 *
 * Uses a lightweight fake Drizzle db so no real connection is needed.
 */
import { describe, it, expect } from "vitest";
import {
  matchInboundPhone,
  claimWebhookEvent,
  applyDeliveryStatus,
  handleInboundReply,
} from "./smsWebhook";
import {
  smsContacts,
  customers,
  leads,
  smsSends,
  smsWebhookEvents,
  smsInboxMessages,
  scheduledSends,
} from "../../drizzle/schema";
import type { ParsedStatusEvent } from "./telnyxDeliveryStatus";

interface Op {
  table: unknown;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
}

function makeFakeDb(opts: { selects?: unknown[][]; updateResult?: Array<{ affectedRows: number }> } = {}) {
  const selectQueue = [...(opts.selects ?? [])];
  const inserts: Op[] = [];
  const updates: Op[] = [];
  const updateResult = opts.updateResult ?? [{ affectedRows: 1 }];

  const db = {
    inserts,
    updates,
    select() {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectQueue.shift() ?? []),
      };
      return chain;
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve([{ insertId: inserts.length }]);
        },
      };
    },
    update(table: unknown) {
      return {
        set(setObj: Record<string, unknown>) {
          return {
            where() {
              updates.push({ table, set: setObj });
              return Promise.resolve(updateResult);
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

describe("matchInboundPhone", () => {
  it("resolves contact, customer, and lead ids", async () => {
    const db = makeFakeDb({ selects: [[{ id: 7 }], [{ id: 42 }], [{ id: 99 }]] });
    const match = await matchInboundPhone(db, "+18624239396");
    expect(match).toEqual({ contactId: 7, customerId: 42, leadId: 99 });
  });

  it("returns nulls for an unknown number (no contact created)", async () => {
    const db = makeFakeDb({ selects: [[], [], []] });
    const match = await matchInboundPhone(db, "+18624239396");
    expect(match).toEqual({ contactId: null, customerId: null, leadId: null });
    expect(db.inserts).toHaveLength(0); // never inserts a contact
  });
});

describe("claimWebhookEvent — idempotency", () => {
  it("claims a new event id and records it", async () => {
    const db = makeFakeDb({ selects: [[]] });
    const first = await claimWebhookEvent(db, "evt_1", "message.received");
    expect(first).toBe(true);
    expect(db.inserts[0].table).toBe(smsWebhookEvents);
    expect(db.inserts[0].values).toMatchObject({ eventId: "evt_1" });
  });

  it("rejects a duplicate (already-seen) event id", async () => {
    const db = makeFakeDb({ selects: [[{ eventId: "evt_1" }]] });
    const dup = await claimWebhookEvent(db, "evt_1", "message.received");
    expect(dup).toBe(false);
    expect(db.inserts).toHaveLength(0);
  });

  it("processes events with no id (defensive)", async () => {
    const db = makeFakeDb();
    expect(await claimWebhookEvent(db, undefined, undefined)).toBe(true);
  });
});

describe("applyDeliveryStatus", () => {
  const base: ParsedStatusEvent = {
    telnyxMessageId: "msg_1",
    eventType: "message.finalized",
    rawToStatus: "delivered",
    deliveryStatus: "delivered",
    errorCode: null,
    errorMessage: null,
    completedAt: null,
  };

  it("persists a delivered status and reports affected rows", async () => {
    const db = makeFakeDb({ updateResult: [{ affectedRows: 1 }] });
    const affected = await applyDeliveryStatus(db, base);
    expect(affected).toBe(1);
    expect(db.updates[0].table).toBe(smsSends);
    expect(db.updates[0].set).toMatchObject({ deliveryStatus: "delivered" });
    expect(db.updates[0].set.deliveredAt).toBeInstanceOf(Date);
  });

  it("reports 0 affected for an untracked (non-campaign) message", async () => {
    const db = makeFakeDb({ updateResult: [{ affectedRows: 0 }] });
    const affected = await applyDeliveryStatus(db, { ...base, deliveryStatus: "sent", rawToStatus: "sent" });
    expect(affected).toBe(0);
  });

  it("maps a carrier-filtered failure with error code", async () => {
    const db = makeFakeDb();
    await applyDeliveryStatus(db, {
      ...base,
      rawToStatus: "delivery_failed",
      deliveryStatus: "carrier_filtered",
      errorCode: "40010",
      errorMessage: "Not 10DLC registered",
    });
    expect(db.updates[0].set).toMatchObject({
      deliveryStatus: "carrier_filtered",
      deliveryErrorCode: "40010",
    });
  });
});

describe("handleInboundReply", () => {
  it("opts out a known contact on STOP and cancels pending sends", async () => {
    // selects: contact, customer, lead (matchInboundPhone)
    const db = makeFakeDb({ selects: [[{ id: 7 }], [], []] });
    const res = await handleInboundReply(db, { fromPhone: "8624239396", text: "STOP", providerMessageId: "in_1" });

    expect(res.intent).toBe("stop");
    expect(res.match.contactId).toBe(7);
    // two updates: smsContacts.optedOut=true, scheduledSends cancelled
    expect(db.updates.map((u: Op) => u.table)).toEqual([smsContacts, scheduledSends]);
    expect(db.updates[0].set).toMatchObject({ optedOut: true });
    expect(db.updates[1].set).toMatchObject({ status: "cancelled" });
    // inbox row saved as opt-out, E.164 normalized, linked to contact
    const inbox = db.inserts.find((i: Op) => i.table === smsInboxMessages)!;
    expect(inbox.values).toMatchObject({
      contactId: 7,
      phone: "+18624239396",
      direction: "inbound",
      isOptOut: true,
      providerMessageId: "in_1",
    });
  });

  it("handles STOP from an unknown number without opting anyone out", async () => {
    const db = makeFakeDb({ selects: [[], [], []] });
    const res = await handleInboundReply(db, { fromPhone: "8624239396", text: "stop", providerMessageId: null });
    expect(res.intent).toBe("stop");
    expect(db.updates).toHaveLength(0); // nothing to opt out
    const inbox = db.inserts.find((i: Op) => i.table === smsInboxMessages)!;
    expect(inbox.values).toMatchObject({ contactId: null, isOptOut: true });
  });

  it("opts a known contact back in on START", async () => {
    const db = makeFakeDb({ selects: [[{ id: 3 }], [], []] });
    const res = await handleInboundReply(db, { fromPhone: "8624239396", text: "START", providerMessageId: null });
    expect(res.intent).toBe("start");
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].table).toBe(smsContacts);
    expect(db.updates[0].set).toMatchObject({ optedOut: false });
  });

  it("does not opt out or send anything on HELP", async () => {
    const db = makeFakeDb({ selects: [[{ id: 3 }], [], []] });
    const res = await handleInboundReply(db, { fromPhone: "8624239396", text: "HELP", providerMessageId: null });
    expect(res.intent).toBe("help");
    expect(db.updates).toHaveLength(0);
    const inbox = db.inserts.find((i: Op) => i.table === smsInboxMessages)!;
    expect(inbox.values).toMatchObject({ isOptOut: false });
  });

  it("saves a normal reply linked to the matched customer/lead", async () => {
    const db = makeFakeDb({ selects: [[], [{ id: 55 }], [{ id: 88 }]] });
    const res = await handleInboundReply(db, {
      fromPhone: "+1 (862) 423-9396",
      text: "What time is my visit?",
      providerMessageId: "in_9",
    });
    expect(res.intent).toBe("message");
    expect(db.updates).toHaveLength(0);
    const inbox = db.inserts.find((i: Op) => i.table === smsInboxMessages)!;
    expect(inbox.values).toMatchObject({
      contactId: null,
      customerId: 55,
      leadId: 88,
      isOptOut: false,
      phone: "+18624239396",
    });
  });
});
