/**
 * Team Hub inside the CRM. The hub (tasks, clock, EOD/EOW, scorecard) runs on
 * Supabase; this asks it for a short-lived session for the signed-in CRM user
 * (matched by email) so it opens on the CRM's Team Hub page without a separate
 * link. During an admin preview the session is read-only.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const HUB_FN = "https://luznebxgkqglxtkpyksb.supabase.co/functions/v1/team-hub";
const HUB_PAGE = "/p/team-8b159de4";

async function hubCall(body: Record<string, unknown>): Promise<any> {
  const secret = process.env.TEAM_HUB_SECRET?.trim();
  if (!secret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The Team Hub isn't connected yet." });
  const r = await fetch(HUB_FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, secret }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: j?.error ?? "Team Hub request failed." });
  return j;
}

const target = z.object({ type: z.enum(["customer", "lead"]), id: z.number().int().positive() });

export const teamHubRouter = router({
  /** Who this contact or lead is assigned to, what to do, goal and latest result. */
  assignment: protectedProcedure.input(target).query(async ({ input }) => {
    const j = await hubCall({ action: "assignment_for", crm_type: input.type, crm_id: input.id }).catch(() => null);
    return (j?.assignment ?? null) as null | {
      id: number; person: string; personName: string; action: string | null; goal: string | null; talk: string | null;
      status: string; result: string | null; note: string | null; updatedAt: string | null;
    };
  }),

  /** Team members who can be assigned work (admin). */
  people: adminProcedure.query(async () => {
    const j = await hubCall({ action: "assign_people" }).catch(() => null);
    return (j?.people ?? []) as { id: string; name: string; role: string }[];
  }),

  /** Assign, reassign or unassign a contact/lead (admin). */
  assign: adminProcedure
    .input(target.extend({ person: z.string().max(40).nullable(), action: z.string().max(500).optional(), label: z.string().max(200).optional(), phone: z.string().max(40).optional() }))
    .mutation(async ({ input }) => {
      await hubCall({ action: "assign", crm_type: input.type, crm_id: input.id, person: input.person, what: input.action, label: input.label, phone: input.phone });
      return { ok: true };
    }),

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
