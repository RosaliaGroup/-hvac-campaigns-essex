/** Durable 30-day CRM cadence tasks; legacy 3-step table is preserved, not used. */
import { and, asc, eq, isNull, gte, lt, ne, sql } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { crmExternalContacts, crmCommunications, customers } from "../../drizzle/schema";
import { logCommunication } from "./crmCommunications";
import { getDb } from "../db";
import type { CadenceKind, CadenceOutcome } from "./crm30DayRules";

export const crm30DayTasks = mysqlTable("crmOutreach30DayTasks", {
  id: int("id").autoincrement().primaryKey(),
  externalContactId: int("externalContactId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  introMessageId: varchar("introMessageId", { length: 255 }).notNull(),
  introThreadId: varchar("introThreadId", { length: 255 }).notNull(),
  introAt: timestamp("introAt").notNull(),
  touchNumber: int("touchNumber").notNull(),
  kind: mysqlEnum("kind", ["human", "email_review"]).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  assignedToName: varchar("assignedToName", { length: 255 }).notNull(),
  assignedToUserId: int("assignedToUserId"),
  status: mysqlEnum("status", ["open", "done", "cancelled"]).default("open").notNull(),
  outcome: mysqlEnum("outcome", ["attempted_no_answer", "connected", "not_interested", "reviewed_no_send", "sent_verified"]),
  completedAt: timestamp("completedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, t => ({
  emailTouchUnique: uniqueIndex("crmOutreach30DayTasks_email_touch_uq").on(t.recipientEmail, t.touchNumber),
}));

let ready: Promise<unknown> | undefined;
export async function cadenceDatabase() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  ready ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS crmOutreach30DayTasks (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      externalContactId int NOT NULL,
      recipientEmail varchar(320) NOT NULL,
      introMessageId varchar(255) NOT NULL,
      introThreadId varchar(255) NOT NULL,
      introAt timestamp NOT NULL,
      touchNumber int NOT NULL,
      kind enum('human','email_review') NOT NULL,
      dueAt timestamp NOT NULL,
      assignedToName varchar(255) NOT NULL DEFAULT 'Ana Haynes',
      assignedToUserId int NULL,
      status enum('open','done','cancelled') NOT NULL DEFAULT 'open',
      outcome enum('attempted_no_answer','connected','not_interested','reviewed_no_send','sent_verified') NULL,
      completedAt timestamp NULL,
      note text NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY crmOutreach30DayTasks_email_touch_uq (recipientEmail,touchNumber),
      KEY crmOutreach30DayTasks_status_due_idx (status,dueAt),
      KEY crmOutreach30DayTasks_contact_idx (externalContactId)
    )
  `).catch(error => { ready = undefined; throw error; });
  await ready;
  return db;
}

export async function list30DayTasks(input: {
  status?: "open" | "done" | "cancelled"; contactId?: number;
} = {}) {
  const db = await cadenceDatabase();
  return db.select({
    id: crm30DayTasks.id, externalContactId: crm30DayTasks.externalContactId,
    recipientEmail: crm30DayTasks.recipientEmail, introMessageId: crm30DayTasks.introMessageId,
    introThreadId: crm30DayTasks.introThreadId, introAt: crm30DayTasks.introAt,
    touchNumber: crm30DayTasks.touchNumber, kind: crm30DayTasks.kind,
    dueAt: crm30DayTasks.dueAt, status: crm30DayTasks.status, outcome: crm30DayTasks.outcome,
    completedAt: crm30DayTasks.completedAt, assignedToName: crm30DayTasks.assignedToName,
    assignedToUserId: crm30DayTasks.assignedToUserId, note: crm30DayTasks.note,
    name: crmExternalContacts.name, company: crmExternalContacts.company,
    phone: crmExternalContacts.phone,
  }).from(crm30DayTasks)
    .leftJoin(crmExternalContacts, eq(crm30DayTasks.externalContactId, crmExternalContacts.id))
    .where(and(
      input.status ? eq(crm30DayTasks.status, input.status) : undefined,
      input.contactId ? eq(crm30DayTasks.externalContactId, input.contactId) : undefined,
    ))
    .orderBy(asc(crm30DayTasks.dueAt)).limit(200);
}

/** A review alone is not a sent email; only a Gmail-imported sent message can count. */
export async function complete30DayTask(id: number, outcome: CadenceOutcome, note?: string) {
  const db = await cadenceDatabase();
  const [task] = await db.select().from(crm30DayTasks).where(eq(crm30DayTasks.id, id)).limit(1);
  if (!task) throw new Error("CRM cadence task not found");
  if (task.status !== "open") return task;
  if (task.kind === "human" && !["attempted_no_answer", "connected", "not_interested"].includes(outcome))
    throw new Error("Choose a valid human follow-up outcome");
  if (task.kind === "email_review" && !["reviewed_no_send", "sent_verified"].includes(outcome))
    throw new Error("Choose a valid email review outcome");
  if (outcome === "sent_verified") {
    const [sent] = await db.select({ id: crmCommunications.id }).from(crmCommunications)
      .where(and(
        eq(crmCommunications.externalContactId, task.externalContactId),
        eq(crmCommunications.provider, "gmail"),
        eq(crmCommunications.channel, "email"),
        eq(crmCommunications.direction, "outbound"),
        eq(crmCommunications.providerThreadId, task.introThreadId),
        ne(crmCommunications.providerMessageId, task.introMessageId),
        gte(crmCommunications.occurredAt, new Date(task.dueAt.getTime() - 24 * 60 * 60_000)),
      )).limit(1);
    if (!sent) throw new Error("No qualifying sent Gmail message in the original thread; cannot count email as a completed touch.");
  }
  // A CRM call outcome is user-reported, not provider-confirmed. Record it
  // only when the operator explicitly chooses an outcome after making a call.
  if (task.kind === "human") {
    const [contact] = await db.select().from(crmExternalContacts)
      .where(eq(crmExternalContacts.id, task.externalContactId)).limit(1);
    if (!contact) throw new Error("Contact no longer exists");
    const [customer] = contact.customerId
      ? await db.select({ phone: customers.phone }).from(customers)
          .where(eq(customers.id, contact.customerId)).limit(1)
      : [];
    const dialedNumber = contact.phone || customer?.phone;
    if (!dialedNumber || dialedNumber.replace(/\\D/g, "").length < 10)
      throw new Error("Save a valid contact phone number before logging a call.");
    const logged = await logCommunication(db, {
      externalContactId: task.externalContactId,
      customerId: contact.customerId,
      channel: "call",
      direction: "outbound",
      provider: "crm-manual",
      providerMessageId: `crm-30day-call-${task.id}`,
      toAddress: dialedNumber,
      subject: outcome === "attempted_no_answer" ? "Call attempted — no answer"
        : outcome === "connected" ? "Call connected — handoff"
        : "Call completed — not interested",
      body: note?.trim() || "Outcome entered manually by CRM user.",
      status: outcome,
      occurredAt: new Date(),
    });
    const [confirmed] = await db.select({ id: crmCommunications.id })
      .from(crmCommunications).where(eq(crmCommunications.id, logged.id)).limit(1);
    if (!confirmed) throw new Error("Call log could not be verified in CRM Communications");
  }
  await db.update(crm30DayTasks).set({
    status: "done", outcome, completedAt: new Date(),
    ...(note?.trim() ? { note: note.trim() } : {}),
  }).where(and(eq(crm30DayTasks.id, id), eq(crm30DayTasks.status, "open")));
  if (outcome === "connected" || outcome === "not_interested") {
    await db.update(crm30DayTasks).set({
      status: "cancelled",
      note: "Sequence stopped after meaningful human interaction.",
    }).where(and(eq(crm30DayTasks.recipientEmail, task.recipientEmail), eq(crm30DayTasks.status, "open")));
  }
  const [updated] = await db.select().from(crm30DayTasks).where(eq(crm30DayTasks.id, id)).limit(1);
  if (!updated || updated.status !== "done") throw new Error("CRM cadence completion not verified");
  return updated;
}

export async function insert30DayTask(input: {
  contactId: number; email: string; introMessageId: string; introThreadId: string;
  introAt: Date; touchNumber: number; kind: CadenceKind; dueAt: Date;
  assignedToUserId: number | null; status: "open" | "cancelled"; note: string;
}) {
  const db = await cadenceDatabase();
  const result = await db.execute(sql`
    INSERT IGNORE INTO crmOutreach30DayTasks
      (externalContactId, recipientEmail, introMessageId, introThreadId, introAt,
       touchNumber, kind, dueAt, assignedToName, assignedToUserId, status, note)
    VALUES (${input.contactId}, ${input.email}, ${input.introMessageId}, ${input.introThreadId},
      ${input.introAt}, ${input.touchNumber}, ${input.kind}, ${input.dueAt},
      'Ana Haynes', ${input.assignedToUserId}, ${input.status}, ${input.note})
  `);
  return Number((result as any)?.[0]?.affectedRows ?? 0) === 1;
}

export async function assign30DayTask(id: number, userId: number, userName: string) {
  const db = await cadenceDatabase();
  await db.update(crm30DayTasks).set({
    assignedToUserId: userId, assignedToName: userName,
  }).where(eq(crm30DayTasks.id, id));
  const [row] = await db.select().from(crm30DayTasks).where(eq(crm30DayTasks.id, id)).limit(1);
  if (!row || row.assignedToUserId !== userId) throw new Error("CRM task assignment not verified");
  return row;
}
export async function assignAll30DayTasks(userId: number, userName: string) {
  const db = await cadenceDatabase();
  const where = and(eq(crm30DayTasks.status, "open"), isNull(crm30DayTasks.assignedToUserId));
  const [before] = await db.select({ n: sql<number>`count(*)` }).from(crm30DayTasks).where(where);
  await db.update(crm30DayTasks).set({ assignedToUserId: userId, assignedToName: userName }).where(where);
  const [after] = await db.select({ n: sql<number>`count(*)` }).from(crm30DayTasks).where(where);
  return { assigned: Number(before?.n ?? 0) - Number(after?.n ?? 0), remainingUnassigned: Number(after?.n ?? 0), userId };
}

/** Suppress all remaining open reminders when a bounce, opt-out or reply is known. */
export async function cancelOpen30DayTasks(email: string, reason: string) {
  const db = await cadenceDatabase();
  const result = await db.update(crm30DayTasks)
    .set({ status: "cancelled", note: reason })
    .where(and(
      eq(crm30DayTasks.recipientEmail, email.trim().toLowerCase()),
      eq(crm30DayTasks.status, "open"),
    ));
  return Number((result as any)?.[0]?.affectedRows ?? 0);
}

/** Periodic reconciliation for replies even when the introduction is older than the Gmail scan window. */
export async function cancelTasksWithInboundReplies() {
  const db = await cadenceDatabase();
  const result = await db.execute(sql`
    UPDATE crmOutreach30DayTasks AS t
    INNER JOIN crmCommunications AS c
      ON c.externalContactId = t.externalContactId
     AND c.direction = 'inbound'
     AND c.occurredAt > t.introAt
    SET t.status = 'cancelled',
        t.note = 'Inbound response recorded; stop automatic follow-ups and hand off to Ana.'
    WHERE t.status = 'open'
  `);
  return Number((result as any)?.[0]?.affectedRows ?? 0);
}
