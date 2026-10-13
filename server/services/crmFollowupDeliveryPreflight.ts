/** Read-only follow-up delivery preflight. Never calls Gmail send. */
import { and, eq, gt, or } from "drizzle-orm";
import { crmCommunications, smsContacts, teamMembers, users } from "../../drizzle/schema";
import { cadenceDatabase, crm30DayTasks } from "./crm30DayTasks";
import { isOutreachSuppressed } from "./outreachSuppression";
import { gmailCrmStatus, CRM_MAILBOX } from "./gmailCrm";
import { evaluateFollowupDelivery } from "./crmFollowupDeliveryPolicy";

export async function preflightFollowupTask(taskId: number) {
  const db = await cadenceDatabase();
  const [task] = await db.select().from(crm30DayTasks)
    .where(eq(crm30DayTasks.id, taskId)).limit(1);
  if (!task) return { taskId, eligible: false as const, reason: "task_not_found" };
  const email = task.recipientEmail.trim().toLowerCase();
  const [suppressed, optedOut, interactions, gmail] = await Promise.all([
    isOutreachSuppressed(db, email),
    db.select({ id: smsContacts.id }).from(smsContacts)
      .where(and(eq(smsContacts.email, email), eq(smsContacts.optedOut, true))).limit(1),
    db.select({ direction: crmCommunications.direction, channel: crmCommunications.channel,
      occurredAt: crmCommunications.occurredAt })
      .from(crmCommunications)
      .where(and(eq(crmCommunications.externalContactId, task.externalContactId),
        gt(crmCommunications.occurredAt, task.introAt))).limit(200),
    gmailCrmStatus(),
  ]);
  // Staff sessions have negative IDs by design. Verify their active team record
  // rather than incorrectly marking all staff-owned tasks as invalid.
  const ownerId = task.assignedToUserId;
  let validOwner = false;
  if (ownerId && Number.isSafeInteger(ownerId)) {
    if (ownerId < 0) {
      const [member] = await db.select({ id: teamMembers.id }).from(teamMembers)
        .where(and(eq(teamMembers.id, -ownerId), eq(teamMembers.status, "active"))).limit(1);
      validOwner = Boolean(member);
    } else {
      const [user] = await db.select({ id: users.id }).from(users)
        .where(eq(users.id, ownerId)).limit(1);
      validOwner = Boolean(user);
    }
  }
  const inbound = interactions.some(row => row.direction === "inbound");
  const laterOutbound = interactions.some(row => row.direction === "outbound");
  const decision = evaluateFollowupDelivery({
    // Explicitly disabled until independent delivery authorization and
    // durable Gmail send reconciliation are implemented and verified.
    enabled: false,
    authorizedRecipient: false,
    dueAt: task.dueAt, now: new Date(), kind: task.kind, status: task.status,
    optedOut: suppressed || optedOut.length > 0, bounced: suppressed,
    hasInboundReply: inbound, hasHumanInteraction: inbound,
    hasLaterOutbound: laterOutbound, hasVerifiedSend: laterOutbound,
    gmailSendPermission: gmail.connected && gmail.hasSendPermission &&
      gmail.accountEmail?.toLowerCase() === CRM_MAILBOX,
    hasValidOwner: validOwner,
  });
  return { taskId, eligible: decision.eligible, reason: decision.eligible ? null : decision.reason,
    signals: { suppressed: suppressed || optedOut.length > 0, inbound, laterOutbound,
      validOwner: validOwner,
      gmailSendPermission: gmail.connected && gmail.hasSendPermission } };
}
