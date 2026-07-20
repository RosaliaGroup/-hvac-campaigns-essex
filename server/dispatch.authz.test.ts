/**
 * Dispatch board (M1) — authorization boundary + read-only safety guard.
 *
 *  1. Admin-only: anon / member / viewer are rejected on every dispatch query;
 *     an admin passes the boundary into the handler.
 *  2. Static guard: the router is structurally read-only — queries only (no
 *     mutation), no write statements, and no side-effecting service imports.
 *     Fails the build if anyone later adds an assign/reschedule mutation or an
 *     SMS/email/calendar/QBO/AI/notification import.
 */
import "./testEnvSetup";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

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

describe("dispatch (M1) — admin-only authorization", () => {
  it("rejects anon / member / viewer on every query", async () => {
    for (const call of [
      () => asAnon().dispatch.roster(),
      () => asAnon().dispatch.board({}),
      () => asAnon().dispatch.unscheduled({}),
      () => asMember().dispatch.roster(),
      () => asMember().dispatch.board({}),
      () => asMember().dispatch.unscheduled({}),
      () => asViewer().dispatch.board({}),
    ]) expect(await code(call)).toBe("FORBIDDEN");
  });
  it("an admin passes the authz boundary into the handler", async () => {
    for (const call of [
      () => asAdmin().dispatch.roster(),
      () => asAdmin().dispatch.board({}),
      () => asAdmin().dispatch.unscheduled({}),
    ]) {
      const c = await code(call);
      expect(c).not.toBe("FORBIDDEN");
      expect(c).not.toBe("UNAUTHORIZED"); // no DB in the unit env → reaches its own guard, proving authz passed
    }
  });
});

describe("dispatch (M1) — static read-only safety guard", () => {
  const src = readFileSync("server/routers/dispatch.ts", "utf8");
  // Strip comments so guards inspect executable code, not prose (the header names
  // the very services it must never import).
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("exposes queries only, never a mutation", () => {
    expect(code).toContain(".query(");
    expect(code).not.toContain(".mutation(");
  });
  it("contains no write statements", () => {
    expect(code).not.toMatch(/\.(insert|update|delete)\s*\(/);
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|`)/i);
  });
  it("imports no side-effecting service (SMS / email / calendar / QBO / AI / notification)", () => {
    const importLines = code.split("\n").filter(l => /^\s*import\b/.test(l)).join("\n");
    for (const re of [/telnyx/i, /appointmentSms/i, /emailService/i, /sendEmail/i, /appointmentInvites/i, /googleCalendar/i, /quickbooks/i, /accounting/i, /anthropic/i, /_core\/llm/i, /notification/i, /notifyOwner/i]) {
      expect(importLines).not.toMatch(re);
    }
  });
  it("reads only the expected tables", () => {
    const froms = [...code.matchAll(/\.(from|leftJoin)\((\w+)/g)].map(m => m[2]);
    expect(new Set(froms)).toEqual(new Set(["appointments", "customers", "jobs", "teamMembers"]));
  });
});
