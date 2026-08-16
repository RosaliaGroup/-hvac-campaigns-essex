/**
 * In-app alerts — the bell.
 *
 * `notify()` is the single write path; everything that wants to raise an alert calls it
 * rather than inserting directly, so recipient de-duplication and self-notification
 * suppression live in one place.
 *
 * Design note: one row per recipient. "Read" is per-person, so a shared row could not
 * record that one member has seen an alert and another hasn't.
 */
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notifications, pushSubscriptions } from "../../drizzle/schema";
import { sendPushToMembers, vapidPublicKey } from "../services/webPush";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type NotifyInput = {
  /** Recipients. Duplicates and nulls are dropped; `exclude` is removed after that. */
  teamMemberIds: Array<number | null | undefined>;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  link?: string | null;
  /** Usually the actor: people don't need alerting about their own actions. */
  exclude?: number | null;
};

/**
 * Raise an alert for each recipient. Never throws — an alert failing must not roll back
 * the action that triggered it, so callers can fire this without a try/catch.
 */
export async function notify(db: Db, input: NotifyInput): Promise<number> {
  try {
    const seen = new Set<number>();
    for (const id of input.teamMemberIds) {
      if (id == null) continue;
      if (input.exclude != null && id === input.exclude) continue;
      seen.add(id);
    }
    if (seen.size === 0) return 0;

    await db.insert(notifications).values(
      Array.from(seen).map(teamMemberId => ({
        teamMemberId,
        type: input.type,
        title: input.title.slice(0, 255),
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        link: input.link ?? null,
      })),
    );
    // Same alert, second channel: in-app row above, device push here. Fire-and-forget —
    // sendPushToMembers never throws and is a no-op when VAPID keys aren't configured.
    void sendPushToMembers(db, Array.from(seen), {
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      tag: input.entityType && input.entityId ? `${input.entityType}:${input.entityId}` : null,
    });

    return seen.size;
  } catch (err) {
    console.error("[notify] failed to raise alert", err);
    return 0;
  }
}

/**
 * The caller's teamMembers.id.
 *
 * Sessions carry it encoded in openId as "team:123" — there is no teamMemberId field on
 * the session. This mirrors currentTeamMemberId in commercialOpportunities.ts; the two
 * must agree, or alerts get filed against a different id than the one that reads them.
 */
function meOrThrow(ctx: { user?: { openId?: string | null } | null }): number {
  const openId = ctx.user?.openId;
  if (typeof openId === "string" && openId.startsWith("team:")) {
    const id = Number(openId.slice(5));
    if (Number.isFinite(id)) return id;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "No team member on this session" });
}

export const notificationsRouter = router({
  /** Bell list. Unread first is deliberate — the point of the bell is what's outstanding. */
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20), unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const me = meOrThrow(ctx as never);
      const limit = input?.limit ?? 20;
      const where = input?.unreadOnly
        ? and(eq(notifications.teamMemberId, me), isNull(notifications.readAt))
        : eq(notifications.teamMemberId, me);
      return db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return 0;
    const me = meOrThrow(ctx as never);
    const rows = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(eq(notifications.teamMemberId, me), isNull(notifications.readAt)));
    return Number(rows[0]?.n ?? 0);
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const me = meOrThrow(ctx as never);
      // Scoped to the caller so one member can't mark another's alerts read.
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, input.id), eq(notifications.teamMemberId, me)));
      return { ok: true };
    }),

  /** The browser needs this to subscribe. Null means push isn't configured on the server. */
  vapidKey: protectedProcedure.query(() => ({ key: vapidPublicKey() })),

  /** Register this device for push. Idempotent — re-subscribing updates the same endpoint. */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(512),
        p256dh: z.string().max(255),
        auth: z.string().max(255),
        userAgent: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const me = meOrThrow(ctx as never);

      // The endpoint is unique, so a device that re-subscribes (or changes hands) updates
      // in place rather than creating a duplicate that would double every alert.
      const existing = (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint)).limit(1))[0];
      if (existing) {
        await db
          .update(pushSubscriptions)
          .set({ teamMemberId: me, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent ?? null })
          .where(eq(pushSubscriptions.id, existing.id));
        return { ok: true, updated: true };
      }

      await db.insert(pushSubscriptions).values({
        teamMemberId: me,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      });
      return { ok: true, updated: false };
    }),

  /** Turn alerts off for this device. */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().max(512) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint));
      return { ok: true };
    }),

  /** How many devices this person currently has alerts enabled on. */
  deviceCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return 0;
    const me = meOrThrow(ctx as never);
    const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.teamMemberId, me));
    return rows.length;
  }),

  /** Send a test push to this person's devices, so they can confirm it works. */
  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const me = meOrThrow(ctx as never);
    const sent = await sendPushToMembers(db, [me], {
      title: "Alerts are working",
      body: "This is a test notification from Mechanical Enterprise.",
      link: "/settings/alerts",
    });
    return { sent };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const me = meOrThrow(ctx as never);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.teamMemberId, me), isNull(notifications.readAt)));
    return { ok: true };
  }),
});
