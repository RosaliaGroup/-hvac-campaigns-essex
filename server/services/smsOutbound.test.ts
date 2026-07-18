/**
 * Outbound SMS logging service — unit tests.
 *
 * Covers (per Phase-1 acceptance):
 *   • outbound row created after Telnyx acceptance, with all stored fields
 *   • Telnyx failure → row saved with "failed" status (never "delivered")
 *   • provider message id + sender number stored
 *   • no duplicate outbound rows (idempotent by provider message id)
 *   • opt-out enforced before send (contact opt-out OR inbound STOP)
 *   • delivery-webhook status update targets the right outbound row
 *   • phone normalization / phoneLast10 derivation + indexed match SQL
 *
 * Uses a lightweight fake Drizzle db — no real connection.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";

// Mock the Telnyx transport so no network call happens.
const sendTelnyxSmsMock = vi.fn();
vi.mock("./telnyxSms", () => ({
  sendTelnyxSms: (...args: unknown[]) => sendTelnyxSmsMock(...args),
  toE164: (p: string | null | undefined) => {
    if (!p) return null;
    const d = String(p).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  },
}));

import {
  recordOutboundSms,
  isPhoneOptedOut,
  sendAndRecordSms,
  applyDeliveryStatusToInbox,
  phoneLast10Of,
  inboxPhoneMatch,
  AI_VA_OUTBOUND,
} from "./smsOutbound";

const dialect = new MySqlDialect();
interface Insert { values: Record<string, unknown> }
function makeFakeDb(selects: unknown[][] = []) {
  const queue = [...selects];
  const inserts: Insert[] = [];
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const wheres: Array<{ sql: string; params: unknown[] }> = [];
  const cap = (w: SQL) => { try { const q = dialect.sqlToQuery(w); wheres.push({ sql: q.sql, params: q.params }); } catch { /* non-SQL */ } };
  const db = {
    inserts, updates, wheres,
    select() {
      const chain = {
        from: () => chain,
        where: (w: SQL) => { cap(w); return chain; },
        orderBy: () => chain,
        limit: () => Promise.resolve(queue.shift() ?? []),
      };
      return chain;
    },
    insert() {
      return { values(v: Record<string, unknown>) { inserts.push({ values: v }); return Promise.resolve([{ insertId: inserts.length }]); } };
    },
    update() {
      return { set(s: Record<string, unknown>) { return { where(w: SQL) { cap(w); updates.push({ set: s }); return Promise.resolve([{ affectedRows: 1 }]); } }; } };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

process.env.TELNYX_FROM_NUMBER = "+18624239396"; // Mechanical sender for mechanicalSmsFrom()
beforeEach(() => sendTelnyxSmsMock.mockReset());

// ── phone normalization ─────────────────────────────────────────────────────
describe("phoneLast10Of + inboxPhoneMatch", () => {
  it("derives the last-10 key from every phone format", () => {
    for (const f of ["+17189383793", "17189383793", "7189383793", "(718) 938-3793", "718-938-3793"]) {
      expect(phoneLast10Of(f)).toBe("7189383793");
    }
  });
  it("matches on the indexed phoneLast10 key with no REGEXP_REPLACE scan", () => {
    const q = dialect.sqlToQuery(inboxPhoneMatch("+17189383793"));
    expect(q.sql).toContain("phoneLast10");
    expect(q.sql).not.toMatch(/RIGHT\(REGEXP_REPLACE/i); // pure index lookup (backfilled)
    expect(q.params).toContain("7189383793");
  });
});

// ── recordOutboundSms ───────────────────────────────────────────────────────
describe("recordOutboundSms", () => {
  it("stores direction, phones, provider ids, sender, status and timestamps", async () => {
    const db = makeFakeDb([[]]); // dup-check finds nothing
    const res = await recordOutboundSms(db, {
      phone: "7189383793", message: "hello", fromNumber: "+18624239396",
      telnyxMessageId: "tx_1", deliveryStatus: "accepted", source: "inbox_reply",
      contactId: null, sentByName: "Team",
    });
    expect(res).toEqual({ inserted: true });
    const v = db.inserts[0].values;
    expect(v.direction).toBe("outbound");
    expect(v.phone).toBe("+17189383793");        // normalized E.164
    expect(v.phoneLast10).toBe("7189383793");     // indexed key
    expect(v.fromNumber).toBe("+18624239396");    // Mechanical sender
    expect(v.toNumber).toBe("+17189383793");      // customer recipient
    expect(v.provider).toBe("telnyx");
    expect(v.textBeltId).toBe("tx_1");            // webhook correlation key
    expect(v.providerMessageId).toBe("tx_1");     // provider message id
    expect(v.deliveryStatus).toBe("accepted");
    expect(v.source).toBe("inbox_reply");
    expect(v.sentAt).toBeInstanceOf(Date);
    expect(v.isRead).toBe(true);
  });

  it("is idempotent — a duplicate provider message id inserts no second row", async () => {
    const db = makeFakeDb([[{ id: 99 }]]); // dup-check finds an existing row
    const res = await recordOutboundSms(db, {
      phone: "7189383793", message: "again", fromNumber: "+1862", telnyxMessageId: "tx_1",
      deliveryStatus: "accepted", source: "campaign",
    });
    expect(res).toEqual({ inserted: false });
    expect(db.inserts).toHaveLength(0);
  });

  it("records a failed send with failed status and no sentAt (never 'delivered')", async () => {
    const db = makeFakeDb([[]]);
    await recordOutboundSms(db, {
      phone: "7189383793", message: "x", fromNumber: "+1862", telnyxMessageId: null,
      deliveryStatus: "failed", source: "inbox_reply",
    });
    const v = db.inserts[0].values;
    expect(v.deliveryStatus).toBe("failed");
    expect(v.sentAt).toBeNull();
  });
});

// ── isPhoneOptedOut ─────────────────────────────────────────────────────────
describe("isPhoneOptedOut", () => {
  it("true when a matching SMS contact is opted out", async () => {
    const db = makeFakeDb([[{ optedOut: true }]]);
    expect(await isPhoneOptedOut(db, "+17189383793")).toBe(true);
  });
  it("true when the number sent an inbound STOP (even if not a contact)", async () => {
    const db = makeFakeDb([[], [{ id: 1 }]]); // no contact, but a STOP row exists
    expect(await isPhoneOptedOut(db, "+17189383793")).toBe(true);
  });
  it("false when neither a contact opt-out nor a STOP exists", async () => {
    const db = makeFakeDb([[], []]);
    expect(await isPhoneOptedOut(db, "+17189383793")).toBe(false);
  });
});

// ── sendAndRecordSms ────────────────────────────────────────────────────────
describe("sendAndRecordSms", () => {
  it("blocks an opted-out number: no send, no row", async () => {
    const db = makeFakeDb([[{ optedOut: true }]]);
    const res = await sendAndRecordSms(db, { phone: "+17189383793", message: "hi", source: "inbox_reply" });
    expect(res.blocked).toBe(true);
    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(db.inserts).toHaveLength(0);
  });

  it("records an accepted outbound row after a successful Telnyx send", async () => {
    sendTelnyxSmsMock.mockResolvedValue({ success: true, messageId: "tx_9" });
    const db = makeFakeDb([[], [], []]); // optout-contact, stop, dup-check all empty
    const res = await sendAndRecordSms(db, { phone: "+17189383793", message: "hi", source: "inbox_reply", contactId: null });
    expect(res.success).toBe(true);
    const v = db.inserts[0].values;
    expect(v.deliveryStatus).toBe("accepted");
    expect(v.providerMessageId).toBe("tx_9");
    expect(v.fromNumber).toBeTruthy(); // sender number stored
  });

  it("records a failed outbound row when Telnyx rejects the send", async () => {
    sendTelnyxSmsMock.mockResolvedValue({ success: false, error: "Telnyx 400" });
    const db = makeFakeDb([[], [], []]);
    const res = await sendAndRecordSms(db, { phone: "+17189383793", message: "hi", source: "inbox_reply" });
    expect(res.success).toBe(false);
    expect(db.inserts[0].values.deliveryStatus).toBe("failed");
  });

  it("labels an AI-VA send as source 'ai_va' / 'AI Assistant', recording the Telnyx id + status", async () => {
    expect(AI_VA_OUTBOUND).toEqual({ source: "ai_va", sentByName: "AI Assistant" });
    sendTelnyxSmsMock.mockResolvedValue({ success: true, messageId: "tx_ai" });
    const db = makeFakeDb([[], [], []]);
    const res = await sendAndRecordSms(db, { phone: "+17189383793", message: "AI reply", ...AI_VA_OUTBOUND });
    expect(res.success).toBe(true);
    const v = db.inserts[0].values;
    expect(v.source).toBe("ai_va");
    expect(v.sentByName).toBe("AI Assistant");
    expect(v.providerMessageId).toBe("tx_ai"); // Telnyx id still recorded
    expect(v.deliveryStatus).toBe("accepted");  // delivery status still recorded
  });
});

// ── applyDeliveryStatusToInbox ──────────────────────────────────────────────
describe("applyDeliveryStatusToInbox", () => {
  it("updates the outbound row keyed by provider message id", async () => {
    const db = makeFakeDb();
    const n = await applyDeliveryStatusToInbox(db, { telnyxMessageId: "tx_9", deliveryStatus: "delivered", errorCode: null });
    expect(n).toBe(1);
    expect(db.updates[0].set).toMatchObject({ deliveryStatus: "delivered" });
    const where = db.wheres.map((w) => w.sql).join(" ");
    expect(where).toContain("textBeltId");   // correlate by provider message id
    expect(where).toContain("direction");    // scoped to outbound rows
  });
});
