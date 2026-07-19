/**
 * Dispatch audit (M0) — authorization boundary + read-only safety guard.
 *
 *  1. Admin-only: anon and non-admin team members are rejected; an admin passes
 *     the authz boundary into the handler.
 *  2. Static guard: the router module is structurally read-only — a `query` with
 *     no write statements and no side-effecting service imports. This fails the
 *     build if anyone later adds a mutation, an INSERT/UPDATE/DELETE, or an
 *     SMS/email/calendar/QBO/AI/notification import.
 *  3. `canAccessDispatch` resolves to admin-only in M0 (no new roles).
 */
import "./testEnvSetup";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";
import { canAccessDispatch } from "../shared/dispatchPermissions";

const createCaller = createCallerFactory(appRouter);
function makeUser(o: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: -1, openId: "team:1", name: "T", email: "t@e.com", loginMethod: "team", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null, ...o };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return { req: { headers: {}, ip: "1.1.1.1" } as never, res: { cookie: () => {}, clearCookie: () => {} } as never, user };
}
const asAnon = () => createCaller(makeCtx(null));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));
async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "NO_ERROR"; } catch (e) { return e instanceof TRPCError ? e.code : `NON_TRPC:${String(e)}`; }
}

describe("dispatchAudit — admin-only authorization", () => {
  it("rejects anonymous, member, and viewer callers", async () => {
    expect(await code(() => asAnon().dispatchAudit.report())).toBe("FORBIDDEN");
    expect(await code(() => asMember().dispatchAudit.report())).toBe("FORBIDDEN");
    expect(await code(() => asViewer().dispatchAudit.report())).toBe("FORBIDDEN");
  });
  it("an admin passes the authz boundary into the handler", async () => {
    const c = await code(() => asAdmin().dispatchAudit.report());
    expect(c).not.toBe("FORBIDDEN");
    expect(c).not.toBe("UNAUTHORIZED");
    // no DB in the unit env → handler reaches its own guard, proving authz passed
  });
});

describe("dispatchAudit — canAccessDispatch (M0 = admin only)", () => {
  it("only admins pass; no new roles", () => {
    expect(canAccessDispatch({ role: "admin" })).toBe(true);
    expect(canAccessDispatch({ role: "admin", teamRole: "admin" })).toBe(true);
    expect(canAccessDispatch({ role: "user", teamRole: "member" })).toBe(false);
    expect(canAccessDispatch({ role: "user", teamRole: "viewer" })).toBe(false);
    expect(canAccessDispatch(null)).toBe(false);
    expect(canAccessDispatch(undefined)).toBe(false);
  });
});

describe("dispatchAudit — static read-only safety guard", () => {
  const src = readFileSync("server/routers/dispatchAudit.ts", "utf8");
  // Strip comments so guards inspect executable code, not prose (the header lists
  // the very services it must not import).
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("is a query, never a mutation", () => {
    expect(code).toContain(".query(");
    expect(code).not.toContain(".mutation(");
  });
  it("contains no write statements", () => {
    // No drizzle writes and no raw DML.
    expect(code).not.toMatch(/\.(insert|update|delete)\s*\(/);
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|`)/i);
  });
  it("imports no side-effecting service (SMS / email / calendar / QBO / AI / notification)", () => {
    const importLines = code.split("\n").filter(l => /^\s*import\b/.test(l)).join("\n");
    const forbidden = [/telnyx/i, /appointmentSms/i, /emailService/i, /sendEmail/i, /appointmentInvites/i, /googleCalendar/i, /quickbooks/i, /accounting/i, /anthropic/i, /_core\/llm/i, /notification/i, /notifyOwner/i];
    for (const re of forbidden) expect(importLines).not.toMatch(re);
  });
  it("reads only the five expected tables", () => {
    // sanity: every .from(...) target is one of the read-only projections
    const froms = [...code.matchAll(/\.from\((\w+)\)/g)].map(m => m[1]);
    expect(new Set(froms)).toEqual(new Set(["jobs", "appointments", "teamMembers", "jobCompletions", "properties"]));
  });
});
