/**
 * Conversation → CRM resolution (Phase 2).
 *
 * Given a conversation phone number, finds the CRM records it matches (by the
 * shared last-10 normalization) and resolves a compact "workspace" context for
 * the SMS Inbox: linked customer/lead, property, upcoming appointment, open
 * job, latest estimate, and outstanding invoice.
 *
 * Rules (per Phase-2 spec):
 *  - A confirmed link in `smsConversationLinks` always wins and is never
 *    overwritten here (writes happen only via explicit user action).
 *  - With no confirmed link: a SINGLE unambiguous match is auto-DISPLAYED (not
 *    persisted); MULTIPLE matches are returned as candidates for a selector and
 *    are NEVER auto-linked; zero matches → "unlinked" (offer quick-create).
 *  - Appointment/job/estimate/invoice are derived from the linked customer at
 *    read time — not stored on the link.
 */
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import {
  customers, leads, leadCaptures, properties, appointments, jobs,
  quickbooksSalesDocuments, teamMembers, smsConversationLinks,
} from "../../drizzle/schema";
import { normalizePhone } from "../routers/customers";
import { getDb } from "../db";

type AnyDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** SQL last-10-digit match against a (possibly formatted) phone column. */
function phoneMatch(column: unknown, l10: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${l10}`;
}

export type MatchStatus = "linked" | "single" | "ambiguous" | "unlinked";

export interface CustomerCandidate { id: number; name: string; phone: string | null; type: string | null; status: string | null }
export interface LeadCandidate { id: number; name: string; contact: string | null; status: string | null }
export interface LeadCaptureCandidate { id: number; name: string; phone: string | null; status: string | null }

async function matchCustomers(db: AnyDb, l10: string): Promise<CustomerCandidate[]> {
  const rows = await db
    .select({ id: customers.id, name: customers.displayName, phone: customers.phone, type: customers.type, status: customers.status })
    .from(customers)
    .where(or(phoneMatch(customers.phone, l10), phoneMatch(customers.altPhone, l10)))
    .limit(10);
  return rows as CustomerCandidate[];
}
async function matchLeads(db: AnyDb, l10: string): Promise<LeadCandidate[]> {
  const rows = await db
    .select({ id: leads.id, name: leads.name, contact: leads.contact, status: leads.status })
    .from(leads)
    .where(and(eq(leads.contactType, "phone"), phoneMatch(leads.contact, l10)))
    .limit(10);
  return rows as LeadCandidate[];
}
async function matchLeadCaptures(db: AnyDb, l10: string): Promise<LeadCaptureCandidate[]> {
  const rows = await db
    .select({ id: leadCaptures.id, name: leadCaptures.name, phone: leadCaptures.phone, status: leadCaptures.status })
    .from(leadCaptures)
    .where(phoneMatch(leadCaptures.phone, l10))
    .limit(10);
  return rows as LeadCaptureCandidate[];
}

/** All CRM candidates matching a phone (for the ambiguity selector). */
export async function matchByPhone(db: AnyDb, phoneRaw: string) {
  const l10 = normalizePhone(phoneRaw);
  if (!l10) return { phoneLast10: null, customers: [], leads: [], leadCaptures: [] };
  const [c, l, lc] = await Promise.all([matchCustomers(db, l10), matchLeads(db, l10), matchLeadCaptures(db, l10)]);
  return { phoneLast10: l10, customers: c, leads: l, leadCaptures: lc };
}

function propertyAddress(p: { addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; zip: string | null }): string {
  return [p.addressLine1, p.addressLine2, [p.city, p.state, p.zip].filter(Boolean).join(", ")].filter(Boolean).join(", ");
}

export interface ConversationContext {
  phone: string;
  phoneLast10: string | null;
  status: MatchStatus;
  link: { customerId: number | null; leadId: number | null; leadCaptureId: number | null; propertyId: number | null } | null;
  candidates: { customers: CustomerCandidate[]; leads: LeadCandidate[]; leadCaptures: LeadCaptureCandidate[] };
  customer: { id: number; name: string; phone: string | null; type: string | null; status: string | null } | null;
  lead: LeadCandidate | null;
  leadCapture: LeadCaptureCandidate | null;
  properties: Array<{ id: number; address: string; label: string | null; isPrimary: boolean }>;
  selectedProperty: { id: number; address: string } | null;
  appointment: { id: number; status: string | null; scheduledAt: Date | null; assignedTo: string | null; address: string | null } | null;
  job: { id: number; jobNumber: string | null; title: string | null; status: string | null; priority: string | null } | null;
  estimate: { id: number; status: string | null; amount: string | null } | null;
  invoice: { id: number; status: string | null; balance: string | null } | null;
}

/** Resolve the full conversation workspace context for one phone number. */
export async function resolveConversationContext(db: AnyDb, phoneRaw: string): Promise<ConversationContext> {
  const empty: ConversationContext = {
    phone: phoneRaw, phoneLast10: null, status: "unlinked", link: null,
    candidates: { customers: [], leads: [], leadCaptures: [] },
    customer: null, lead: null, leadCapture: null, properties: [], selectedProperty: null,
    appointment: null, job: null, estimate: null, invoice: null,
  };
  const l10 = normalizePhone(phoneRaw);
  if (!l10) return empty;

  const [[link], candidates] = await Promise.all([
    db.select().from(smsConversationLinks).where(eq(smsConversationLinks.phoneLast10, l10)).limit(1),
    matchByPhone(db, phoneRaw),
  ]);

  // Decide the effective identity + status.
  let status: MatchStatus;
  let customerId: number | null = null;
  let lead: LeadCandidate | null = null;
  let leadCapture: LeadCaptureCandidate | null = null;
  const total = candidates.customers.length + candidates.leads.length + candidates.leadCaptures.length;

  if (link && (link.customerId || link.leadId || link.leadCaptureId)) {
    status = "linked";
    customerId = link.customerId ?? null;
    lead = link.leadId ? candidates.leads.find((x) => x.id === link.leadId) ?? null : null;
    leadCapture = link.leadCaptureId ? candidates.leadCaptures.find((x) => x.id === link.leadCaptureId) ?? null : null;
  } else if (total === 0) {
    status = "unlinked";
  } else if (candidates.customers.length === 1 && candidates.leads.length === 0 && candidates.leadCaptures.length === 0) {
    status = "single"; customerId = candidates.customers[0].id;
  } else if (total === 1) {
    status = "single";
    lead = candidates.leads[0] ?? null;
    leadCapture = candidates.leadCaptures[0] ?? null;
  } else {
    status = "ambiguous"; // multiple candidates → selector; nothing auto-resolved
  }

  const ctx: ConversationContext = { ...empty, phone: phoneRaw, phoneLast10: l10, status, link: link ?? null, candidates, lead, leadCapture };

  if (customerId) {
    const [cust] = await db
      .select({ id: customers.id, name: customers.displayName, phone: customers.phone, type: customers.type, status: customers.status })
      .from(customers).where(eq(customers.id, customerId)).limit(1);
    ctx.customer = cust ?? null;

    const [props, appt, openJob, est, inv] = await Promise.all([
      db.select().from(properties).where(eq(properties.customerId, customerId)),
      // upcoming/most-recent appointment by customerId OR phone (pre-conversion bookings)
      db.select({ id: appointments.id, status: appointments.status, scheduledAt: appointments.scheduledAt, assignedToId: appointments.assignedToId, address: appointments.propertyAddress })
        .from(appointments).where(or(eq(appointments.customerId, customerId), phoneMatch(appointments.phone, l10)))
        .orderBy(desc(appointments.scheduledAt)).limit(1),
      db.select({ id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title, status: jobs.status, priority: jobs.priority })
        .from(jobs).where(and(eq(jobs.customerId, customerId), sql`${jobs.archivedAt} IS NULL`, ne(jobs.status, "closed"), ne(jobs.status, "cancelled")))
        .orderBy(desc(jobs.id)).limit(1),
      db.select({ id: quickbooksSalesDocuments.id, status: quickbooksSalesDocuments.status, amount: quickbooksSalesDocuments.totalAmount })
        .from(quickbooksSalesDocuments).where(and(eq(quickbooksSalesDocuments.customerId, customerId), eq(quickbooksSalesDocuments.docType, "estimate")))
        .orderBy(desc(quickbooksSalesDocuments.txnDate)).limit(1),
      db.select({ id: quickbooksSalesDocuments.id, status: quickbooksSalesDocuments.status, balance: quickbooksSalesDocuments.balance })
        .from(quickbooksSalesDocuments).where(and(eq(quickbooksSalesDocuments.customerId, customerId), eq(quickbooksSalesDocuments.docType, "invoice")))
        .orderBy(desc(quickbooksSalesDocuments.txnDate)).limit(1),
    ]);

    ctx.properties = props.map((p) => ({ id: p.id, address: propertyAddress(p), label: p.label, isPrimary: !!p.isPrimary }));
    const sel = link?.propertyId ? ctx.properties.find((p) => p.id === link.propertyId) : (ctx.properties.find((p) => p.isPrimary) ?? ctx.properties[0]);
    ctx.selectedProperty = sel ? { id: sel.id, address: sel.address } : null;

    if (appt[0]) {
      let assignedTo: string | null = null;
      if (appt[0].assignedToId) {
        const [tm] = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, appt[0].assignedToId)).limit(1);
        assignedTo = tm?.name ?? null;
      }
      ctx.appointment = { id: appt[0].id, status: appt[0].status, scheduledAt: appt[0].scheduledAt, assignedTo, address: appt[0].address };
    }
    ctx.job = openJob[0] ?? null;
    ctx.estimate = est[0] ?? null;
    ctx.invoice = inv[0] ?? null;
  } else {
    // No linked customer — still surface an appointment matched purely by phone.
    const appt = await db
      .select({ id: appointments.id, status: appointments.status, scheduledAt: appointments.scheduledAt, assignedToId: appointments.assignedToId, address: appointments.propertyAddress })
      .from(appointments).where(phoneMatch(appointments.phone, l10)).orderBy(desc(appointments.scheduledAt)).limit(1);
    if (appt[0]) ctx.appointment = { id: appt[0].id, status: appt[0].status, scheduledAt: appt[0].scheduledAt, assignedTo: null, address: appt[0].address };
  }

  return ctx;
}
