/**
 * Tiered estimates (Task 8A). CRM authors 1–3 Good/Better/Best options per
 * estimate; only the APPROVED option is snapshotted and pushed to QuickBooks as a
 * single QBO Estimate. The QBO push is best-effort (see estimatePush.ts) — a push
 * failure never blocks approval.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  estimates,
  estimateOptions,
  estimateLineItems,
  opportunities,
  opportunityEvents,
} from "../../drizzle/schema";
import {
  buildApprovedSnapshot,
  computeLineAmount,
  computeOptionTotals,
  makeEstimateNumber,
} from "../integrations/accounting/estimateMath";
import { pushApprovedEstimate } from "../integrations/accounting/estimatePush";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Load an estimate with its options and each option's line items (nested). */
async function loadFull(db: Db, estimateId: number) {
  const estimate = (await db.select().from(estimates).where(eq(estimates.id, estimateId)).limit(1))[0];
  if (!estimate) return null;
  const options = await db
    .select()
    .from(estimateOptions)
    .where(eq(estimateOptions.estimateId, estimateId))
    .orderBy(asc(estimateOptions.sortOrder));
  const optionIds = options.map(o => o.id);
  const lines = optionIds.length
    ? await db
        .select()
        .from(estimateLineItems)
        .where(inArray(estimateLineItems.optionId, optionIds))
        .orderBy(asc(estimateLineItems.sortOrder))
    : [];
  return {
    ...estimate,
    options: options.map(o => ({ ...o, lineItems: lines.filter(l => l.optionId === o.id) })),
  };
}

const lineItemInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullish(),
  itemType: z.enum(["labor", "part", "service", "equipment", "other"]).default("service"),
  quantity: z.number().nonnegative(),
  unitPrice: z.number(),
});

function insertId(res: unknown): number {
  return Number((res as [{ insertId: number }])[0]?.insertId ?? 0);
}

export const estimatesRouter = router({
  listByOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(estimates)
        .where(eq(estimates.opportunityId, input.opportunityId))
        .orderBy(asc(estimates.id));
      const full = [];
      for (const r of rows) {
        const f = await loadFull(db, r.id);
        if (f) full.push(f);
      }
      return full;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const full = await loadFull(db, input.id);
      if (!full) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      return full;
    }),

  create: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1))[0];
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      // Insert first to get the id, then stamp the id-derived estimate number.
      const inserted = await db.insert(estimates).values({ opportunityId: input.opportunityId, estimateNumber: "" });
      const id = insertId(inserted);
      await db.update(estimates).set({ estimateNumber: makeEstimateNumber(id) }).where(eq(estimates.id, id));
      const full = await loadFull(db, id);
      if (!full) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Estimate create failed" });
      return full;
    }),

  /** Create or replace one option (tier) and its line items; recomputes totals. */
  saveOption: protectedProcedure
    .input(
      z.object({
        estimateId: z.number().int().positive(),
        optionId: z.number().int().positive().nullish(),
        tier: z.enum(["good", "better", "best"]),
        label: z.string().min(1).max(255),
        description: z.string().max(4000).nullish(),
        sortOrder: z.number().int().min(0).default(0),
        rebateAmount: z.number().nonnegative().default(0),
        warrantyTerms: z.string().max(4000).nullish(),
        maintenancePlan: z.string().max(4000).nullish(),
        lineItems: z.array(lineItemInput).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const est = (await db.select().from(estimates).where(eq(estimates.id, input.estimateId)).limit(1))[0];
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      if (est.status === "approved" || est.status === "declined") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot edit a ${est.status} estimate` });
      }

      const lines = input.lineItems.map((li, i) => ({
        ...li,
        amount: computeLineAmount(li.quantity, li.unitPrice),
        sortOrder: i,
      }));
      const { subtotal, total } = computeOptionTotals(lines);
      const optionValues = {
        estimateId: input.estimateId,
        tier: input.tier,
        label: input.label,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        rebateAmount: input.rebateAmount.toFixed(2),
        warrantyTerms: input.warrantyTerms ?? null,
        maintenancePlan: input.maintenancePlan ?? null,
      };

      await db.transaction(async (tx) => {
        let oid = input.optionId ?? 0;
        if (oid) {
          const existing = (await tx.select().from(estimateOptions).where(eq(estimateOptions.id, oid)).limit(1))[0];
          if (!existing || existing.estimateId !== input.estimateId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Option does not belong to this estimate" });
          }
          await tx.update(estimateOptions).set(optionValues).where(eq(estimateOptions.id, oid));
          await tx.delete(estimateLineItems).where(eq(estimateLineItems.optionId, oid));
        } else {
          oid = insertId(await tx.insert(estimateOptions).values(optionValues));
        }
        if (lines.length) {
          await tx.insert(estimateLineItems).values(
            lines.map(l => ({
              optionId: oid,
              name: l.name,
              description: l.description ?? null,
              itemType: l.itemType,
              quantity: String(l.quantity),
              unitPrice: String(l.unitPrice),
              amount: l.amount.toFixed(2),
              sortOrder: l.sortOrder,
            })),
          );
        }
      });

      const full = await loadFull(db, input.estimateId);
      return full!;
    }),

  deleteOption: protectedProcedure
    .input(z.object({ optionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const opt = (await db.select().from(estimateOptions).where(eq(estimateOptions.id, input.optionId)).limit(1))[0];
      if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Option not found" });
      const est = (await db.select().from(estimates).where(eq(estimates.id, opt.estimateId)).limit(1))[0];
      if (est && (est.status === "approved" || est.status === "declined")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot edit a ${est.status} estimate` });
      }
      await db.transaction(async (tx) => {
        await tx.delete(estimateLineItems).where(eq(estimateLineItems.optionId, input.optionId));
        await tx.delete(estimateOptions).where(eq(estimateOptions.id, input.optionId));
      });
      return { ok: true, estimateId: opt.estimateId };
    }),

  markSent: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const est = (await db.select().from(estimates).where(eq(estimates.id, input.id)).limit(1))[0];
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      if (est.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: `Estimate is already ${est.status}` });
      const opts = await db.select().from(estimateOptions).where(eq(estimateOptions.estimateId, input.id));
      if (opts.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one option before sending" });
      await db.update(estimates).set({ status: "sent" }).where(eq(estimates.id, input.id));
      return { ok: true };
    }),

  /** Approve exactly one option: snapshot (immutable) + local approval + best-effort QBO push. */
  approve: protectedProcedure
    .input(z.object({ estimateId: z.number().int().positive(), optionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const est = (await db.select().from(estimates).where(eq(estimates.id, input.estimateId)).limit(1))[0];
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      if (est.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Estimate already approved" });
      if (est.status === "declined") throw new TRPCError({ code: "BAD_REQUEST", message: "Estimate was declined" });

      const option = (await db.select().from(estimateOptions).where(eq(estimateOptions.id, input.optionId)).limit(1))[0];
      if (!option || option.estimateId !== input.estimateId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Option does not belong to this estimate" });
      }
      const lines = await db
        .select()
        .from(estimateLineItems)
        .where(eq(estimateLineItems.optionId, input.optionId))
        .orderBy(asc(estimateLineItems.sortOrder));
      if (lines.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot approve an option with no line items" });

      const approvedAt = new Date();
      const snapshot = buildApprovedSnapshot(option, lines, approvedAt);

      // Local approval stands regardless of the QBO push outcome.
      await db.transaction(async (tx) => {
        await tx
          .update(estimates)
          .set({
            status: "approved",
            approvedOptionId: input.optionId,
            approvedAt,
            approvedSnapshot: snapshot,
            declineReason: null,
            qbSyncStatus: "not_pushed",
            qbSyncError: null,
          })
          .where(eq(estimates.id, input.estimateId));
        await tx.update(estimateOptions).set({ isApproved: false }).where(eq(estimateOptions.estimateId, input.estimateId));
        await tx.update(estimateOptions).set({ isApproved: true }).where(eq(estimateOptions.id, input.optionId));
        // Opportunity value ← approved total; mark overridden so QBO sync won't clobber it.
        await tx
          .update(opportunities)
          .set({ amount: snapshot.total.toFixed(2), amountOverridden: true })
          .where(eq(opportunities.id, est.opportunityId));
        await tx.insert(opportunityEvents).values({
          opportunityId: est.opportunityId,
          type: "estimate_approved",
          message: `Estimate ${est.estimateNumber} approved — ${option.tier} option ($${snapshot.total.toFixed(2)}).`,
          metadata: { estimateId: est.id, optionId: option.id, tier: option.tier, total: snapshot.total },
        });
      });

      const push = await pushApprovedEstimate(input.estimateId);
      const estimate = await loadFull(db, input.estimateId);
      return { estimate, push };
    }),

  decline: protectedProcedure
    .input(z.object({ estimateId: z.number().int().positive(), reason: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const est = (await db.select().from(estimates).where(eq(estimates.id, input.estimateId)).limit(1))[0];
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      if (est.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Estimate already approved" });
      await db.update(estimates).set({ status: "declined", declineReason: input.reason }).where(eq(estimates.id, input.estimateId));
      await db.insert(opportunityEvents).values({
        opportunityId: est.opportunityId,
        type: "estimate_declined",
        message: `Estimate ${est.estimateNumber} declined.`,
        metadata: { estimateId: est.id, reason: input.reason },
      });
      return { ok: true };
    }),

  /** Re-attempt the QBO push for an already-approved estimate (uses the snapshot). */
  retryPush: protectedProcedure
    .input(z.object({ estimateId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await requireDb();
      const push = await pushApprovedEstimate(input.estimateId);
      if (!push.ok) throw new TRPCError({ code: "BAD_REQUEST", message: push.error ?? "QuickBooks push failed" });
      return push;
    }),
});
