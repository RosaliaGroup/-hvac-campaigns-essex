/**
 * Estimate → QuickBooks push orchestration (Task 8A). Used by the approve
 * mutation and by "Retry Push".
 *
 * Contract: NEVER throws on a QBO failure. It records qbSyncStatus=failed +
 * qbSyncError and writes a sync log, leaving the local approval intact — the sales
 * process is never blocked on an accounting sync. It always pushes the immutable
 * `approvedSnapshot`, not the live option, so a retry sends exactly what was
 * approved even if the estimate was edited afterward.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { estimates, opportunities, customers } from "../../../drizzle/schema";
import { quickbooksProvider, writeSyncLog } from "./quickbooks";
import { snapshotToPushLines, type ApprovedSnapshot } from "./estimateMath";
import type { PushEstimateResult } from "./types";

export interface PushOutcome {
  ok: boolean;
  qbId?: string | null;
  error?: string;
  result?: PushEstimateResult;
}

export async function pushApprovedEstimate(estimateId: number): Promise<PushOutcome> {
  const db = await getDb();
  if (!db) return { ok: false, error: "Database unavailable" };

  const est = (await db.select().from(estimates).where(eq(estimates.id, estimateId)).limit(1))[0];
  if (!est) return { ok: false, error: "Estimate not found" };
  if (est.status !== "approved" || !est.approvedSnapshot) {
    return { ok: false, error: "Estimate is not approved — nothing to push" };
  }
  const snapshot = est.approvedSnapshot as ApprovedSnapshot;

  const started = Date.now();
  const conn = await quickbooksProvider.getConnection().catch(() => null);
  const realmId = conn?.realmId ?? null;

  const fail = async (error: string): Promise<PushOutcome> => {
    await db
      .update(estimates)
      .set({ qbSyncStatus: "failed", qbSyncError: error.slice(0, 1000) })
      .where(eq(estimates.id, estimateId));
    await writeSyncLog({
      entityType: "estimate",
      entityId: estimateId,
      direction: "push",
      realmId,
      success: false,
      durationMs: Date.now() - started,
      qbId: est.quickbooksEstimateId ?? null,
      errorCode: null,
      errorMessage: error.slice(0, 1000),
    });
    return { ok: false, error };
  };

  // Resolve the QBO CustomerRef from the opportunity's customer. v1 requires the
  // customer to already be synced (auto-syncing it here is a v2 nicety).
  const opp = (await db.select().from(opportunities).where(eq(opportunities.id, est.opportunityId)).limit(1))[0];
  if (!opp) return fail("Opportunity not found for estimate");
  const customer = (await db.select().from(customers).where(eq(customers.id, opp.customerId)).limit(1))[0];
  const customerRef = customer?.quickbooksCustomerId ?? null;
  if (!customerRef) {
    return fail("Customer is not synced to QuickBooks — push the customer to QuickBooks first, then Retry Push.");
  }

  try {
    const result = await quickbooksProvider.pushEstimate({
      customerRef,
      docNumber: est.estimateNumber,
      privateNote: `Opportunity #${opp.id}${opp.title ? ` — ${opp.title}` : ""}`,
      lines: snapshotToPushLines(snapshot),
    });
    await db
      .update(estimates)
      .set({ quickbooksEstimateId: result.qbId, qbSyncStatus: "pushed", qbSyncError: null })
      .where(eq(estimates.id, estimateId));
    await writeSyncLog({
      entityType: "estimate",
      entityId: estimateId,
      direction: "push",
      realmId,
      success: true,
      durationMs: Date.now() - started,
      qbId: result.qbId,
      errorCode: null,
      errorMessage: null,
    });
    return { ok: true, qbId: result.qbId, result };
  } catch (e) {
    return fail((e as Error).message || "QuickBooks estimate push failed");
  }
}
