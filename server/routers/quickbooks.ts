/**
 * QuickBooks integration router (Task 7).
 * - adminProcedure: connect / disconnect / pushAllUnsynced (privileged actions)
 * - protectedProcedure: status / per-customer push+pull / logs (viewer read-only
 *   enforced centrally by blockViewerMutations)
 * Tokens never cross this boundary — status returns metadata only.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customers, properties, quickbooksSyncLogs, type Customer, type Property } from "../../drizzle/schema";
import { getAccountingProvider } from "../integrations/accounting";
import { quickbooksProvider, buildAuthorizeUrl, getQboConfig, signState, writeSyncLog } from "../integrations/accounting/quickbooks";
import type { AccountingCustomerInput, ConflictResolution, PushCustomerResult } from "../integrations/accounting/types";

const provider = getAccountingProvider("quickbooks");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Build the normalized provider input from a customer row + its primary property. */
export function buildCustomerInput(c: Customer, primary?: Property | null): AccountingCustomerInput {
  return {
    localId: c.id,
    type: c.type,
    displayName: c.displayName,
    firstName: c.firstName,
    lastName: c.lastName,
    companyName: c.companyName,
    email: c.email,
    phone: c.phone,
    address: primary
      ? {
          line1: primary.addressLine1,
          line2: primary.addressLine2,
          city: primary.city,
          state: primary.state,
          zip: primary.zip,
        }
      : null,
  };
}

async function loadCustomerWithPrimary(customerId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const c = (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0];
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
  const props = await db
    .select()
    .from(properties)
    .where(eq(properties.customerId, customerId))
    .orderBy(desc(properties.isPrimary), desc(properties.createdAt))
    .limit(1);
  return { db, customer: c, primary: props[0] ?? null };
}

/** Persist a successful push/link/update result onto the customer row. */
async function recordLink(customerId: number, qbId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ quickbooksCustomerId: qbId, quickbooksSyncStatus: "synced", quickbooksSyncedAt: new Date(), quickbooksSyncError: null })
    .where(eq(customers.id, customerId));
}

async function recordError(customerId: number, message: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ quickbooksSyncStatus: "error", quickbooksSyncError: message.slice(0, 1000) })
    .where(eq(customers.id, customerId));
}

/** Run a push for one customer, record customer state + a sync log, return the result. */
async function pushOne(customerId: number, resolution?: ConflictResolution): Promise<PushCustomerResult> {
  const { customer, primary } = await loadCustomerWithPrimary(customerId);
  const input = buildCustomerInput(customer, primary);
  const started = Date.now();
  const conn = await quickbooksProvider.getConnection();
  try {
    const result = await provider.pushCustomer(input, resolution);
    if (result.outcome === "created" || result.outcome === "updated" || result.outcome === "linked") {
      if (result.qbId) await recordLink(customerId, result.qbId);
      await quickbooksProvider.touchLastSync();
    }
    await writeSyncLog({
      entityType: "customer",
      entityId: customerId,
      direction: "push",
      realmId: conn?.realmId ?? null,
      success: result.outcome !== "conflict",
      durationMs: Date.now() - started,
      qbId: result.outcome === "conflict" ? result.candidate.qbId || null : result.qbId || null,
      errorCode: result.outcome === "conflict" ? "conflict" : null,
      errorMessage: result.outcome === "conflict" ? `Matched by ${result.matchedBy}` : null,
    });
    return result;
  } catch (e) {
    const message = (e as Error).message;
    await recordError(customerId, message);
    await writeSyncLog({
      entityType: "customer",
      entityId: customerId,
      direction: "push",
      realmId: conn?.realmId ?? null,
      success: false,
      durationMs: Date.now() - started,
      errorMessage: message.slice(0, 1000),
    });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
}

export const quickbooksRouter = router({
  /** Connection metadata only — never tokens. */
  getStatus: protectedProcedure.query(() => provider.getStatus()),

  /** Admin: begin OAuth. Returns the Intuit authorize URL with a signed state. */
  connectStart: adminProcedure.mutation(() => {
    const cfg = getQboConfig();
    if (!cfg.clientId || !cfg.redirectUri) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "QuickBooks client credentials are not configured" });
    }
    const url = buildAuthorizeUrl(cfg, signState());
    return { url };
  }),

  /** Admin: revoke + remove the stored connection. */
  disconnect: adminProcedure.mutation(async () => {
    await provider.disconnect();
    return { ok: true };
  }),

  /** Push one customer (merge protection runs first). */
  pushCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(({ input }) => pushOne(input.customerId)),

  /** Resolve a conflict for one customer: link / update / skip. */
  resolveConflict: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive(), resolution: z.enum(["link", "update", "skip"]) }))
    .mutation(({ input }) => pushOne(input.customerId, input.resolution)),

  /** Pull the current QBO record for an already-linked customer. */
  pullCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { customer } = await loadCustomerWithPrimary(input.customerId);
      if (!customer.quickbooksCustomerId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Customer is not linked to QuickBooks" });
      }
      const started = Date.now();
      const conn = await quickbooksProvider.getConnection();
      const result = await provider.pullCustomer(customer.quickbooksCustomerId);
      if (!result.active) {
        await recordError(input.customerId, "QuickBooks record is deleted or inactive");
      } else {
        await recordLink(input.customerId, result.qbId);
        await quickbooksProvider.touchLastSync();
      }
      await writeSyncLog({
        entityType: "customer",
        entityId: input.customerId,
        direction: "pull",
        realmId: conn?.realmId ?? null,
        success: result.active,
        durationMs: Date.now() - started,
        qbId: result.qbId,
        errorMessage: result.active ? null : "Inactive/deleted in QuickBooks",
      });
      return result;
    }),

  /** Admin: push every active, not-yet-linked customer with merge protection. */
  pushAllUnsynced: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const rows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(isNull(customers.quickbooksCustomerId), eq(customers.status, "active")));

    const summary = { pushed: 0, linked: 0, conflicts: 0, failed: 0, total: rows.length };
    for (const { id } of rows) {
      try {
        const result = await pushOne(id);
        if (result.outcome === "created" || result.outcome === "updated") summary.pushed++;
        else if (result.outcome === "linked") summary.linked++;
        else if (result.outcome === "conflict") summary.conflicts++;
      } catch {
        summary.failed++;
      }
      // QBO throttles ~500 req/min; stay far under (each push may issue 1-2 calls).
      await sleep(150);
    }
    return summary;
  }),

  /** Recent sync-log activity for the Integrations page. */
  recentLogs: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(quickbooksSyncLogs)
        .orderBy(desc(quickbooksSyncLogs.createdAt))
        .limit(input?.limit ?? 25);
    }),
});
