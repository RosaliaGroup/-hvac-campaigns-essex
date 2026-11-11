/**
 * One-time (owner, Nov 11): restore prospects the hourly cycle wrongly stopped as
 * "Human-owned CRM relationship: existing_customer." between Nov 5 and Nov 11, 2026.
 *
 * Cause: contact research added every emailed prospect to Contacts (customers table), and the
 * relationship check treated any Contacts row as a customer (fixed in PR #542).
 *
 * For each such prospect, the CURRENT checks run again first (opt-out/bounce, public body,
 * appointment, real customer, active opportunity, engaged company). Only those that pass:
 *  - go back into the cadence ("nurture" when a follow-up step is still left, "queued" when the
 *    stop came before the introduction, "complete" when the 30-day cadence is over);
 *  - get their call and "Follow on social" tasks back: the cancelled tasks (their notes were
 *    overwritten by the stop reason) are replaced with fresh ones on the original schedule.
 * Sends no email itself; restored follow-ups go out through the normal hourly cap.
 * Recorded once in crmBackfillRuns; never repeats.
 */
import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { prospectWorkflowQueue as queue } from "../../drizzle/schema";
import { crm30DayTasks } from "./crm30DayTasks";
import { isPublicBidEntity, isExcludedProspect } from "./outreachProspectRules";
import { dueAt, type CycleStore, type QueueRow } from "./prospectCycle";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const RESTORE_NAME = "restore-existing-customer-stops-2026-11-11";
export const WRONG_STOP_REASON = "Human-owned CRM relationship: existing_customer.";

export type RestoreSummary = {
  found: number; restored: number; toNurture: number; toQueued: number; toComplete: number;
  stillHeld: number; heldReasons: Record<string, number>; tasksRecreated: number; errors: number;
  restoredEmails: string[];
};

export type RestoreRow = QueueRow & { emailMessageId?: string | null };

export type RestoreDeps = {
  store: Pick<CycleStore, "relationshipHold" | "isSuppressed" | "scheduleHumanTasks">;
  /** Replace the wrongly cancelled tasks for this address; returns how many were removed. */
  removeWronglyCancelledTasks: (email: string) => Promise<number>;
  setState: (id: number, state: string, nextTouchAt: Date | null) => Promise<void>;
};

/** Decide and apply the restore for each wrongly stopped row (pure logic, DB access injected). */
export async function restoreRows(rows: RestoreRow[], deps: RestoreDeps, now: Date): Promise<RestoreSummary> {
  const s: RestoreSummary = { found: rows.length, restored: 0, toNurture: 0, toQueued: 0, toComplete: 0,
    stillHeld: 0, heldReasons: {}, tasksRecreated: 0, errors: 0, restoredEmails: [] };
  const held = (why: string) => { s.stillHeld++; s.heldReasons[why] = (s.heldReasons[why] ?? 0) + 1; };
  for (const row of rows) {
    try {
      if (isPublicBidEntity(row)) { held("public_body"); continue; }
      if (isExcludedProspect(row) || await deps.store.isSuppressed(row.email.toLowerCase())) { held("suppressed"); continue; }
      const phase = row.touchCount >= 1 ? "follow_up" : "intro";
      const relation = await deps.store.relationshipHold(row, phase);
      if (relation) { held(relation); continue; }

      if (row.touchCount < 1) {
        await deps.setState(row.id, "queued", null);
        s.toQueued++;
      } else {
        const due = dueAt(row);
        if (due) { await deps.setState(row.id, "nurture", due); s.toNurture++; }
        else { await deps.setState(row.id, "complete", null); s.toComplete++; }
        if (row.emailMessageId && row.threadId && row.externalContactId) {
          const introAt = row.followUpAt ? new Date(row.followUpAt.getTime() - 86_400_000) : now;
          await deps.removeWronglyCancelledTasks(row.email);
          s.tasksRecreated += await deps.store.scheduleHumanTasks(row, { id: row.emailMessageId, threadId: row.threadId }, introAt);
        }
      }
      s.restored++;
      s.restoredEmails.push(row.email);
    } catch (e) {
      s.errors++;
      console.warn("[restore-stops] row failed", row.id, (e as Error).message.slice(0, 160));
    }
  }
  return s;
}

export async function runRestoreWronglyStopped(db: Db, store: RestoreDeps["store"], now = new Date()): Promise<RestoreSummary | null> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmBackfillRuns (
    name varchar(64) NOT NULL PRIMARY KEY, ranAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, summary text NULL)`);
  const claim = await db.execute(sql`INSERT IGNORE INTO crmBackfillRuns (name) VALUES (${RESTORE_NAME})`);
  if (Number((claim as any)?.[0]?.affectedRows ?? 0) !== 1) return null; // already ran

  const found = await db.select().from(queue)
    .where(and(eq(queue.state, "human_owned"), eq(queue.lastError, WRONG_STOP_REASON))).limit(2000);
  const rows = found.map(r => ({ ...r, followUpAt: r.followUpAt ?? null, nextTouchAt: r.nextTouchAt ?? null }) as RestoreRow);
  const s = await restoreRows(rows, {
    store,
    removeWronglyCancelledTasks: async email => {
      const r = await db.delete(crm30DayTasks).where(and(
        eq(crm30DayTasks.recipientEmail, email.trim().toLowerCase()),
        eq(crm30DayTasks.status, "cancelled"),
        eq(crm30DayTasks.note, WRONG_STOP_REASON),
      ));
      return Number((r as any)?.[0]?.affectedRows ?? 0);
    },
    setState: async (id, state, nextTouchAt) => {
      await db.update(queue).set({ state, nextTouchAt,
        lastError: `Restored Nov 11, 2026: wrongly stopped as existing_customer (fixed in PR #542).` })
        .where(and(eq(queue.id, id), eq(queue.state, "human_owned")));
    },
  }, now);
  await db.execute(sql`UPDATE crmBackfillRuns SET summary = ${JSON.stringify({ ...s, restoredEmails: s.restoredEmails.length })} WHERE name = ${RESTORE_NAME}`);
  return s;
}
