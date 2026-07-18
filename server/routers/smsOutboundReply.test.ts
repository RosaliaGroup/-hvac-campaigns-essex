/**
 * Inbox reply-by-phone — router-level tests (real appRouter + middleware).
 *
 * Covers:
 *   • reply works with contactId = null (unknown number) and records an outbound row
 *   • reply is blocked for an opted-out number (nothing sent)
 *   • conversationSendState reports opt-out / is-contact / sender number
 *
 * Fake db + mocked Telnyx transport; no network, no real DB.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";

const sendTelnyxSmsMock = vi.fn();
vi.mock("../services/telnyxSms", () => ({
  sendTelnyxSms: (...args: unknown[]) => sendTelnyxSmsMock(...args),
  telnyxConfigured: () => true,
  toE164: (p: string | null | undefined) => {
    if (!p) return null;
    const d = String(p).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any = null;
vi.mock("../db", () => ({ getDb: vi.fn(async () => currentDb) }));

import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "T", email: "t@example.com", loginMethod: "team", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o,
  } as AuthenticatedUser;
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return {
    req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}
const caller = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

interface Insert { values: Record<string, unknown> }
function makeFakeDb(selects: unknown[][] = []) {
  const queue = [...selects];
  const inserts: Insert[] = [];
  const db = {
    inserts,
    select() {
      const chain = { from: () => chain, where: (_w: SQL) => chain, orderBy: () => chain, limit: () => Promise.resolve(queue.shift() ?? []) };
      return chain;
    },
    insert() { return { values(v: Record<string, unknown>) { inserts.push({ values: v }); return Promise.resolve([{ insertId: inserts.length }]); } }; },
    update() { return { set() { return { where() { return Promise.resolve([{ affectedRows: 1 }]); } }; } }; },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

beforeEach(() => {
  sendTelnyxSmsMock.mockReset();
  process.env.TELNYX_FROM_NUMBER = "+18624239396";
});

describe("replyToConversation", () => {
  it("sends and records an outbound row for an unknown number (contactId null)", async () => {
    sendTelnyxSmsMock.mockResolvedValue({ success: true, messageId: "tx_7" });
    // queue: contact-lookup(none), opt-out-contact(none), STOP(none), dup-check(none)
    currentDb = makeFakeDb([[], [], [], []]);

    const r = await caller().smsCampaigns.replyToConversation({ phone: "+17189383793", message: "Absolutely." });
    expect(r.success).toBe(true);
    expect(sendTelnyxSmsMock).toHaveBeenCalledOnce();

    const v = currentDb.inserts[0].values;
    expect(v.direction).toBe("outbound");
    expect(v.contactId).toBeNull();              // unknown number stays unlinked
    expect(v.source).toBe("inbox_reply");
    expect(v.providerMessageId).toBe("tx_7");    // provider message id stored
    expect(v.fromNumber).toBe("+18624239396");   // sender number stored
    expect(v.phoneLast10).toBe("7189383793");
  });

  it("blocks a reply to an opted-out number (nothing sent, nothing recorded)", async () => {
    // queue: contact-lookup(none), opt-out-contact(opted out) → blocked before STOP check
    currentDb = makeFakeDb([[], [{ optedOut: true }]]);

    await expect(
      caller().smsCampaigns.replyToConversation({ phone: "+17189383793", message: "hi" }),
    ).rejects.toThrow(/opted out/i);
    expect(sendTelnyxSmsMock).not.toHaveBeenCalled();
    expect(currentDb.inserts).toHaveLength(0);
  });
});

describe("conversationSendState", () => {
  it("reports is-contact, not-opted-out, and the Mechanical sender number", async () => {
    // queue: contact-lookup(found), opt-out-contact(not opted), STOP(none)
    currentDb = makeFakeDb([[{ id: 5 }], [{ optedOut: false }], []]);
    const s = await caller().smsCampaigns.conversationSendState({ phone: "+17189383793" });
    expect(s.isContact).toBe(true);
    expect(s.optedOut).toBe(false);
    expect(s.fromNumber).toBe("+18624239396");
  });
});
