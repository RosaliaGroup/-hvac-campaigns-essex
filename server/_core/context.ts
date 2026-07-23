import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

/**
 * Authenticated user with the (optional) real team role.
 * Team sessions carry teamRole "admin" | "member" | "viewer";
 * Manus OAuth users have no teamRole (treated as member-level).
 */
export type AuthenticatedUser = User & { teamRole?: "admin" | "member" | "viewer" };

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
