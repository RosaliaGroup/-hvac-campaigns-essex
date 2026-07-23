import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import type { TeamMemberContactFields } from "../db";
import { formatUsPhone } from "@shared/validation";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { logAuthEventFromReq } from "../_core/authLog";
import { notifyOwner } from "../_core/notification";
import { sendPasswordResetEmail, sendTeamInviteEmail } from "../services/emailService";

const TEAM_SESSION_PREFIX = "team:";

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Creates a hardened JWT session for a team member. Uses the "team:<id>" openId
 * prefix so the SDK can sign/verify it. `rememberDevice` selects the absolute
 * lifetime (8h default, 30d when remembered); a 30-minute idle window applies
 * either way. Returns the token plus the cookie `maxAge` (ms) to set.
 */
async function createTeamSession(
  memberId: number,
  name: string,
  rememberDevice = false
): Promise<{ token: string; ttlMs: number }> {
  const { token, ttlMs } = await sdk.issueSession(
    { openId: `${TEAM_SESSION_PREFIX}${memberId}`, appId: "team", name },
    { rememberDevice }
  );
  return { token, ttlMs };
}

/** Resolve the logged-in team member's id from a "team:<id>" session, else null. */
function currentTeamMemberId(ctx: { user?: { openId?: string | null } | null }): number | null {
  const openId = ctx.user?.openId;
  if (typeof openId !== "string" || !openId.startsWith(TEAM_SESSION_PREFIX)) return null;
  const id = parseInt(openId.slice(TEAM_SESSION_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
}

/** ~1.5MB base64 ceiling; the client resizes photos well below this. */
const PHOTO_MAX_LEN = 2_000_000;

/**
 * Optional contact-detail inputs shared by invite / update / updateMyProfile.
 * `.nullish()` = may be omitted (leave unchanged) or null (clear the value).
 * Deliberately EXCLUDES name/email/role/status so self-service callers cannot
 * change identity, permissions, or account status.
 */
const contactInputSchema = z.object({
  mobilePhone: z.string().trim().nullish(),
  streetAddress: z.string().trim().max(255).nullish(),
  city: z.string().trim().max(120).nullish(),
  state: z.string().trim().max(2).nullish(),
  zipCode: z.string().trim().max(10).nullish(),
  emergencyContactName: z.string().trim().max(255).nullish(),
  emergencyContactRelationship: z.string().trim().max(120).nullish(),
  emergencyContactPhone: z.string().trim().nullish(),
  preferredContactMethod: z.enum(["phone", "text", "email"]).nullish(),
  preferredLanguage: z.string().trim().max(64).nullish(),
  profilePhoto: z
    .string()
    .max(PHOTO_MAX_LEN, "Photo is too large — please choose a smaller image.")
    .nullish(),
});
type ContactInput = z.infer<typeof contactInputSchema>;

/** Trim a string; treat empty/whitespace as null (clear). Preserve undefined (unchanged). */
function cleanStr(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Validate + normalize contact inputs into DB-ready fields: format US phones,
 * upper-case the state code, blank strings become null, and only keys that were
 * actually provided are returned (so updates never overwrite untouched columns).
 */
function processContactFields(input: ContactInput): TeamMemberContactFields {
  const out: TeamMemberContactFields = {};

  if (input.streetAddress !== undefined) out.streetAddress = cleanStr(input.streetAddress) ?? null;
  if (input.city !== undefined) out.city = cleanStr(input.city) ?? null;
  if (input.state !== undefined) {
    const s = cleanStr(input.state);
    out.state = s ? s.toUpperCase() : null;
  }
  if (input.zipCode !== undefined) out.zipCode = cleanStr(input.zipCode) ?? null;
  if (input.emergencyContactName !== undefined) out.emergencyContactName = cleanStr(input.emergencyContactName) ?? null;
  if (input.emergencyContactRelationship !== undefined) out.emergencyContactRelationship = cleanStr(input.emergencyContactRelationship) ?? null;
  if (input.preferredContactMethod !== undefined) out.preferredContactMethod = input.preferredContactMethod ?? null;
  if (input.preferredLanguage !== undefined) out.preferredLanguage = cleanStr(input.preferredLanguage) ?? null;

  if (input.profilePhoto !== undefined) {
    const p = input.profilePhoto;
    if (p === null || p.trim() === "") {
      out.profilePhoto = null;
    } else if (/^data:image\/(png|jpe?g|webp);base64,/.test(p)) {
      out.profilePhoto = p;
    } else {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Profile photo must be an image file." });
    }
  }

  if (input.mobilePhone !== undefined) {
    const raw = cleanStr(input.mobilePhone);
    if (raw === null) {
      out.mobilePhone = null;
    } else {
      const formatted = formatUsPhone(raw);
      if (!formatted) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid 10-digit US mobile phone number." });
      out.mobilePhone = formatted;
    }
  }
  if (input.emergencyContactPhone !== undefined) {
    const raw = cleanStr(input.emergencyContactPhone);
    if (raw === null) {
      out.emergencyContactPhone = null;
    } else {
      const formatted = formatUsPhone(raw);
      if (!formatted) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid 10-digit emergency contact phone number." });
      out.emergencyContactPhone = formatted;
    }
  }

  return out;
}

/** Safe, client-facing projection of a team member (no passwordHash / tokens). */
function publicProfile(m: NonNullable<Awaited<ReturnType<typeof db.getTeamMemberById>>>) {
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    firstName: m.firstName,
    lastName: m.lastName,
    role: m.role,
    status: m.status,
    mobilePhone: m.mobilePhone,
    streetAddress: m.streetAddress,
    city: m.city,
    state: m.state,
    zipCode: m.zipCode,
    emergencyContactName: m.emergencyContactName,
    emergencyContactRelationship: m.emergencyContactRelationship,
    emergencyContactPhone: m.emergencyContactPhone,
    preferredContactMethod: m.preferredContactMethod,
    preferredLanguage: m.preferredLanguage,
    profilePhoto: m.profilePhoto,
  };
}

export const teamAuthRouter = router({
  /**
   * Owner invites a new team member by email.
   * Protected — only logged-in owner/admin can invite.
   */
  invite: adminProcedure
    .input(contactInputSchema.extend({
      // Required on create (validation spec): first/last name, mobile phone, work email.
      firstName: z.string().trim().min(1, "First name is required").max(120),
      lastName: z.string().trim().min(1, "Last name is required").max(120),
      email: z.string().trim().email("Enter a valid work email address."),
      mobilePhone: z.string().trim().min(1, "Mobile phone is required"),
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

      const firstName = input.firstName.trim();
      const lastName = input.lastName.trim();
      // `name` stays the canonical display name used by assignments elsewhere.
      const name = `${firstName} ${lastName}`.trim();
      const contact = processContactFields(input); // validates + formats mobilePhone

      await db.createTeamMember({
        email: input.email,
        name,
        role: input.role,
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        invitedBy: ctx.user?.name ?? ctx.user?.email ?? "Owner",
        firstName,
        lastName,
        ...contact,
      });

      const inviteUrl = `${input.origin}/accept-invite?token=${token}`;

      // Send invite email directly to the new team member
      const emailSent = await sendTeamInviteEmail(
        input.email,
        name,
        inviteUrl,
        ctx.user?.name ?? ctx.user?.email ?? "Owner"
      ).catch(() => false);

      // Also notify owner (as backup)
      await notifyOwner({
        title: `Team Invite Sent: ${name} (${input.email})`,
        content: `You invited ${name} (${input.email}) as ${input.role}.${emailSent ? " An invite email was sent directly to them." : " Note: Email delivery failed — send them this link manually:"}\n\n${inviteUrl}\n\nExpires in 7 days.`,
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

      // Auto-login after accepting invite (standard 8h session — no remember prompt here).
      const { token, ttlMs } = await createTeamSession(member.id, member.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ttlMs });
      logAuthEventFromReq(ctx.req, { event: "login", outcome: "success", userId: member.id, reason: "accept_invite" });

      return { success: true, name: member.name, role: member.role };
    }),

  /**
   * Team member login with email + password.
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
      // "Remember this device": unchecked (default) → 8h session; checked → 30d.
      rememberDevice: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberByEmail(input.email);
      if (!member || !member.passwordHash) {
        logAuthEventFromReq(ctx.req, { event: "login", outcome: "failure", reason: "unknown_or_unset", email: input.email });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      if (member.status === "invited") {
        logAuthEventFromReq(ctx.req, { event: "login", outcome: "failure", userId: member.id, reason: "not_yet_activated" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please accept your invite first by clicking the link in your invitation email." });
      }
      if (member.status === "suspended") {
        logAuthEventFromReq(ctx.req, { event: "login", outcome: "failure", userId: member.id, reason: "suspended" });
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been suspended. Contact the owner." });
      }

      const valid = await bcrypt.compare(input.password, member.passwordHash);
      if (!valid) {
        logAuthEventFromReq(ctx.req, { event: "login", outcome: "failure", userId: member.id, reason: "bad_password" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      await db.updateTeamMemberLastSignedIn(member.id);

      const { token, ttlMs } = await createTeamSession(member.id, member.name, input.rememberDevice);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ttlMs });

      logAuthEventFromReq(ctx.req, {
        event: "login",
        outcome: "success",
        userId: member.id,
        reason: input.rememberDevice ? "remember_device" : "standard",
      });

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

      // Auto-login after reset (standard 8h session).
      const { token, ttlMs } = await createTeamSession(member.id, member.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ttlMs });
      logAuthEventFromReq(ctx.req, { event: "login", outcome: "success", userId: member.id, reason: "password_reset" });

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
      firstName: m.firstName,
      lastName: m.lastName,
      mobilePhone: m.mobilePhone,
      role: m.role,
      status: m.status,
      invitedBy: m.invitedBy,
      lastSignedIn: m.lastSignedIn,
      createdAt: m.createdAt,
    }));
  }),

  /**
   * Full profile of one team member (owner/admin only) — used to populate the
   * dashboard edit form. Excludes passwordHash / tokens via publicProfile().
   */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const member = await db.getTeamMemberById(input.id);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      }
      return publicProfile(member);
    }),

  /**
   * Admin edit of a team member's identity + contact details.
   * Does NOT touch passwordHash / tokens / status (status has its own mutation),
   * so existing login access and assignments are preserved.
   */
  update: adminProcedure
    .input(contactInputSchema.extend({
      id: z.number(),
      firstName: z.string().trim().max(120).optional(),
      lastName: z.string().trim().max(120).optional(),
      email: z.string().trim().email("Enter a valid work email address.").optional(),
      role: z.enum(["admin", "member", "viewer"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const member = await db.getTeamMemberById(input.id);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      }

      // If the work email is changing, guard the unique constraint up-front.
      if (input.email && input.email.toLowerCase() !== member.email.toLowerCase()) {
        const clash = await db.getTeamMemberByEmail(input.email);
        if (clash && clash.id !== member.id) {
          throw new TRPCError({ code: "CONFLICT", message: "Another team member already uses this email." });
        }
      }

      const patch: Parameters<typeof db.updateTeamMember>[1] = { ...processContactFields(input) };
      if (input.email !== undefined) patch.email = input.email;
      if (input.role !== undefined) patch.role = input.role;

      // Recompose the display `name` whenever first/last changes, keeping the
      // untouched half from the existing record.
      if (input.firstName !== undefined || input.lastName !== undefined) {
        const first = (input.firstName ?? member.firstName ?? "").trim();
        const last = (input.lastName ?? member.lastName ?? "").trim();
        patch.firstName = first || null;
        patch.lastName = last || null;
        const composed = `${first} ${last}`.trim();
        if (composed) patch.name = composed;
      }

      await db.updateTeamMember(input.id, patch);
      return { success: true };
    }),

  /**
   * The logged-in technician's own profile (field app "My Profile" screen).
   * Returns null when the session isn't a team member (e.g. OAuth owner).
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const memberId = currentTeamMemberId(ctx);
    if (memberId == null) return null;
    const member = await db.getTeamMemberById(memberId);
    return member ? publicProfile(member) : null;
  }),

  /**
   * Self-service profile update from the field app. Whitelisted to contact
   * fields only — a technician CANNOT change their name, work email, role,
   * permissions, status, or work assignments through this endpoint.
   */
  updateMyProfile: protectedProcedure
    .input(contactInputSchema)
    .mutation(async ({ ctx, input }) => {
      const memberId = currentTeamMemberId(ctx);
      if (memberId == null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your login isn't linked to a technician profile." });
      }
      const updated = await db.updateTeamMember(memberId, processContactFields(input));
      return updated ? publicProfile(updated) : null;
    }),

  /**
   * Suspend or reactivate a team member (owner only).
   */
  updateStatus: adminProcedure
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
  remove: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTeamMember(input.id);
      return { success: true };
    }),

  /**
   * Resend an invite link to a pending team member.
   */
  resendInvite: adminProcedure
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
