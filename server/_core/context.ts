import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

/**
 * Authenticated user with the (optional) real team role.
 * Team sessions carry teamRole "admin" | "member" | "viewer" | "sales";
 * Manus OAuth users have no teamRole (treated as member-level).
 */
export type AuthenticatedUser = User & { teamRole?: "admin" | "member" | "viewer" | "sales"; preview?: boolean };

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;

  try {
    const auth = await sdk.authenticateRequest(opts.req);
    user = auth.user;

    // Admin "preview as sales rep" (client/src/lib/viewAs.ts). Only ever lowers
    // privileges: an admin session is handled exactly like a sales session.
    // Preview is READ-ONLY (see requireUser in trpc.ts).
    const viewAs = String(opts.req?.headers?.["x-view-as"] ?? "");
    const isAdmin = !!user && (user.role === "admin" || user.teamRole === "admin");
    if (user && isAdmin && viewAs === "sales") {
      user = { ...user, role: "user", teamRole: "sales", preview: true };
    } else if (user && isAdmin && /^member:\d+$/.test(viewAs)) {
      // See the CRM exactly as one non-admin team member sees it.
      const member = await db.getTeamMemberById(Number(viewAs.slice(7)));
      if (member && member.role !== "admin") {
        user = {
          ...user,
          id: -member.id,
          openId: `team:${member.id}`,
          name: member.name,
          email: member.email,
          loginMethod: "team",
          role: "user",
          teamRole: member.role,
          preview: true,
        } as AuthenticatedUser;
      }
    }

    // Sliding idle window: on every authenticated request, re-issue the session
    // cookie with a fresh 30-minute idle deadline (capped at the absolute
    // expiry). This is what "any authenticated request resets the timer" means
    // for a stateless JWT session. Never runs for anonymous/public requests.
    if (user && auth.refreshedToken && opts.res && typeof opts.res.cookie === "function") {
      const cookieOptions = getSessionCookieOptions(opts.req);
      opts.res.cookie(COOKIE_NAME, auth.refreshedToken, {
        ...cookieOptions,
        maxAge: auth.refreshMaxAgeMs,
      });
    }
  } catch (error) {
    // Authentication is optional for public procedures; never block on it.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
