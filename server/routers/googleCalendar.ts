/**
 * Google Calendar integration router (Task 8).
 * - adminProcedure: connectStart / disconnect (privileged)
 * - protectedProcedure: getStatus (metadata only — never tokens)
 * The OAuth callback itself is an Express route (integrations/google/routes.ts).
 */
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { googleCalendarProvider, getGoogleConfig, buildAuthorizeUrl, signState } from "../integrations/google/calendar";

export const googleCalendarRouter = router({
  /** Connection metadata only — never tokens. */
  getStatus: protectedProcedure.query(() => googleCalendarProvider.getStatus()),

  /** Admin: begin OAuth. Returns the Google consent URL with a signed state. */
  connectStart: adminProcedure.mutation(() => {
    const cfg = getGoogleConfig();
    if (!cfg.clientId || !cfg.redirectUri) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Google Calendar client credentials are not configured",
      });
    }
    return { url: buildAuthorizeUrl(cfg, signState()) };
  }),

  /** Admin: revoke + remove the stored connection. */
  disconnect: adminProcedure.mutation(async () => {
    await googleCalendarProvider.disconnect();
    return { ok: true };
  }),
});
