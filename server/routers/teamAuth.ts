import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { notifyOwner } from "../_core/notification";
import { sendPasswordResetEmail, sendTeamInviteEmail } from "../services/emailService";

const TEAM_SESSION_PREFIX = "team:";

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Creates a JWT session token for a team member.
 * Uses a special openId prefix "team:<id>" so the existing SDK can sign/verify it.
 */
async function createTeamSession(memberId: number, name: string): Promise<string> {
  return sdk.signSession(
    { openId: `${TEAM_SESSION_PREFIX}${memberId}`, appId: "team", name },
    { expiresInMs: ONE_YEAR_MS }
  );
}

export const teamAuthRouter = router({
  /**
   * Owner invites a new team member by email.
   * Protected — only logged-in owner/admin can invite.
   */
  invite: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100),
      role: z.enum(["admin", "member", "viewer"]).default("member"),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getTeamMemberByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A team member with this email already exists." });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.createTeamMember({
        email: input.email,
        name: input.name,
        role: input.role,
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        invitedBy: ctx.user?.name ?? ctx.user?.email ?? "Owner",
      });

      const inviteUrl = `${input.origin}/accept-invite?token=${token}`;

      // Send invite email directly to the new team member
      const emailSent = await sendTeamInviteEmail(
        input.email,
        input.name,
        inviteUrl,
        ctx.user?.name ?? ctx.user?.email ?? "Owner"
      ).catch(() => false);

      // Also notify owner (as backup)
      await notifyOwner({
        title: `Team Invite Sent: ${input.name} (${input.email})`,
        content: `You invited ${input.name} (${input.email}) as ${input.role}.${emailSent ? " An invite email was sent directly to them." : " Note: Email delivery failed — send them this link manually:"}\n\n${inviteUrl}\n\nExpires in 7 days.`,
      }).catch(() => {});

      return { success: true, inviteUrl };
    }),

  /**
   * Returns the invite details for a given token (used on the accept-invite page).
   */
  getInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await db.getTeamMemberByInviteToken(input.token);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already used." });
      }
      if (member.inviteExpiresAt && new Date() > member.inviteExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite link has expired. Ask the owner to send a new one." });
      }
      return { email: member.email, name: member.name, role: member.role };
    }),

  /**
   * Team member accepts their invite by setting a password.
   */
  acceptInvite: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberByInviteToken(input.token);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already used." });
      }
      if (member.inviteExpiresAt && new Date() > member.inviteExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite link has expired." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await db.activateTeamMember(member.id, passwordHash);

      // Auto-login after accepting invite
      const sessionToken = await createTeamSession(member.id, member.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, name: member.name, role: member.role };
    }),

  /**
   * Team member login with email + password.
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberByEmail(input.email);
      if (!member || !member.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      if (member.status === "invited") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please accept your invite first by clicking the link in your invitation email." });
      }
      if (member.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been suspended. Contact the owner." });
      }

      const valid = await bcrypt.compare(input.password, member.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      await db.updateTeamMemberLastSignedIn(member.id);

      const sessionToken = await createTeamSession(member.id, member.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, name: member.name, role: member.role };
    }),

  /**
   * Request a password reset email.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const member = await db.getTeamMemberByEmail(input.email);
      // Always return success to prevent email enumeration
      if (!member || member.status === "invited") {
        return { success: true };
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.setTeamMemberResetToken(member.id, token, expiresAt);

      const resetUrl = `${input.origin}/reset-password?token=${token}`;

      // Send reset link directly to the user's email
      const emailSent = await sendPasswordResetEmail(
        member.email,
        member.name,
        resetUrl
      ).catch(() => false);

      // Also notify owner as backup in case email fails
      if (!emailSent) {
        await notifyOwner({
          title: `Password Reset Request: ${member.name}`,
          content: `${member.name} (${member.email}) requested a password reset but the email could not be delivered.\n\nManually send them this link:\n${resetUrl}\n\nExpires in 1 hour.`,
        }).catch(() => {});
      }

      return { success: true };
    }),

  /**
   * Reset password using a valid reset token.
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberByResetToken(input.token);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reset link not found or already used." });
      }
      if (member.resetExpiresAt && new Date() > member.resetExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired. Request a new one." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await db.resetTeamMemberPassword(member.id, passwordHash);

      // Auto-login after reset
      const sessionToken = await createTeamSession(member.id, member.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, name: member.name };
    }),

  /**
   * List all team members (owner only).
   */
  list: protectedProcedure.query(async () => {
    const members = await db.listTeamMembers();
    return members.map(m => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      status: m.status,
      invitedBy: m.invitedBy,
      lastSignedIn: m.lastSignedIn,
      createdAt: m.createdAt,
    }));
  }),

  /**
   * Suspend or reactivate a team member (owner only).
   */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["active", "suspended"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateTeamMemberStatus(input.id, input.status);
      return { success: true };
    }),

  /**
   * Remove a team member (owner only).
   */
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTeamMember(input.id);
      return { success: true };
    }),

  /**
   * Resend an invite link to a pending team member.
   */
  resendInvite: protectedProcedure
    .input(z.object({
      id: z.number(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.id);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.setTeamMemberResetToken(member.id, token, expiresAt);
      // Reuse reset token as new invite token
      const inviteUrl = `${input.origin}/accept-invite?token=${token}`;

      await notifyOwner({
        title: `Resent Invite: ${member.name} (${member.email})`,
        content: `New invite link for ${member.name} (${member.email}):\n${inviteUrl}\n\nExpires in 7 days.`,
      }).catch(() => {});

      return { success: true, inviteUrl };
    }),
});
