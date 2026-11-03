/**
 * Recorded click-to-call from the CRM. See server/services/clickToCall.ts.
 * Available to members, admins and the sales role (viewers are read-only, so
 * their `start` is blocked by protectedProcedure).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  clickToCallConfigured,
  getCallLogById,
  listCallsForContact,
  recordingPlaybackUrl,
  startClickToCall,
} from "../services/clickToCall";

const TEAM_PREFIX = "team:";

function teamMemberIdOf(user: { openId?: string | null } | null | undefined): number | null {
  const openId = user?.openId ?? "";
  if (!openId.startsWith(TEAM_PREFIX)) return null;
  const id = parseInt(openId.slice(TEAM_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
}

export const callsRouter = router({
  /** Whether calling is set up, and the number the app will ring for this user. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const memberId = teamMemberIdOf(ctx.user);
    const member = memberId ? await db.getTeamMemberById(memberId) : null;
    return {
      configured: clickToCallConfigured(),
      myPhone: member?.mobilePhone ?? null,
    };
  }),

  start: protectedProcedure
    .input(
      z.object({
        phone: z.string().min(7).max(40),
        customerId: z.number().int().optional(),
        leadCaptureId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const memberId = teamMemberIdOf(ctx.user);
      const member = memberId ? await db.getTeamMemberById(memberId) : null;
      const result = await startClickToCall({
        repTeamMemberId: memberId,
        repPhone: member?.mobilePhone ?? null,
        clientPhone: input.phone,
        customerId: input.customerId ?? null,
        leadCaptureId: input.leadCaptureId ?? null,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "telnyx_error" ? "INTERNAL_SERVER_ERROR" : "PRECONDITION_FAILED",
          message: result.message,
        });
      }
      return result;
    }),

  listForContact: protectedProcedure
    .input(
      z.object({
        customerId: z.number().int().optional(),
        leadCaptureId: z.number().int().optional(),
        phone: z.string().max(40).optional().nullable(),
      }),
    )
    .query(({ input }) => listCallsForContact(input)),

  /** Fresh, short-lived link to play one call's recording. */
  recordingUrl: protectedProcedure
    .input(z.object({ callLogId: z.number().int() }))
    .query(async ({ input }) => {
      const log = await getCallLogById(input.callLogId);
      if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      const url = await recordingPlaybackUrl(log.recordingUrl);
      return { url };
    }),
});
