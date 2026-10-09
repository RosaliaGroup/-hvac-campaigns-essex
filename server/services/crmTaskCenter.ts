/** Read-only unified task center listing: outreach cadence + Opportunity Center tasks. */
import { and, asc, desc, eq, like, or, sql, count } from "drizzle-orm";
import { opportunityTasks, opportunities, customers } from "../../drizzle/schema";
import { getDb } from "../db";
import { crm30DayTasks, cadenceDatabase } from "./crm30DayTasks";
import { crmExternalContacts } from "../../drizzle/schema";

export type TaskState = "open" | "done" | "cancelled" | "all";
export type ActionFilter = "all" | "call" | "email" | "text";
export type TaskPageInput = {
  status: TaskState; action: ActionFilter; search: string;
  offset: number; limit: number;
};

export async function outreachTaskPage(input: TaskPageInput) {
  const db = await cadenceDatabase();
  const term = input.search.trim().slice(0, 120);
  const filters = and(
    input.status !== "all" ? eq(crm30DayTasks.status, input.status) : undefined,
    input.action === "call" ? eq(crm30DayTasks.kind, "human") :
      input.action === "email" ? eq(crm30DayTasks.kind, "email_review") :
      input.action === "text" ? sql`false` : undefined,
    term ? or(
      like(crm30DayTasks.recipientEmail, `%${term}%`),
      like(crmExternalContacts.name, `%${term}%`),
      like(crmExternalContacts.company, `%${term}%`),
    ) : undefined,
  );
  const base = db.select({
    id: crm30DayTasks.id, externalContactId: crm30DayTasks.externalContactId,
    recipientEmail: crm30DayTasks.recipientEmail, introThreadId: crm30DayTasks.introThreadId,
    touchNumber: crm30DayTasks.touchNumber, kind: crm30DayTasks.kind,
    dueAt: crm30DayTasks.dueAt, status: crm30DayTasks.status,
    outcome: crm30DayTasks.outcome, completedAt: crm30DayTasks.completedAt,
    assignedToName: crm30DayTasks.assignedToName,
    assignedToUserId: crm30DayTasks.assignedToUserId,
    note: crm30DayTasks.note,
    name: crmExternalContacts.name, company: crmExternalContacts.company,
    phone: crmExternalContacts.phone,
  }).from(crm30DayTasks).leftJoin(
    crmExternalContacts, eq(crm30DayTasks.externalContactId, crmExternalContacts.id)
  );
  const [rows, totals] = await Promise.all([
    base.where(filters).orderBy(asc(crm30DayTasks.dueAt), asc(crm30DayTasks.id))
      .limit(input.limit).offset(input.offset),
    db.select({ total: count() }).from(crm30DayTasks)
      .leftJoin(crmExternalContacts, eq(crm30DayTasks.externalContactId, crmExternalContacts.id))
      .where(filters),
  ]);
  return { items: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function opportunityTaskPage(input: TaskPageInput) {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  const term = input.search.trim().slice(0, 120);
  const filters = and(
    input.status === "open" ? eq(opportunityTasks.status, "open") :
      input.status === "done" ? eq(opportunityTasks.status, "done") :
      input.status === "cancelled" ? eq(opportunityTasks.status, "cancelled") : undefined,
    input.action !== "all" ? eq(opportunityTasks.type, input.action) : undefined,
    term ? or(
      like(opportunityTasks.title, `%${term}%`),
      like(opportunities.title, `%${term}%`),
      like(customers.displayName, `%${term}%`),
      like(customers.companyName, `%${term}%`),
    ) : undefined,
  );
  const join = db.select({
    id: opportunityTasks.id, opportunityId: opportunityTasks.opportunityId,
    title: opportunityTasks.title, body: opportunityTasks.body,
    type: opportunityTasks.type, dueAt: opportunityTasks.dueAt,
    status: opportunityTasks.status, assignedToId: opportunityTasks.assignedToId,
    opportunityTitle: opportunities.title,
    customerName: customers.displayName, company: customers.companyName,
  }).from(opportunityTasks)
    .innerJoin(opportunities, eq(opportunityTasks.opportunityId, opportunities.id))
    .leftJoin(customers, eq(opportunities.customerId, customers.id));
  const [items, totals] = await Promise.all([
    join.where(filters).orderBy(asc(opportunityTasks.dueAt), asc(opportunityTasks.id))
      .limit(input.limit).offset(input.offset),
    db.select({ total: count() }).from(opportunityTasks)
      .innerJoin(opportunities, eq(opportunityTasks.opportunityId, opportunities.id))
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .where(filters),
  ]);
  return { items, total: Number(totals[0]?.total ?? 0) };
}
