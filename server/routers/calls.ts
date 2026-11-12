/**
 * Recorded click-to-call from the CRM. See server/services/clickToCall.ts.
 * Available to members, admins and the sales role (viewers are read-only, so
 * their `start` is blocked by protectedProcedure).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { isSalesUser } from "../../shared/salesAccess";
import * as db from "../db";
import {
  clickToCallConfigured,
  getCallLogById,
  listCallsForContact,
  recordingPlaybackUrl,
  startClickToCall,
} from "../services/clickToCall";
import { listQcReviews, qcForCallLog, qcSummaries } from "../services/callQc";
import { browserDialerConfigured, finishBrowserCall, startBrowserCall, webrtcLoginToken } from "../services/webrtcDialer";

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
      /** Calls placed from the browser with a headset (preferred when set up). */
      browserDialer: browserDialerConfigured() && memberId !== null,
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
    .query(async ({ input }) => {
      const rows = await listCallsForContact(input);
      const qc = await qcSummaries(rows.map((r) => r.id)).catch(() => new Map());
      return rows.map((r) => ({ ...r, qc: qc.get(r.id) ?? null }));
    }),

  /** Fresh, short-lived link to play one call's recording. */
  recordingUrl: protectedProcedure
    .input(z.object({ callLogId: z.number().int() }))
    .query(async ({ input }) => {
      const log = await getCallLogById(input.callLogId);
      if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      const url = await recordingPlaybackUrl(log.recordingUrl);
      return { url };
    }),

  /** Login token for the browser dialer (Telnyx WebRTC). */
  webrtcToken: protectedProcedure.mutation(async ({ ctx }) => {
    const memberId = teamMemberIdOf(ctx.user);
    if (!memberId || !browserDialerConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Browser calling isn't set up yet." });
    }
    try {
      return { token: await webrtcLoginToken(memberId) };
    } catch (err) {
      console.error("[BrowserDialer] token failed:", err instanceof Error ? err.message : err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't connect the phone. Try again in a minute." });
    }
  }),

  /** Log a browser call before it is dialed. */
  webrtcStart: protectedProcedure
    .input(
      z.object({
        phone: z.string().min(7).max(40),
        customerId: z.number().int().optional(),
        leadCaptureId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const memberId = teamMemberIdOf(ctx.user);
      if (!memberId || !browserDialerConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Browser calling isn't set up yet." });
      }
      try {
        return await startBrowserCall({ memberId, phone: input.phone, customerId: input.customerId, leadCaptureId: input.leadCaptureId });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Couldn't start the call." });
      }
    }),

  /** Save how a browser call ended (Telnyx session id, answered, length). */
  webrtcFinish: protectedProcedure
    .input(
      z.object({
        callLogId: z.number().int(),
        sessionId: z.string().max(100).optional().nullable(),
        answered: z.boolean(),
        durationSec: z.number().min(0).max(4 * 3600),
        hangupCause: z.string().max(40).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const memberId = teamMemberIdOf(ctx.user);
      if (!memberId) throw new TRPCError({ code: "FORBIDDEN" });
      await finishBrowserCall({ memberId, ...input });
      return { ok: true };
    }),

  /** QC review for one call. Sales reps see only their own calls. */
  qcForCall: protectedProcedure.input(z.object({ callLogId: z.number().int() })).query(async ({ input, ctx }) => {
    const log = await getCallLogById(input.callLogId);
    if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
    if (isSalesUser(ctx.user as any) && log.agentTeamMemberId !== teamMemberIdOf(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your call." });
    }
    return qcForCallLog(input.callLogId);
  }),

  /** Admin: recent QC reviews, optionally for one rep. */
  qcList: adminProcedure
    .input(z.object({ agentTeamMemberId: z.number().int().optional(), days: z.number().int().min(1).max(90).optional() }))
    .query(({ input }) => listQcReviews(input)),
});
