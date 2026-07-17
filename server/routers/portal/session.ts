/**
 * Customer Portal — session / auth realm.
 *
 * The portal is a SEPARATE authentication realm from team members and Manus
 * OAuth users. It reuses the codebase's JWT signing (`sdk.signSession`) and
 * cookie helpers, but with its own cookie (`portal_session`) and openId prefix
 * (`portal:<portalAccountId>`, appId `portal`) so the two realms never collide.
 *
 * Nothing in server/_core is modified — `portalProcedure` is built by extending
 * the existing `publicProcedure` with an inline middleware.
 */
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { publicProcedure } from "../../_core/trpc";
import { sdk } from "../../_core/sdk";
import { getSessionCookieOptions } from "../../_core/cookies";
import { ONE_YEAR_MS } from "@shared/const";
import { getDb } from "../../db";
import {
  portalAccounts,
  customers,
  type PortalAccount,
  type Customer,
} from "../../../drizzle/schema";

export const PORTAL_COOKIE = "portal_session";
export const PORTAL_APP_ID = "portal";
const PORTAL_OPENID_PREFIX = "portal:";
export const PORTAL_UNAUTHED_MSG = "Please sign in to your customer portal.";

/** Mint a signed portal session JWT for a portal account. */
export async function createPortalSession(accountId: number, name: string): Promise<string> {
  return sdk.signSession(
    { openId: `${PORTAL_OPENID_PREFIX}${accountId}`, appId: PORTAL_APP_ID, name },
    { expiresInMs: ONE_YEAR_MS },
  );
}

/** Set the portal session cookie on the response (mirrors team auth cookie flags). */
export function setPortalCookie(req: Request, res: Response, token: string): void {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(PORTAL_COOKIE, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

/** Clear the portal session cookie (logout). */
export function clearPortalCookie(res: Response): void {
  res.clearCookie(PORTAL_COOKIE, { path: "/" });
}

/** Extract the raw portal token from the request cookie header. Exported for tests. */
export function readPortalToken(req: Pick<Request, "headers">): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  const parsed = parseCookieHeader(header);
  return parsed[PORTAL_COOKIE] ?? null;
}

/** The authenticated portal principal attached to `ctx.portal` on protected procedures. */
export type PortalPrincipal = { account: PortalAccount; customer: Customer };

/**
 * Resolve the current portal principal from the request, or null when there is
 * no valid portal session. Verifies the JWT, checks the appId/openId shape,
 * loads the account (must not be suspended) and its customer.
 */
export async function resolvePortalPrincipal(
  req: Pick<Request, "headers">,
): Promise<PortalPrincipal | null> {
  const token = readPortalToken(req);
  if (!token) return null;

  const payload = await sdk.verifySession(token);
  if (!payload || payload.appId !== PORTAL_APP_ID) return null;
  if (!payload.openId.startsWith(PORTAL_OPENID_PREFIX)) return null;

  const accountId = Number(payload.openId.slice(PORTAL_OPENID_PREFIX.length));
  if (!Number.isInteger(accountId) || accountId <= 0) return null;

  const db = await getDb();
  if (!db) return null;

  const [account] = await db
    .select()
    .from(portalAccounts)
    .where(eq(portalAccounts.id, accountId))
    .limit(1);
  if (!account || account.status === "suspended") return null;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, account.customerId))
    .limit(1);
  if (!customer) return null;

  return { account, customer };
}

/**
 * Procedure guard for all authenticated portal endpoints. Attaches the resolved
 * `{ account, customer }` to `ctx.portal`. Every downstream query MUST scope by
 * `ctx.portal.customer.id` so a customer can only ever see their own data.
 */
export const portalProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const principal = await resolvePortalPrincipal(ctx.req);
  if (!principal) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: PORTAL_UNAUTHED_MSG });
  }
  return next({ ctx: { ...ctx, portal: principal } });
});
