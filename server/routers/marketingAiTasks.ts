import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";

/** Admin-submitted marketing tasks are tracked as GitHub issues.
 * Submission creates a work item; it does NOT autonomously execute the task.
 */
export const marketingAiTasksRouter = router({
  submit: adminProcedure
    .input(z.object({
      title: z.string().trim().min(5).max(120),
      instructions: z.string().trim().min(10).max(4000),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = process.env.SEO_GITHUB_TOKEN;
      if (!token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "GitHub task integration is not configured." });
      const response = await fetch("https://api.github.com/repos/RosaliaGroup/-hvac-campaigns-essex/issues", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "mechanical-enterprise-marketing-ai",
        },
        body: JSON.stringify({
          title: `[Marketing AI Task] ${input.title}`,
          body: `## Requested work\n\n${input.instructions}\n\n## Submitted from\nMechanical Enterprise CRM Marketing AI panel\n\n## Execution status\nQueued for review. Creating this issue does not automatically run an AI agent.\n\nRequested by user ID: ${ctx.user?.id ?? "unknown"}`,
        }),
      });
      if (!response.ok) {
        // Never echo GitHub response body; it may contain sensitive details.
        throw new TRPCError({ code: "BAD_GATEWAY", message: `Unable to create GitHub task (HTTP ${response.status}).` });
      }
      const issue = await response.json() as { html_url?: string; number?: number };
      return { url: issue.html_url ?? "", number: issue.number ?? 0 };
    }),
});
