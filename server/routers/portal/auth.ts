/**
 * Customer Portal — authentication procedures.
 *
 * Accounts are tied to an existing `customers` row (matched by email). Two ways
 * in: email + password, or a passwordless magic link. All logged-out endpoints
 * are `publicProcedure`; `me` returns null (never throws) so the client can
 * probe auth state.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { publicProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { sendEmail } from "../../services/emailService";
import { portalAccounts, customers } from "../../../drizzle/schema";
import {
  createPortalSession,
  setPortalCookie,
  clearPortalCookie,
  resolvePortalPrincipal,
} from "./session";

const MAGIC_LINK_TTL_MS = 60 * 60 * 1000; // 1 hour

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Find a customer by (case-insensitive) email. */
async function findCustomerByEmail(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email}`)
    .limit(1);
  return customer ?? null;
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The portal is temporarily unavailable. Please try again shortly." });
  }
  return db;
}

/** Public projection of the signed-in customer for the portal chrome. */
function meProjection(principal: NonNullable<Awaited<ReturnType<typeof resolvePortalPrincipal>>>) {
  const { account, customer } = principal;
  return {
    accountId: account.id,
    customerId: customer.id,
    name: account.name ?? customer.displayName,
    email: account.email,
    displayName: customer.displayName,
    companyName: customer.companyName,
    type: customer.type,
  };
}

export const portalAuthRouter = router({
  /** Current portal session, or null when signed out. Never throws. */
  me: publicProcedure.query(async ({ ctx }) => {
    const principal = await resolvePortalPrincipal(ctx.req);
    return principal ? meProjection(principal) : null;
  }),

  /**
   * Claim a portal account for an existing customer using email + password.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const email = normalizeEmail(input.email);

      const existing = await db
        .select()
        .from(portalAccounts)
        .where(eq(portalAccounts.email, email))
        .limit(1);
      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Try signing in instead." });
      }

      const customer = await findCustomerByEmail(db, email);
      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "We couldn't find a customer record for that email. Please contact us so we can set up your portal access.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const name = input.name ?? customer.displayName;
      await db.insert(portalAccounts).values({
        customerId: customer.id,
        email,
        passwordHash,
        name,
        status: "active",
        lastLoginAt: new Date(),
      });

      const [account] = await db
        .select()
        .from(portalAccounts)
        .where(eq(portalAccounts.email, email))
        .limit(1);

      const token = await createPortalSession(account.id, name);
      setPortalCookie(ctx.req, ctx.res, token);
      return { success: true, name };
    }),

  /** Email + password sign-in. */
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const email = normalizeEmail(input.email);

      const [account] = await db
        .select()
        .from(portalAccounts)
        .where(eq(portalAccounts.email, email))
        .limit(1);

      const genericError = new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      if (!account || !account.passwordHash) throw genericError;
      if (account.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account has been suspended. Please contact us." });
      }

      const valid = await bcrypt.compare(input.password, account.passwordHash);
      if (!valid) throw genericError;

      await db.update(portalAccounts).set({ lastLoginAt: new Date() }).where(eq(portalAccounts.id, account.id));

      const name = account.name ?? "";
      const token = await createPortalSession(account.id, name);
      setPortalCookie(ctx.req, ctx.res, token);
      return { success: true, name };
    }),

  /**
   * Request a passwordless magic link. If the email matches a customer with no
   * portal account yet, one is auto-provisioned (passwordless). Always returns
   * success to avoid leaking which emails are customers.
   */
  requestMagicLink: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const email = normalizeEmail(input.email);

      let [account] = await db
        .select()
        .from(portalAccounts)
        .where(eq(portalAccounts.email, email))
        .limit(1);

      if (!account) {
        const customer = await findCustomerByEmail(db, email);
        if (customer) {
          await db.insert(portalAccounts).values({
            customerId: customer.id,
            email,
            name: customer.displayName,
            status: "active",
          });
          [account] = await db
            .select()
            .from(portalAccounts)
            .where(eq(portalAccounts.email, email))
            .limit(1);
        }
      }

      if (account && account.status !== "suspended") {
        const token = generateToken();
        const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
        await db
          .update(portalAccounts)
          .set({ loginToken: token, loginTokenExpiresAt: expiresAt })
          .where(eq(portalAccounts.id, account.id));

        const link = `${input.origin}/portal/verify?token=${token}`;
        await sendEmail({
          to: email,
          subject: "Your sign-in link — Mechanical Enterprise Customer Portal",
          html: magicLinkEmailHtml(account.name ?? "there", link),
        }).catch(() => false);
      }

      // Always generic — no account enumeration.
      return { success: true };
    }),

  /** Consume a magic link token and start a session. */
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [account] = await db
        .select()
        .from(portalAccounts)
        .where(and(eq(portalAccounts.loginToken, input.token)))
        .limit(1);

      if (!account || !account.loginTokenExpiresAt || new Date() > account.loginTokenExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This sign-in link is invalid or has expired. Please request a new one." });
      }
      if (account.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account has been suspended. Please contact us." });
      }

      await db
        .update(portalAccounts)
        .set({ loginToken: null, loginTokenExpiresAt: null, lastLoginAt: new Date() })
        .where(eq(portalAccounts.id, account.id));

      const name = account.name ?? "";
      const token = await createPortalSession(account.id, name);
      setPortalCookie(ctx.req, ctx.res, token);
      return { success: true, name };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearPortalCookie(ctx.res);
    return { success: true };
  }),
});

function magicLinkEmailHtml(name: string, link: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b">
    <h2 style="color:#1e3a5f;margin:0 0 16px">Sign in to your portal</h2>
    <p>Hi ${name},</p>
    <p>Click the button below to securely sign in to your Mechanical Enterprise customer portal. This link expires in 1 hour.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#ff6b35;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block">Sign in</a>
    </p>
    <p style="font-size:13px;color:#64748b">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}
