import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getJob, startJob } from "../services/asyncLaneJob";
import { assignCrmFollowupTask, listCrmFollowupTasks, updateCrmFollowupTask } from "../services/crmFollowupTasks";
import { syncCrmFollowupsFromGmail } from "../services/crmFollowupGmail";

export const crmFollowupsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["open", "done", "cancelled"]).optional(),
      contactId: z.number().int().positive().optional(),
    }).default({}))
    .query(({ input }) => listCrmFollowupTasks(input)),
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["open", "done", "cancelled"]),
    }))
    .mutation(({ input }) => updateCrmFollowupTask(input.id, input.status)),
  assignToMe: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => assignCrmFollowupTask(
      input.id, ctx.user.id, ctx.user.name || ctx.user.email || "CRM User",
    )),
  syncOutreach: protectedProcedure
    .input(z.object({ lookbackDays: z.union([z.literal(10), z.literal(35)]).default(35) }))
    .mutation(({ input }) => startJob({
      kind: "crm-followup", key: "crm-followup-sync",
      fn: () => syncCrmFollowupsFromGmail(input.lookbackDays),
    })),
  syncJob: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      return job?.kind === "crm-followup" ? job : null;
    }),
});
