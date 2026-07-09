/**
 * Opportunities router — powers the Opportunity Center dashboard.
 * Read-only over the QuickBooks-sourced pipeline plus lightweight task actions.
 * QuickBooks remains the source of truth; nothing here pushes back to QBO.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  opportunities,
  opportunityEvents,
  opportunityTasks,
  quickbooksSalesDocuments,
  customers,
} from "../../drizzle/schema";
import { computeDaysPending } from "../integrations/accounting/estimates";

const STAGE_ENUM = ["new", "proposal_sent", "pending", "won", "lost"] as const;

export const opportunitiesRouter = router({
  /**
   * Dashboard list: one row per opportunity joined to its customer and primary
   * QuickBooks sales document. Returns exactly the columns the Opportunity
   * Center renders, including a server-computed `daysPending`.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          stage: z.enum(STAGE_ENUM).optional(),
          search: z.string().max(255).optional(),
          limit: z.number().int().min(1).max(200).default(100),
          offset: z.number().int().min(0).default(0),
        })
        .default({ limit: 100, offset: 0 }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.stage) conditions.push(eq(opportunities.stage, input.stage));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(like(customers.displayName, q), like(quickbooksSalesDocuments.docNumber, q)));
      }
      const where = conditions.length ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: opportunities.id,
          stage: opportunities.stage,
          amount: opportunities.amount,
          nextAction: opportunities.nextAction,
          nextActionDueAt: opportunities.nextActionDueAt,
          customerId: opportunities.customerId,
          customerName: customers.displayName,
          customerType: customers.type,
          docId: quickbooksSalesDocuments.id,
          docType: quickbooksSalesDocuments.docType,
          docNumber: quickbooksSalesDocuments.docNumber,
          docStatus: quickbooksSalesDocuments.status,
          docAmount: quickbooksSalesDocuments.totalAmount,
          txnDate: quickbooksSalesDocuments.txnDate,
          sentAt: quickbooksSalesDocuments.sentAt,
          documentLink: quickbooksSalesDocuments.documentLink,
          updatedAt: opportunities.updatedAt,
        })
        .from(opportunities)
        .leftJoin(customers, eq(opportunities.customerId, customers.id))
        .leftJoin(quickbooksSalesDocuments, eq(quickbooksSalesDocuments.opportunityId, opportunities.id))
        .where(where)
        .orderBy(desc(opportunities.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      const now = new Date();
      const items = rows.map(r => ({
        ...r,
        daysPending: computeDaysPending({ sentAt: r.sentAt, txnDate: r.txnDate }, now),
      }));

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(opportunities)
        .leftJoin(customers, eq(opportunities.customerId, customers.id))
        .leftJoin(quickbooksSalesDocuments, eq(quickbooksSalesDocuments.opportunityId, opportunities.id))
        .where(where);

      return { items, total: Number(count) };
    }),

  /** Pipeline counts by stage for the header chips. */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStage: {} as Record<string, number> };
    const rows = await db
      .select({ stage: opportunities.stage, count: sql<number>`count(*)` })
      .from(opportunities)
      .groupBy(opportunities.stage);
    const byStage: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStage[r.stage] = Number(r.count);
      total += Number(r.count);
    }
    return { total, byStage };
  }),

  /** Detail: the opportunity, its sales documents, follow-up tasks, and events. */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      const [customer, docs, tasks, events] = await Promise.all([
        db.select().from(customers).where(eq(customers.id, opp.customerId)).limit(1),
        db.select().from(quickbooksSalesDocuments).where(eq(quickbooksSalesDocuments.opportunityId, input.id)),
        db.select().from(opportunityTasks).where(eq(opportunityTasks.opportunityId, input.id)).orderBy(opportunityTasks.dueAt),
        db.select().from(opportunityEvents).where(eq(opportunityEvents.opportunityId, input.id)).orderBy(desc(opportunityEvents.createdAt)),
      ]);
      return { opportunity: opp, customer: customer[0] ?? null, salesDocuments: docs, tasks, events };
    }),

  /** Mark a follow-up task done. */
  completeTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = new Date();
      await db
        .update(opportunityTasks)
        .set({ status: "done", completedAt: now })
        .where(eq(opportunityTasks.id, input.taskId));
      return { ok: true };
    }),

  /** Snooze a follow-up task by N days (default 1). */
  snoozeTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive(), days: z.number().int().min(1).max(30).default(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const task = (await db.select().from(opportunityTasks).where(eq(opportunityTasks.id, input.taskId)).limit(1))[0];
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      const base = task.dueAt ? new Date(task.dueAt) : new Date();
      const dueAt = new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000);
      await db.update(opportunityTasks).set({ dueAt, status: "open" }).where(eq(opportunityTasks.id, input.taskId));
      return { ok: true, dueAt };
    }),
});
