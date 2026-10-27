import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { outreachTaskPage, opportunityTaskPage } from "../services/crmTaskCenter";

const filters = z.object({
  status: z.enum(["all", "open", "done", "cancelled"]).default("open"),
  action: z.enum(["all", "call", "email", "text"]).default("all"),
  search: z.string().max(120).default(""),
  offset: z.number().int().min(0).default(0),
  due: z.enum(["all","overdue","today","upcoming"]).default("all"),
  limit: z.number().int().min(1).max(100).default(50),
});

export const crmTasksRouter = router({
  outreach: protectedProcedure.input(filters).query(({ input }) => outreachTaskPage(input)),
  opportunities: protectedProcedure.input(filters).query(({ input }) => opportunityTaskPage(input)),
});
