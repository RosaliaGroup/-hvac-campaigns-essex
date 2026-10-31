import { and, eq, isNull, or, sql } from "drizzle-orm";
import { crm30DayTasks, cadenceDatabase } from "../services/crm30DayTasks";
import { users, teamMembers } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getJob, startJob } from "../services/asyncLaneJob";
import {
  assign30DayTask, assignAll30DayTasks, list30DayTasks, complete30DayTask,
} from "../services/crm30DayTasks";
import { sync30DayFromGmail } from "../services/crm30DaySync";
import { closeFollowTask, followProfilesFor } from "../services/crmContactEnrichment";
import { preflightFollowupTask } from "../services/crmFollowupDeliveryPreflight";
import { inspectFollowupDelivery } from "../services/crmFollowupDeliveryReconciliation";

async function verifiedSessionOwner(db: Awaited<ReturnType<typeof cadenceDatabase>>, id: number) {
  if (!Number.isSafeInteger(id) || id === 0) return null;
  if (id > 0) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    return user?.id ?? null;
  }
  const [member] = await db.select({ id: teamMembers.id }).from(teamMembers)
    .where(and(eq(teamMembers.id, -id), eq(teamMembers.status, "active"))).limit(1);
  return member ? id : null;
}

export const crmFollowupsRouter = router({
  assignmentStatus: adminProcedure.query(async ({ ctx }) => {
    const db = await cadenceDatabase();
    const verifiedOwnerId = await verifiedSessionOwner(db, ctx.user.id);
    const [counts] = await db.select({
      total: sql<number>`count(*)`,
      mine: sql<number>`sum(case when ${verifiedOwnerId} is not null and ${crm30DayTasks.assignedToUserId} = ${verifiedOwnerId} then 1 else 0 end)`,
      invalid: sql<number>`sum(case when ${crm30DayTasks.assignedToUserId} is null or (${crm30DayTasks.assignedToUserId} <= 0 and ${crm30DayTasks.assignedToUserId} <> ${verifiedOwnerId}) then 1 else 0 end)`,
    }).from(crm30DayTasks).where(eq(crm30DayTasks.status, "open"));
    return {
      total: Number(counts?.total ?? 0),
      mine: Number(counts?.mine ?? 0),
      unassigned: Number(counts?.invalid ?? 0),
      authenticatedOwnerValid: Boolean(verifiedOwnerId),
    };
  }),

  deliveryReconciliation: adminProcedure.input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => inspectFollowupDelivery(input.id)),
  deliveryPreflight: adminProcedure.input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => preflightFollowupTask(input.id)),
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["open", "done", "cancelled"]).optional(),
      contactId: z.number().int().positive().optional(),
    }).default({}))
    .query(async ({ input }) => {
      const tasks = await list30DayTasks(input);
      // "Follow on social" tasks carry the contact's verified profiles for one-click following.
      const profiles = await followProfilesFor(tasks.filter(t => t.touchNumber === 1).map(t => t.externalContactId))
        .catch(() => new Map());
      return tasks.map(t => ({ ...t, followProfiles: t.touchNumber === 1 ? profiles.get(t.externalContactId) ?? [] : undefined }));
    }),
  closeFollowTask: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => closeFollowTask(input.id)),
  complete: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      outcome: z.enum([
        "attempted_no_answer", "connected", "not_interested",
        "reviewed_no_send", "sent_verified",
      ]),
      note: z.string().trim().max(1000).optional(),
    }))
    .mutation(({ input }) => complete30DayTask(input.id, input.outcome, input.note)),
  assignToMe: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => assign30DayTask(
      input.id, ctx.user.id, ctx.user.name || ctx.user.email || "CRM User",
    )),
  assignAllToMe: adminProcedure
    .mutation(async ({ ctx }) => {
      const db = await cadenceDatabase();
      const id = ctx.user.id;
      const verifiedId = await verifiedSessionOwner(db, id);
      if (verifiedId === null) throw new TRPCError({code:"PRECONDITION_FAILED",message:"CRM login has no active verified user or team member record."});
      return assignAll30DayTasks(verifiedId,ctx.user.name || ctx.user.email || "CRM User");
    }),
  syncOutreach: protectedProcedure
    .input(z.object({ lookbackDays: z.union([z.literal(10), z.literal(35)]).default(35) }))
    .mutation(({ input }) => startJob({
      kind: "crm-30-day", key: "crm-30-day-sync",
      fn: () => sync30DayFromGmail(input.lookbackDays),
    })),
  syncJob: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      return job?.kind === "crm-30-day" ? job : null;
    }),
});
