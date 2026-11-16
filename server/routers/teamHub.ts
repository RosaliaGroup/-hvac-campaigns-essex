/**
 * Team Hub inside the CRM. The hub (tasks, clock, EOD/EOW, scorecard) runs on
 * Supabase; this asks it for a short-lived session for the signed-in CRM user
 * (matched by email) so it opens on the CRM's Team Hub page without a separate
 * link. During an admin preview the session is read-only.
 */
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

const HUB_FN = "https://luznebxgkqglxtkpyksb.supabase.co/functions/v1/team-hub";
const HUB_PAGE = "/p/team-8b159de4";

export const teamHubRouter = router({
  link: protectedProcedure.query(async ({ ctx }) => {
    const secret = process.env.TEAM_HUB_SECRET?.trim();
    const email = String(ctx.user?.email ?? "").trim().toLowerCase();
    if (!secret || !email) return { url: null as string | null, reason: "not_configured" };
    try {
      const r = await fetch(HUB_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sso", secret, email, readonly: (ctx.user as { preview?: boolean }).preview === true }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`hub ${r.status}`);
      if (!j?.found || typeof j.key !== "string") return { url: null, reason: "not_on_team" };
      return { url: `${HUB_PAGE}#k=${encodeURIComponent(j.key)}`, reason: null };
    } catch (err) {
      console.error("[TeamHub] sso failed:", err instanceof Error ? err.message : err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't open the Team Hub. Try again in a minute." });
    }
  }),
});
