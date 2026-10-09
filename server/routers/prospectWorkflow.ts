import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { prospectWorkflowQueue as queue } from "../../drizzle/schema";
import {
  configureProspecting,
  prospectWorkflowStatus,
  runProspectWorkflow,
} from "../services/prospectWorkflow";
import { startJob, getJob } from "../services/asyncLaneJob";
async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  return db;
}
export const prospectWorkflowRouter = router({
  status: protectedProcedure.query(async () =>
    prospectWorkflowStatus(await dbOrThrow())
  ),
  configure: adminProcedure
    .input(
      z.object({ enabled: z.boolean(), ownerId: z.number().int().positive() })
    )
    .mutation(async ({ input }) => {
      await configureProspecting(
        await dbOrThrow(),
        input.enabled,
        input.ownerId
      );
      return { success: true };
    }),
  runNow: adminProcedure.mutation(() =>
    startJob({
      key: "crm-prospect-workflow",
      kind: "crm-prospect-workflow",
      fn: () => runProspectWorkflow(),
    })
  ),
  job: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => getJob(input.id)),
  followUp: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        outcome: z.enum(["nurture", "replied", "complete", "opted_out"]),
        note: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      // Human follow-up must be completed before automated nurture is allowed.
      await db
        .update(queue)
        .set({
          state: input.outcome,
          followUpDoneAt: new Date(),
          nextTouchAt:
            input.outcome === "nurture"
              ? new Date(Date.now() + 7 * 86400000)
              : null,
          lastError: input.note,
        })
        .where(and(eq(queue.id, input.id), eq(queue.state, "waiting")));
      return { success: true };
    }),
  smsConsent: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        phone: z.string().regex(/^\+1\d{10}$/),
        evidence: z.string().min(20).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      await (
        await dbOrThrow()
      )
        .update(queue)
        .set({
          phone: input.phone,
          smsConsent: true,
          consentEvidence: input.evidence,
          smsState: "ready",
          nextTouchAt: new Date(),
        })
        .where(and(eq(queue.id, input.id), eq(queue.state, "waiting")));
      return { success: true };
    }),
});
