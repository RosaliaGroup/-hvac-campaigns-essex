/** Durable CRM reminders. These tasks never send email or SMS. */
import { and, asc, eq, sql } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import type { FollowupKind } from "./crmFollowupRules";

export const followupTasks = mysqlTable("crmOutreachFollowupTasks", {
  id: int("id").autoincrement().primaryKey(),
  externalContactId: int("externalContactId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  introMessageId: varchar("introMessageId", { length: 255 }).notNull(),
  introThreadId: varchar("introThreadId", { length: 255 }).notNull(),
  introAt: timestamp("introAt").notNull(),
  kind: mysqlEnum("kind", ["human", "email_review", "final_review"]).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  assignedToName: varchar("assignedToName", { length: 255 }).notNull(),
  assignedToUserId: int("assignedToUserId"),
  status: mysqlEnum("status", ["open", "done", "cancelled"]).default("open").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, t => ({
  uniqueRecipientStep: uniqueIndex("crmOutreachFollowupTasks_email_kind_uq").on(t.recipientEmail, t.kind),
}));

let ready: Promise<unknown> | undefined;
export async function followupDatabase() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  ready ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS crmOutreachFollowupTasks (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      externalContactId int NOT NULL,
      recipientEmail varchar(320) NOT NULL,
      introMessageId varchar(255) NOT NULL,
      introThreadId varchar(255) NOT NULL,
      introAt timestamp NOT NULL,
      kind enum('human','email_review','final_review') NOT NULL,
      dueAt timestamp NOT NULL,
      assignedToName varchar(255) NOT NULL DEFAULT 'Ana Haynes',
      assignedToUserId int NULL,
      status enum('open','done','cancelled') NOT NULL DEFAULT 'open',
      note text NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY crmOutreachFollowupTasks_email_kind_uq (recipientEmail,kind),
      KEY crmOutreachFollowupTasks_status_due_idx (status,dueAt),
      KEY crmOutreachFollowupTasks_contact_idx (externalContactId)
    )
  `).catch(error => { ready = undefined; throw error; });
  await ready;
  return db;
}

export async function listCrmFollowupTasks(input: {
  status?: "open" | "done" | "cancelled"; contactId?: number;
} = {}) {
  const db = await followupDatabase();
  return db.select({
    id: followupTasks.id, externalContactId: followupTasks.externalContactId,
    recipientEmail: followupTasks.recipientEmail,
    introMessageId: followupTasks.introMessageId,
    introThreadId: followupTasks.introThreadId,
    introAt: followupTasks.introAt, kind: followupTasks.kind,
    dueAt: followupTasks.dueAt, status: followupTasks.status,
    assignedToName: followupTasks.assignedToName,
    assignedToUserId: followupTasks.assignedToUserId,
    note: followupTasks.note, name: crmExternalContacts.name,
    company: crmExternalContacts.company, phone: crmExternalContacts.phone,
  }).from(followupTasks)
    .leftJoin(crmExternalContacts, eq(followupTasks.externalContactId, crmExternalContacts.id))
    .where(and(
      input.status ? eq(followupTasks.status, input.status) : undefined,
      input.contactId ? eq(followupTasks.externalContactId, input.contactId) : undefined,
    ))
    .orderBy(asc(followupTasks.dueAt)).limit(150);
}

export async function updateCrmFollowupTask(
  id: number, status: "open" | "done" | "cancelled",
) {
  const db = await followupDatabase();
  await db.update(followupTasks).set({ status }).where(eq(followupTasks.id, id));
  const [row] = await db.select().from(followupTasks).where(eq(followupTasks.id, id)).limit(1);
  if (!row) throw new Error("CRM follow-up task not found");
  return row;
}

export async function addCrmFollowupTask(input: {
  contactId: number; email: string; introMessageId: string;
  introThreadId: string; introAt: Date; kind: FollowupKind;
  dueAt: Date; assignedToUserId: number | null; status: "open" | "cancelled"; note: string;
}) {
  const db = await followupDatabase();
  const inserted = await db.execute(sql`
    INSERT IGNORE INTO crmOutreachFollowupTasks
      (externalContactId, recipientEmail, introMessageId, introThreadId,
       introAt, kind, dueAt, assignedToName, assignedToUserId, status, note)
    VALUES (${input.contactId}, ${input.email}, ${input.introMessageId},
      ${input.introThreadId}, ${input.introAt}, ${input.kind}, ${input.dueAt},
      'Ana Haynes', ${input.assignedToUserId}, ${input.status}, ${input.note})
  `);
  return Number((inserted as any)?.[0]?.affectedRows ?? 0) === 1;
}
