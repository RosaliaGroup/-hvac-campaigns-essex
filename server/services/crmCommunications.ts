import { and, desc, eq, or } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const cleanEmail = (v?: string | null) => v?.trim().toLowerCase() || null;
const cleanPhone = (v?: string | null) => v?.replace(/[^0-9+]/g, "") || null;

export async function upsertExternalContact(db: Db, input: {
  name: string; company?: string | null; title?: string | null; email?: string | null;
  phone?: string | null; propertyName?: string | null; source?: string | null; notes?: string | null;
  customerId?: number | null; leadId?: number | null; leadCaptureId?: number | null;
}) {
  const email = cleanEmail(input.email);
  const phone = cleanPhone(input.phone);
  const matches = await db.select().from(crmExternalContacts).where(
    or(...[email ? eq(crmExternalContacts.email, email) : undefined,
           phone ? eq(crmExternalContacts.phone, phone) : undefined].filter(Boolean) as any)
  ).limit(1);
  const patch = { ...input, email, phone };
  if (matches[0]) {
    await db.update(crmExternalContacts).set(patch).where(eq(crmExternalContacts.id, matches[0].id));
    return { ...matches[0], ...patch };
  }
  const result = await db.insert(crmExternalContacts).values(patch);
  const id = Number((result as any)[0]?.insertId);
  return { id, ...patch };
}

export async function logCommunication(db: Db, input: {
  externalContactId?: number | null; customerId?: number | null; leadId?: number | null;
  channel: "email" | "sms" | "call"; direction: "inbound" | "outbound";
  provider: string; providerMessageId?: string | null; providerThreadId?: string | null;
  fromAddress?: string | null; toAddress?: string | null; subject?: string | null;
  body?: string | null; status?: string | null; occurredAt?: Date;
}) {
  if (input.providerMessageId) {
    const existing = await db.select({ id: crmCommunications.id }).from(crmCommunications)
      .where(and(eq(crmCommunications.provider, input.provider), eq(crmCommunications.providerMessageId, input.providerMessageId))).limit(1);
    if (existing[0]) return { id: existing[0].id, duplicate: true };
  }
  const result = await db.insert(crmCommunications).values({ ...input, occurredAt: input.occurredAt ?? new Date() });
  return { id: Number((result as any)[0]?.insertId), duplicate: false };
}

export async function getContactTimeline(db: Db, externalContactId: number) {
  return db.select().from(crmCommunications)
    .where(eq(crmCommunications.externalContactId, externalContactId))
    .orderBy(desc(crmCommunications.occurredAt));
}
