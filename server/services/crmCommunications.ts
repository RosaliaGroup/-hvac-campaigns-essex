import { and, desc, eq, or } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const cleanEmail = (v?: string | null) => v?.trim().toLowerCase() || null;
const cleanPhone = (v?: string | null) => v?.replace(/[^0-9+]/g, "") || null;

export async function upsertExternalContact(
  db: Db,
  input: {
    name: string;
    company?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    propertyName?: string | null;
    source?: string | null;
    notes?: string | null;
    customerId?: number | null;
    leadId?: number | null;
    leadCaptureId?: number | null;
  }
) {
  const email = cleanEmail(input.email);
  const phone = cleanPhone(input.phone);
  // A shared building/office phone is not a unique person identifier.
  // Prefer exact email whenever present, and match phone only for SMS-only
  // events that lack an email address.
  const matches = !email && !phone ? [] : await db.select()
    .from(crmExternalContacts)
    .where(email ? eq(crmExternalContacts.email,email) : eq(crmExternalContacts.phone,phone!))
    .limit(1);
  // Sparse provider events must not erase enriched contact details or CRM links.
  const patch = Object.fromEntries(
    Object.entries({ ...input, email, phone }).filter(
      ([, value]) => value !== null && value !== undefined
    )
  ) as typeof input;
  if (matches[0] && (input.name === email || input.name === phone))
    patch.name = matches[0].name;
  if (matches[0]) {
    await db
      .update(crmExternalContacts)
      .set(patch)
      .where(eq(crmExternalContacts.id, matches[0].id));
    const improvedIdentity =
      Boolean(email && !matches[0].email) ||
      Boolean(phone && !matches[0].phone) ||
      Boolean(input.company && !matches[0].company) ||
      Boolean(input.name && matches[0].name.includes("@") && !input.name.includes("@")) ||
      Boolean(input.source && input.source !== matches[0].source &&
        ["gmail-prospecting","verified-hvac-prospect","crm-manual","gmail-selected"].includes(input.source));
    if (improvedIdentity) scheduleEnrichment(matches[0].id, true);
    return { ...matches[0], ...patch };
  }
  const result = await db.insert(crmExternalContacts).values(patch);
  const id = Number((result as any)[0]?.insertId);
  scheduleEnrichment(id, false);
  return { id, ...patch };
}
/** Queue immediately without holding up inbound Gmail, SMS or web lead capture.
 * Only explicitly imported or TASK-sourced contacts qualify. The durable
 * minute scheduler reconciles interrupted requests without importing Gmail.
 */
function scheduleEnrichment(contactId:number,force:boolean) {
  void import("./automaticContactEnrichment").then(async worker => {
    const queued=await worker.queueContactEnrichment(contactId,force);
    if(queued.queued) await worker.processContactEnrichment(contactId);
  }).catch(error=>console.warn("[CRM Auto Enrich] Queue deferred to scheduler",
    contactId,error instanceof Error?error.message:"unknown"));
}

export async function logCommunication(
  db: Db,
  input: {
    externalContactId?: number | null;
    customerId?: number | null;
    leadId?: number | null;
    channel: "email" | "sms" | "call";
    direction: "inbound" | "outbound";
    provider: string;
    providerMessageId?: string | null;
    providerThreadId?: string | null;
    fromAddress?: string | null;
    toAddress?: string | null;
    subject?: string | null;
    body?: string | null;
    status?: string | null;
    occurredAt?: Date;
  }
) {
  if (input.providerMessageId) {
    const existing = await db
      .select({ id: crmCommunications.id })
      .from(crmCommunications)
      .where(
        and(
          eq(crmCommunications.provider, input.provider),
          eq(crmCommunications.providerMessageId, input.providerMessageId)
        )
      )
      .limit(1);
    if (existing[0]) return { id: existing[0].id, duplicate: true };
  }
  let result;
  try {
    result = await db
      .insert(crmCommunications)
      .values({ ...input, occurredAt: input.occurredAt ?? new Date() });
  } catch (error) {
    // Retries from concurrent deliveries can race the preflight lookup.
    const cause = (error as any)?.cause ?? error;
    if (input.providerMessageId && cause?.code === "ER_DUP_ENTRY") {
      const existing = await db
        .select({ id: crmCommunications.id })
        .from(crmCommunications)
        .where(
          and(
            eq(crmCommunications.provider, input.provider),
            eq(crmCommunications.providerMessageId, input.providerMessageId)
          )
        )
        .limit(1);
      if (existing[0]) return { id: existing[0].id, duplicate: true };
    }
    throw error;
  }
  return { id: Number((result as any)[0]?.insertId), duplicate: false };
}

export async function getContactTimeline(db: Db, externalContactId: number) {
  return db
    .select()
    .from(crmCommunications)
    .where(eq(crmCommunications.externalContactId, externalContactId))
    .orderBy(desc(crmCommunications.occurredAt));
}

/** Resolve/create the unified external contact for an SMS phone number. */
export async function ensureSmsExternalContact(
  db: Db,
  input: {
    phone: string;
    name?: string | null;
    customerId?: number | null;
    leadId?: number | null;
    leadCaptureId?: number | null;
  }
) {
  return upsertExternalContact(db, {
    name: input.name?.trim() || input.phone,
    phone: input.phone,
    source: "telnyx",
    customerId: input.customerId ?? null,
    leadId: input.leadId ?? null,
    leadCaptureId: input.leadCaptureId ?? null,
  });
}
