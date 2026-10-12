/** Durable idempotency ledger for an eventual independently authorized Gmail follow-up sender.
 * This module NEVER sends messages. An unknown Gmail outcome is quarantined,
 * not automatically retried, to avoid duplicate deliveries.
 */
import { eq, sql } from "drizzle-orm";
import { mysqlTable, int, varchar, timestamp, text } from "drizzle-orm/mysql-core";
import { getDb } from "../db";

export const crmFollowupDeliveryLedger = mysqlTable("crmFollowupDeliveryLedger", {
  taskId: int("taskId").primaryKey(),
  state: varchar("state", { length: 32 }).notNull(),
  gmailMessageId: varchar("gmailMessageId", { length: 255 }),
  gmailThreadId: varchar("gmailThreadId", { length: 255 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

async function ledgerDb() {
  const db = await getDb();
  if (!db) throw new Error("Delivery ledger database unavailable");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crmFollowupDeliveryLedger (
      taskId INT NOT NULL PRIMARY KEY,
      state VARCHAR(32) NOT NULL,
      gmailMessageId VARCHAR(255) NULL,
      gmailThreadId VARCHAR(255) NULL,
      note TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  return db;
}

/** Claim once; duplicates never reset a previous send or unknown outcome. */
export async function claimFollowupDelivery(taskId: number) {
  if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error("Invalid task ID");
  const db = await ledgerDb();
  const result = await db.insert(crmFollowupDeliveryLedger)
    .values({ taskId, state: "claimed" }).onDuplicateKeyUpdate({
      set: { taskId: sql`${crmFollowupDeliveryLedger.taskId}` },
    });
  const [row] = await db.select().from(crmFollowupDeliveryLedger)
    .where(eq(crmFollowupDeliveryLedger.taskId, taskId)).limit(1);
  if (!row) throw new Error("Delivery claim readback failed");
  const inserted = Number((result as any)?.[0]?.affectedRows ?? 0) === 1;
  return { claimed: inserted && row.state === "claimed", state: row.state };
}

/** Mark a Gmail response as confirmed; never fabricate a message ID. */
export async function confirmFollowupDelivery(taskId: number, gmailMessageId: string, gmailThreadId?: string) {
  if (!gmailMessageId.trim()) throw new Error("Gmail message ID required");
  const db = await ledgerDb();
  const result = await db.update(crmFollowupDeliveryLedger)
    .set({ state: "sent_confirmed", gmailMessageId, gmailThreadId: gmailThreadId ?? null })
    .where(sql`${crmFollowupDeliveryLedger.taskId} = ${taskId} AND ${crmFollowupDeliveryLedger.state} = 'claimed'`);
  if (Number((result as any)?.[0]?.affectedRows ?? 0) !== 1)
    throw new Error("Delivery claim not in confirmable state");
  const [row] = await db.select().from(crmFollowupDeliveryLedger)
    .where(eq(crmFollowupDeliveryLedger.taskId, taskId)).limit(1);
  if (!row || row.state !== "sent_confirmed" || row.gmailMessageId !== gmailMessageId)
    throw new Error("Gmail delivery confirmation readback failed");
  return row;
}

/** Quarantine ambiguous failures for manual Gmail reconciliation, never retry. */
export async function quarantineFollowupDelivery(taskId: number, note: string) {
  const db = await ledgerDb();
  await db.update(crmFollowupDeliveryLedger).set({
    state: "needs_reconciliation", note: note.slice(0, 1000),
  }).where(sql`${crmFollowupDeliveryLedger.taskId} = ${taskId} AND ${crmFollowupDeliveryLedger.state} = 'claimed'`);
}
