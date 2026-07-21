/**
 * Dispatch (M1 read + M2 assignment) — authorization boundary + BOUNDED-WRITE guard.
 *
 *  1. Admin-only: anon / member / viewer are rejected on every query AND on the
 *     assign / unassign mutations; an admin passes the boundary into the handler.
 *  2. Static bounded-write guard: the router may now write, but ONLY (a) UPDATE
 *     appointments and (b) INSERT appointmentAssignmentEvents — nothing else, no
 *     DELETE, no raw DML, and still no side-effecting service import. Fails the
 *     build if anyone widens the write surface or adds an SMS/email/calendar/
 *     QBO/AI/notification import. The concurrency row-lock must remain.
 */
import "./testEnvSetup";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";
import { canAssignDispatch } from "../shared/dispatchPermissions";

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
// Valid inputs so the ONLY reason a non-admin is rejected is authorization.
const ASSIGN = { appointmentId: 1, technicianId: 2, expectedAssignedToId: null } as const;
const UNASSIGN = { appointmentId: 1, expectedAssignedToId: null } as const;

describe("dispatch — admin-only authorization (queries + mutations)", () => {
  it("rejects anon / member / viewer on every query and mutation", async () => {
    for (const call of [
      () => asAnon().dispatch.roster(),
      () => asAnon().dispatch.board({}),
      () => asAnon().dispatch.unscheduled({}),
      () => asAnon().dispatch.assign(ASSIGN),
      () => asAnon().dispatch.unassign(UNASSIGN),
      () => asMember().dispatch.board({}),
      () => asMember().dispatch.assign(ASSIGN),
      () => asMember().dispatch.unassign(UNASSIGN),
      () => asViewer().dispatch.assign(ASSIGN),
      () => asViewer().dispatch.unassign(UNASSIGN),
    ]) expect(await code(call)).toBe("FORBIDDEN");
  });
  it("an admin passes the authz boundary into every handler", async () => {
    for (const call of [
      () => asAdmin().dispatch.roster(),
      () => asAdmin().dispatch.board({}),
      () => asAdmin().dispatch.unscheduled({}),
      () => asAdmin().dispatch.assign(ASSIGN),
      () => asAdmin().dispatch.unassign(UNASSIGN),
    ]) {
      const c = await code(call);
      expect(c).not.toBe("FORBIDDEN");
      expect(c).not.toBe("UNAUTHORIZED"); // no DB in the unit env → reaches its own guard, proving authz passed
    }
  });
});

describe("dispatch — canAssignDispatch (M2 = admin only)", () => {
  it("only admins may assign; no new roles", () => {
    expect(canAssignDispatch({ role: "admin" })).toBe(true);
    expect(canAssignDispatch({ role: "admin", teamRole: "admin" })).toBe(true);
    expect(canAssignDispatch({ role: "user", teamRole: "member" })).toBe(false);
    expect(canAssignDispatch({ role: "user", teamRole: "viewer" })).toBe(false);
    expect(canAssignDispatch(null)).toBe(false);
    expect(canAssignDispatch(undefined)).toBe(false);
  });
});

describe("dispatch — static BOUNDED-WRITE safety guard", () => {
  const src = readFileSync("server/routers/dispatch.ts", "utf8");
  // Strip comments so guards inspect executable code, not prose (the header names
  // the very services + verbs it must never use).
  const codeStr = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("exposes exactly two mutations: assign and unassign", () => {
    expect(codeStr).toContain(".query(");
    const mutationCount = (codeStr.match(/\.mutation\(/g) ?? []).length;
    expect(mutationCount).toBe(2);
    expect(codeStr).toMatch(/\bassign:\s*adminProcedure/);
    expect(codeStr).toMatch(/\bunassign:\s*adminProcedure/);
  });

  it("writes ONLY appointments (update) and appointmentAssignmentEvents (insert)", () => {
    const updates = [...codeStr.matchAll(/\.update\((\w+)\)/g)].map(m => m[1]);
    const inserts = [...codeStr.matchAll(/\.insert\((\w+)\)/g)].map(m => m[1]);
    expect(new Set(updates)).toEqual(new Set(["appointments"]));
    expect(new Set(inserts)).toEqual(new Set(["appointmentAssignmentEvents"]));
  });

  it("performs no deletes and no raw DML", () => {
    expect(codeStr).not.toMatch(/\.delete\s*\(/);
    expect(codeStr).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|`)/i);
  });

  it("locks the appointment row for update (concurrency guard stays)", () => {
    expect(codeStr).toContain('.for("update")');
  });

  it("imports no side-effecting service (SMS / email / calendar / QBO / AI / notification)", () => {
    const importLines = codeStr.split("\n").filter(l => /^\s*import\b/.test(l)).join("\n");
    for (const re of [/telnyx/i, /appointmentSms/i, /emailService/i, /sendEmail/i, /appointmentInvites/i, /googleCalendar/i, /quickbooks/i, /accounting/i, /anthropic/i, /_core\/llm/i, /notification/i, /notifyOwner/i]) {
      expect(importLines).not.toMatch(re);
    }
  });

  it("reads only the expected tables", () => {
    const froms = [...codeStr.matchAll(/\.(from|leftJoin)\((\w+)/g)].map(m => m[2]);
    expect(new Set(froms)).toEqual(new Set(["appointments", "customers", "jobs", "teamMembers"]));
  });
});
