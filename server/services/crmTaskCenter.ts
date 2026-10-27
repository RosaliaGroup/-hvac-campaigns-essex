/** Read-only unified task center listing: outreach cadence + Opportunity Center tasks. */
import { and, asc, eq, like, or, sql, count, lt, gte } from "drizzle-orm";
import { opportunityTasks, opportunities, customers } from "../../drizzle/schema";
import { getDb } from "../db";
import { crm30DayTasks, cadenceDatabase } from "./crm30DayTasks";
import { crmExternalContacts } from "../../drizzle/schema";
import { phoneMeta, enrichmentDb } from "./crmContactEnrichment";

export type TaskState = "open" | "done" | "cancelled" | "all";
export type ActionFilter = "all" | "call" | "email" | "text";
export type TaskPageInput = {
  status: TaskState; action: ActionFilter; search: string;
  offset: number; limit: number; due: "all" | "overdue" | "today" | "upcoming";
};

function easternMidnight(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
  const parts = fmt.formatToParts(date);
  const get = (k: string) => Number(parts.find(p=>p.type===k)?.value);
  const utcMidnight = Date.UTC(get("year"),get("month")-1,get("day"));
  const probe = new Date(utcMidnight + 12*3600000);
  const zone = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",timeZoneName:"shortOffset"}).formatToParts(probe).find(p=>p.type==="timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\\d{1,2})(?::(\\d{2}))?$/.exec(zone);
  const offset = match ? (match[1]==="+"?1:-1)*(Number(match[2])*60+Number(match[3]??0)) : 0;
  return new Date(utcMidnight-offset*60000);
}
function dueClause(column: typeof crm30DayTasks.dueAt | typeof opportunityTasks.dueAt, due: TaskPageInput["due"]) {
  if (due === "all") return undefined;
  const start = easternMidnight(new Date());
  const next = easternMidnight(new Date(start.getTime()+36*3600000));
  return due === "overdue" ? lt(column,start) : due === "today" ? and(gte(column,start),lt(column,next)) : gte(column,next);
}


export async function outreachTaskPage(input: TaskPageInput) {
  await enrichmentDb();
  const db = await cadenceDatabase();
  const term = input.search.trim().slice(0, 120);
  const filters = and(
    input.status !== "all" ? eq(crm30DayTasks.status, input.status) : undefined,
    dueClause(crm30DayTasks.dueAt,input.due),
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
    phone: sql<string | null>`coalesce(${crmExternalContacts.phone}, ${customers.phone})`,
    phoneType: sql<"business" | "cell" | "unknown" | null>`CASE WHEN ${phoneMeta.phone} = COALESCE(${crmExternalContacts.phone}, ${customers.phone}) THEN ${phoneMeta.type} ELSE NULL END`,
  }).from(crm30DayTasks).leftJoin(
    crmExternalContacts, eq(crm30DayTasks.externalContactId, crmExternalContacts.id)
  ).leftJoin(customers, eq(crmExternalContacts.customerId, customers.id))
    .leftJoin(phoneMeta, eq(crmExternalContacts.id, phoneMeta.contactId));
  const [rows, totals] = await Promise.all([
    base.where(filters).orderBy(asc(crm30DayTasks.dueAt), asc(crm30DayTasks.id))
      .limit(input.limit).offset(input.offset),
    db.select({ total: count() }).from(crm30DayTasks)
      .leftJoin(crmExternalContacts, eq(crm30DayTasks.externalContactId, crmExternalContacts.id))
      .leftJoin(customers, eq(crmExternalContacts.customerId, customers.id))
      .where(filters),
  ]);
  return { items: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function opportunityTaskPage(input: TaskPageInput) {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  const term = input.search.trim().slice(0, 120);
  const filters = and(
    dueClause(opportunityTasks.dueAt,input.due),
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
