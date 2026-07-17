/**
 * SMS Inbox thread-detail regression tests.
 *
 * Bug: selecting a conversation for a number that is NOT a saved contact showed
 * "No messages yet" — the detail query was keyed on contactId and disabled when
 * contactId was null, so phone-only threads never loaded. These tests lock in:
 *
 *   1. Phone normalization: +1…, 1…, bare 10-digit, and formatted forms all
 *      resolve to the SAME conversation identity (last 10 digits).
 *   2. listInboxMessages loads a thread from its PHONE alone (no contactId) and
 *      issues a last-10 phone-scoped query, returning inbound + outbound rows.
 *   3. markConversationRead clears unread for an unknown number via phone.
 *
 * A lightweight fake Drizzle db is used — no real connection needed. The SQL of
 * the WHERE clause is rendered to prove the query is scoped by phone.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { last10Digits, hasFullPhone } from "./smsCampaigns";

// ── Fake db plumbing ────────────────────────────────────────────────────────
const dialect = new MySqlDialect();
const capturedWheres: string[] = [];
let selectRows: unknown[] = [];
const updates: Array<{ set: Record<string, unknown> }> = [];

function makeFakeDb() {
  function selectChain() {
    const chain = {
      from: () => chain,
      where: (w: SQL) => {
        try { capturedWheres.push(dialect.sqlToQuery(w).sql); } catch { /* non-SQL */ }
        return chain;
      },
      orderBy: () => chain,
      limit: () => Promise.resolve(selectRows),
    };
    return chain;
  }
  return {
    select: () => selectChain(),
    update: () => ({
      set: (setObj: Record<string, unknown>) => ({
        where: (w: SQL) => {
          try { capturedWheres.push(dialect.sqlToQuery(w).sql); } catch { /* non-SQL */ }
          updates.push({ set: setObj });
          return Promise.resolve([{ affectedRows: 1 }]);
        },
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// getDb is what requireDb() calls under the hood.
vi.mock("../db", () => ({ getDb: vi.fn(async () => makeFakeDb()) }));

// Build an authenticated caller against the real router (real middleware runs).
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

const createCaller = createCallerFactory(appRouter);
function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1, openId: "team:1", name: "Test User", email: "t@example.com",
    loginMethod: "team", role: "user", createdAt: new Date(), updatedAt: new Date(),
    lastSignedIn: new Date(), videoInterests: null, ...overrides,
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

beforeEach(() => {
  capturedWheres.length = 0;
  updates.length = 0;
  selectRows = [];
});

// ── 1. Phone normalization (trace step 5) ───────────────────────────────────
describe("phone normalization → conversation identity", () => {
  const forms = ["+19735181815", "19735181815", "9735181815", "(973) 518-1815", "973-518-1815"];
  it("collapses every form of the same number to one last-10 identity", () => {
    for (const f of forms) expect(last10Digits(f)).toBe("9735181815");
  });
  it("hasFullPhone accepts identifiable numbers and rejects short/empty", () => {
    for (const f of forms) expect(hasFullPhone(f)).toBe(true);
    for (const bad of ["", undefined, null, "12345", "abc"]) expect(hasFullPhone(bad)).toBe(false);
  });
});

// ── 2. Thread loads by phone with NO contactId (the regression) ─────────────
describe("listInboxMessages", () => {
  it("loads a thread from phone alone (contactId null) and scopes by last-10", async () => {
    selectRows = [
      { id: 2, contactId: null, phone: "+19735181815", direction: "outbound", message: "Hi back", isRead: true, createdAt: new Date("2026-07-17T15:00:00Z") },
      { id: 1, contactId: null, phone: "+19735181815", direction: "inbound", message: "Hello", isRead: false, createdAt: new Date("2026-07-17T14:00:00Z") },
    ];
    const rows = await caller().smsCampaigns.listInboxMessages({ phone: "+19735181815", limit: 100 });
    expect(rows).toHaveLength(2); // inbound AND outbound both returned
    // The WHERE clause must scope by the phone column's last 10 digits.
    expect(capturedWheres.join(" ")).toMatch(/RIGHT\(REGEXP_REPLACE/i);
  });

  it("matches regardless of the queried phone's format", async () => {
    selectRows = [{ id: 1, contactId: null, phone: "+19735181815", direction: "inbound", message: "Hi", isRead: false, createdAt: new Date() }];
    const rows = await caller().smsCampaigns.listInboxMessages({ phone: "(973) 518-1815", limit: 100 });
    expect(rows).toHaveLength(1);
  });
});

// ── 3. Mark-as-read works for an unknown number via phone ───────────────────
describe("markConversationRead", () => {
  it("clears unread for a phone-only conversation (no contactId)", async () => {
    const res = await caller().smsCampaigns.markConversationRead({ phone: "+19735181815" });
    expect(res).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].set).toEqual({ isRead: true });
    expect(capturedWheres.join(" ")).toMatch(/RIGHT\(REGEXP_REPLACE/i);
  });

  it("clears unread for a known contact via contactId", async () => {
    const res = await caller().smsCampaigns.markConversationRead({ contactId: 42 });
    expect(res).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].set).toEqual({ isRead: true });
    // Scoped to the contact, not a phone regexp.
    const where = capturedWheres.join(" ");
    expect(where).toContain("contactId");
    expect(where).not.toMatch(/REGEXP_REPLACE/i);
  });

  it("rejects a call with neither phone nor contactId", async () => {
    await expect(caller().smsCampaigns.markConversationRead({})).rejects.toThrow();
  });
});
