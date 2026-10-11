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

type Candidate = z.infer<typeof candidate>;

/** Structured operational audit: never log recipient PII, drafts or tokens. */
function reviewAudit(event: string, details: Record<string, string | number | boolean>) {
  console.info("[CRM Outreach Review]", JSON.stringify({ event, ...details }));
}


/** Shared fail-closed intake, including suppression, opt-outs and sent history. */
async function intakeCandidate(input: Candidate) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const check = await checkOutreachReviewCandidate(
    input,
    async email => {
      const matches = await db.select({ id: crmCommunications.id })
        .from(crmCommunications)
        .where(and(
          sql`lower(trim(${crmCommunications.toAddress})) = ${email}`,
          eq(crmCommunications.direction, "outbound"),
        )).limit(1);
      return matches.length > 0;
    },
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
  if (!check.eligible) {
    reviewAudit("intake_blocked", { reason: check.reason });
    return check;
  }
  const row = await queueReviewedCandidate(input);
  reviewAudit("draft_queued", { draftId: row.id, status: row.status });
  return row;
}

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
      if (await isOutreachSuppressed(db, draft.email)) {
        reviewAudit("approval_blocked", { draftId: input.id, reason: "suppressed" });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recipient is suppressed." });
      }
      const optedOut = await db.select({ id: smsContacts.id }).from(smsContacts)
        .where(and(sql`lower(trim(${smsContacts.email})) = ${draft.email}`, eq(smsContacts.optedOut, true)))
        .limit(1);
      if (optedOut.length > 0) {
        reviewAudit("approval_blocked", { draftId: input.id, reason: "opted_out" });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recipient opted out." });
      }
    }
    const row = await decideReviewDraft(input.id, input.decision);
    reviewAudit("decision_saved", { draftId: row.id, status: row.status });
    return row;
  }),
  enqueue: adminProcedure.input(candidate).mutation(({ input }) => intakeCandidate(input)),
  // Bulk preparation is review-only. No sending or scheduling is exposed.
  enqueueBatch: adminProcedure.input(z.array(candidate).min(1).max(10))
    .mutation(async ({ input }) => {
      const seen = new Set<string>();
      const results = [];
      for (const item of input) {
        const email = item.email.trim().toLowerCase();
        if (seen.has(email)) {
          reviewAudit("intake_blocked", { reason: "duplicate_in_batch" });
          results.push({ email, status: "duplicate_in_batch" });
          continue;
        }
        seen.add(email);
        try {
          const result = await intakeCandidate(item);
          results.push({
            email,
            status: "eligible" in result && result.eligible === false
              ? result.reason : "queued_for_review",
          });
        } catch {
          reviewAudit("intake_blocked", { reason: "verification_failed" });
          // Fail closed on any DB/verification failure; do not leak internal errors.
          results.push({ email, status: "verification_failed" });
        }
      }
      const queued = results.filter(row => row.status === "queued_for_review").length;
      reviewAudit("batch_completed", { submitted: input.length, queued, blocked: input.length - queued });
      return { results, queued };
    }),

});
