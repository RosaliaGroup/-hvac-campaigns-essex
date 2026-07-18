/**
 * SMS Conversation → CRM context (Phase 2A).
 *
 * Given a conversation phone, resolve the related CRM records (lead, customer,
 * properties, upcoming appointment, open job) so the SMS inbox can show an
 * actionable CRM panel. READ-ONLY resolver — it never writes, never auto-selects
 * an ambiguous record, and reuses the Phase-1 normalized-phone (last-10) match.
 *
 * The selection/ambiguity/preference logic is factored into PURE functions
 * (exported for unit tests); the DB wrapper just runs the queries and composes.
 */
import { getDb } from "../db";
import { customers, properties, appointments, jobs, leads } from "../../drizzle/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { phoneLast10Of } from "./smsOutbound";

type AnyDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Indexed-friendly last-10-digit match against a (possibly formatted) column.
 * Mirrors the Phase-1 matcher exactly; kept local so this file never mutates
 * the outbound-logging module. */
function last10Sql(column: unknown, raw: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${phoneLast10Of(raw)}`;
}

export interface LeadLite { id: number; name: string; status: string; priority: string; customerId: number | null }
export interface CustomerLite { id: number; displayName: string; status: string; phone: string | null }
export interface PropertyLite { id: number; label: string | null; addressLine1: string; addressLine2: string | null; city: string | null; state: string | null; zip: string | null }
export interface AppointmentLite { id: number; scheduledAt: Date | null; status: string; appointmentType: string | null; assignedToId: number | null }
export interface JobLite { id: number; jobNumber: string; title: string; status: string; priority: string; assignedToId: number | null }

/** A resolved slot: the candidate rows, whether it's ambiguous, and the chosen id. */
export interface CrmSlot<T extends { id: number }> {
  matches: T[];
  ambiguous: boolean;
  /** The single selected id when unambiguous (or explicitly chosen); null otherwise. */
  selectedId: number | null;
}

/**
 * Pick a slot from candidate rows. Never silently selects among >1 unless the
 * caller passes an explicit `selectedId` that exists in the set.
 */
export function pickSlot<T extends { id: number }>(rows: T[], selectedId?: number | null): CrmSlot<T> {
  if (rows.length === 0) return { matches: [], ambiguous: false, selectedId: null };
  if (selectedId != null && rows.some((r) => r.id === selectedId)) {
    return { matches: rows, ambiguous: rows.length > 1, selectedId };
  }
  if (rows.length === 1) return { matches: rows, ambiguous: false, selectedId: rows[0].id };
  return { matches: rows, ambiguous: true, selectedId: null }; // multiple → require user choice
}

const CLOSED_JOB = new Set(["completed", "invoice_sent", "paid", "closed", "cancelled"]);
const CLOSED_APPT = new Set(["completed", "cancelled"]);

/** Prefer upcoming/active appointments (soonest future first, then most recent). */
export function orderAppointments(rows: AppointmentLite[], now: number): AppointmentLite[] {
  const rank = (a: AppointmentLite) => {
    const t = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const upcoming = !CLOSED_APPT.has(a.status) && t >= now;
    return { upcoming, t };
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra.upcoming !== rb.upcoming) return ra.upcoming ? -1 : 1; // upcoming first
    if (ra.upcoming) return ra.t - rb.t;   // soonest upcoming first
    return rb.t - ra.t;                     // else most recent past first
  });
}

/** Prefer active (not closed) jobs, most recent id first. */
export function orderJobs(rows: JobLite[]): JobLite[] {
  return [...rows].sort((a, b) => {
    const aa = CLOSED_JOB.has(a.status), ab = CLOSED_JOB.has(b.status);
    if (aa !== ab) return aa ? 1 : -1; // active first
    return b.id - a.id;                 // newest first
  });
}

export interface CrmContext {
  phoneLast10: string;
  lead: CrmSlot<LeadLite>;
  customer: CrmSlot<CustomerLite>;
  properties: PropertyLite[];        // for the selected customer
  selectedPropertyId: number | null; // echoed back; ambiguous multi-property requires user choice
  appointment: CrmSlot<AppointmentLite>;
  job: CrmSlot<JobLite>;
}

export interface CrmContextOpts {
  /** Explicit user selections (override auto-pick without overwriting silently). */
  customerId?: number | null;
  propertyId?: number | null;
  now?: number;
}

const EMPTY = (l10: string): CrmContext => ({
  phoneLast10: l10,
  lead: { matches: [], ambiguous: false, selectedId: null },
  customer: { matches: [], ambiguous: false, selectedId: null },
  properties: [],
  selectedPropertyId: null,
  appointment: { matches: [], ambiguous: false, selectedId: null },
  job: { matches: [], ambiguous: false, selectedId: null },
});

export async function resolveConversationCrm(db: AnyDb, e164: string, opts: CrmContextOpts = {}): Promise<CrmContext> {
  const l10 = phoneLast10Of(e164 || "");
  if (l10.length < 10) return EMPTY(l10);
  const now = opts.now ?? Date.now();

  const leadRows: LeadLite[] = await db
    .select({ id: leads.id, name: leads.name, status: leads.status, priority: leads.priority, customerId: leads.customerId })
    .from(leads)
    .where(and(eq(leads.contactType, "phone"), last10Sql(leads.contact, e164)));

  const customerRows: CustomerLite[] = await db
    .select({ id: customers.id, displayName: customers.displayName, status: customers.status, phone: customers.phone })
    .from(customers)
    .where(or(last10Sql(customers.phone, e164), last10Sql(customers.altPhone, e164)));

  const lead = pickSlot(leadRows);
  const customer = pickSlot(customerRows, opts.customerId);
  const activeCustomerId = customer.selectedId;

  const propertyRows: PropertyLite[] = activeCustomerId
    ? await db
        .select({ id: properties.id, label: properties.label, addressLine1: properties.addressLine1, addressLine2: properties.addressLine2, city: properties.city, state: properties.state, zip: properties.zip })
        .from(properties)
        .where(eq(properties.customerId, activeCustomerId))
    : [];
  const propSlot = pickSlot(propertyRows, opts.propertyId);

  // Appointments: by customer (if selected) OR by phone; prefer upcoming/active.
  const apptWhere = activeCustomerId
    ? or(eq(appointments.customerId, activeCustomerId), last10Sql(appointments.phone, e164))
    : last10Sql(appointments.phone, e164);
  const apptRows: AppointmentLite[] = await db
    .select({ id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status, appointmentType: appointments.appointmentType, assignedToId: appointments.assignedToId })
    .from(appointments)
    .where(apptWhere);
  const orderedAppts = orderAppointments(apptRows, now);

  // Jobs: only via a known customer (jobs have no phone).
  const jobRows: JobLite[] = activeCustomerId
    ? await db
        .select({ id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title, status: jobs.status, priority: jobs.priority, assignedToId: jobs.assignedToId })
        .from(jobs)
        .where(eq(jobs.customerId, activeCustomerId))
    : [];
  const orderedJobs = orderJobs(jobRows);

  return {
    phoneLast10: l10,
    lead,
    customer,
    properties: propertyRows,
    selectedPropertyId: propSlot.selectedId,
    // For appointment/job "slots" we surface the preferred one as selected but keep
    // the full list so the UI can show a compact selector / "View all".
    appointment: { matches: orderedAppts, ambiguous: false, selectedId: orderedAppts[0]?.id ?? null },
    job: { matches: orderedJobs, ambiguous: false, selectedId: orderedJobs[0]?.id ?? null },
  };
}
