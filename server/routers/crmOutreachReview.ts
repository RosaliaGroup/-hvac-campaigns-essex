/** Authenticated review-only CRM outreach queue. Never sends or schedules email. */
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { checkOutreachReviewCandidate } from "../services/crmOutreachReviewQueue";
import { queueReviewedCandidate, listReviewDrafts, decideReviewDraft, crmOutreachReviewDrafts } from "../services/crmOutreachReviewStore";
import { getDb } from "../db";
import { crmCommunications, smsContacts } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { isOutreachSuppressed } from "../services/outreachSuppression";

const candidate = z.object({
  email: z.string().email().max(320),
  company: z.string().trim().min(1).max(255),
  decisionMaker: z.string().trim().min(1).max(255),
  sourceUrl: z.string().url().startsWith("https://"),
  draftSubject: z.string().trim().min(1).max(255),
  draftBody: z.string().trim().min(1).max(10000),
  verifiedAt: z.coerce.date(),
});

export const crmOutreachReviewRouter = router({
  list: adminProcedure.query(() => listReviewDrafts()),
  decide: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
  })).mutation(async ({ input }) => {
    // Approval is not a send authorization. Recheck suppression because a
    // recipient may have opted out since the draft was first queued.
    if (input.decision === "approved") {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [draft] = await db.select({ email: crmOutreachReviewDrafts.email })
        .from(crmOutreachReviewDrafts)
        .where(eq(crmOutreachReviewDrafts.id, input.id)).limit(1);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (await isOutreachSuppressed(db, draft.email))
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recipient is suppressed." });
      const optedOut = await db.select({ id: smsContacts.id }).from(smsContacts)
        .where(and(sql`lower(trim(${smsContacts.email})) = ${draft.email}`, eq(smsContacts.optedOut, true)))
        .limit(1);
      if (optedOut.length > 0)
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recipient opted out." });
    }
    return decideReviewDraft(input.id, input.decision);
  }),
  enqueue: adminProcedure.input(candidate).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const check = await checkOutreachReviewCandidate(
      input,
      async email => {
        const matches = await db.select({ id: crmCommunications.id })
          .from(crmCommunications)
          .where(and(eq(crmCommunications.toAddress, email), eq(crmCommunications.direction, "outbound")))
          .limit(1);
        return matches.length > 0;
      },
      // Independent SMS contact opt-outs are an additional veto for review intake.
      // Central email suppression is checked separately by the eligibility policy.
      // A missing SMS contact does not constitute consent to send anything.
      async email => {
        const optedOut = await db.select({ id: smsContacts.id })
          .from(smsContacts)
          .where(and(
            sql`lower(trim(${smsContacts.email})) = ${email}`,
            eq(smsContacts.optedOut, true),
          )).limit(1);
        return optedOut.length > 0;
      },
    );
    if (!check.eligible) return check;
    return queueReviewedCandidate(input);
  }),
});
