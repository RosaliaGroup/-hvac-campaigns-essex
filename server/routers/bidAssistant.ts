import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { opportunities, customers, opportunityComments, opportunityMembers, teamMembers } from "../../drizzle/schema";
import { callAnthropicWithFallback } from "../_core/anthropic";

/**
 * Ask-AI for commercial bids. Answers questions using ONLY this bid's own
 * context (fields, customer, team, comments). Internal tool — output is text
 * for the person asking; nothing is sent to customers and nothing is stored.
 */
export const bidAssistantRouter = router({
  ask: protectedProcedure
    .input(z.object({
      opportunityId: z.number().int().positive(),
      question: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI is not configured (missing API key)." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1))[0];
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Bid not found." });
      const customer = opp.customerId
        ? (await db.select().from(customers).where(eq(customers.id, opp.customerId)).limit(1))[0]
        : null;
      const memberRows = await db
        .select({ name: teamMembers.name })
        .from(opportunityMembers)
        .innerJoin(teamMembers, eq(teamMembers.id, opportunityMembers.teamMemberId))
        .where(eq(opportunityMembers.opportunityId, input.opportunityId));
      const commentRows = await db
        .select({ body: opportunityComments.body, authorId: opportunityComments.authorId, createdAt: opportunityComments.createdAt, deletedAt: opportunityComments.deletedAt })
        .from(opportunityComments)
        .where(eq(opportunityComments.opportunityId, input.opportunityId))
        .orderBy(desc(opportunityComments.createdAt))
        .limit(30);
      const authorIds = Array.from(new Set(commentRows.map(c => c.authorId).filter((x): x is number => x != null)));
      const authors = authorIds.length
        ? await db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(inArray(teamMembers.id, authorIds))
        : [];
      const authorName = (id: number | null) => authors.find(a => a.id === id)?.name ?? "someone";

      const lines: string[] = [];
      lines.push("BID: " + (opp.title ?? "(untitled)") + (opp.opportunityNumber ? " (#" + opp.opportunityNumber + ")" : ""));
      lines.push("STAGE: " + (opp.stage ?? "unknown") + " | AMOUNT: " + (opp.amount ?? "not set") + " | BID DUE: " + (opp.bidDueAt ? new Date(opp.bidDueAt).toDateString() : "not set"));
      if (customer) lines.push("CUSTOMER: " + (customer.displayName ?? "") + " | " + (customer.email ?? "no email") + " | " + (customer.phone ?? "no phone"));
      if (memberRows.length) lines.push("TEAM ON THIS BID: " + memberRows.map(m => m.name).join(", "));
      if (opp.description) lines.push("DESCRIPTION / SCOPE:\n" + String(opp.description).slice(0, 4000));
      const visible = commentRows.filter(c => !c.deletedAt).reverse();
      if (visible.length) {
        lines.push("COMMENTS (oldest to newest):");
        for (const c of visible) lines.push("- " + authorName(c.authorId) + " (" + new Date(c.createdAt as unknown as string).toLocaleDateString() + "): " + String(c.body).slice(0, 500));
      }

      const system =
        "You are the internal bid assistant for Mechanical Enterprise LLC, an HVAC contractor in Newark, NJ. " +
        "Answer the team member's question using ONLY the bid context below. Be concise and practical. " +
        "If asked to draft an email, write a ready-to-send professional draft. " +
        "If information is missing from the context, say so plainly rather than inventing it.\n\n" +
        "=== BID CONTEXT ===\n" + lines.join("\n");

      const result = await callAnthropicWithFallback({
        apiKey,
        mode: "quick",
        system,
        messages: [{ role: "user", content: input.question }],
        maxTokens: 1200,
      });
      if (!result.ok || !result.text) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "AI request failed." });
      }
      return { answer: result.text };
    }),
});
