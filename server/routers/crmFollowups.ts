import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getJob, startJob } from "../services/asyncLaneJob";
import {
  assign30DayTask, assignAll30DayTasks, list30DayTasks, complete30DayTask,
} from "../services/crm30DayTasks";
import { sync30DayFromGmail } from "../services/crm30DaySync";

export const crmFollowupsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["open", "done", "cancelled"]).optional(),
      contactId: z.number().int().positive().optional(),
    }).default({}))
    .query(({ input }) => list30DayTasks(input)),
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
    .mutation(({ ctx }) => assignAll30DayTasks(
      ctx.user.id, ctx.user.name || ctx.user.email || "CRM User",
    )),
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
