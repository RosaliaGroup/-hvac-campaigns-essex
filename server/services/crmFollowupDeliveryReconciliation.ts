/** Read-only Gmail/CRM delivery ledger reconciliation. Never sends or retries email. */
import { and, eq } from "drizzle-orm";
import { crmCommunications } from "../../drizzle/schema";
import { cadenceDatabase, crm30DayTasks } from "./crm30DayTasks";
import { crmFollowupDeliveryLedger } from "./crmFollowupDeliveryLedger";

export async function inspectFollowupDelivery(taskId: number) {
  const db = await cadenceDatabase();
  const [task] = await db.select().from(crm30DayTasks)
    .where(eq(crm30DayTasks.id, taskId)).limit(1);
  if (!task) return { taskId, state: "task_not_found" as const };
  const [ledger] = await db.select().from(crmFollowupDeliveryLedger)
    .where(eq(crmFollowupDeliveryLedger.taskId, taskId)).limit(1);
  if (!ledger) return { taskId, state: "not_claimed" as const, taskStatus: task.status };
  if (!ledger.gmailMessageId) {
    return { taskId, state: ledger.state === "needs_reconciliation"
      ? "manual_reconciliation_required" as const : "no_confirmed_gmail_message" as const,
      taskStatus: task.status };
  }
  const [message] = await db.select({
    id: crmCommunications.id,
    providerMessageId: crmCommunications.providerMessageId,
    providerThreadId: crmCommunications.providerThreadId,
  }).from(crmCommunications).where(and(
    eq(crmCommunications.externalContactId, task.externalContactId),
    eq(crmCommunications.provider, "gmail"),
    eq(crmCommunications.direction, "outbound"),
    eq(crmCommunications.providerMessageId, ledger.gmailMessageId),
    eq(crmCommunications.providerThreadId, task.introThreadId),
  )).limit(1);
  return {
    taskId,
    state: message ? "gmail_confirmed_in_original_thread" as const
      : "gmail_crm_reconciliation_required" as const,
    taskStatus: task.status,
    // Never return recipient addresses or email bodies.
    hasGmailMessageId: Boolean(ledger.gmailMessageId),
    crmCommunicationId: message?.id ?? null,
  };
}
