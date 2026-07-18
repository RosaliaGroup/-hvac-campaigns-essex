/**
 * Mechanical Enterprise caller lookup for Jessica's `getCallerInfo` Vapi tool.
 *
 * SCOPE: Mechanical Enterprise ONLY. This module never calls another project's
 * API, never queries any Rosalia data source, and never crosses a tenant
 * boundary. It reads Mechanical's own CRM (customers / properties / appointments
 * / jobs) through the local `getDb()` connection and nothing else.
 *
 * PRIVACY: the caller is a voice assistant speaking to an inbound caller, so it
 * receives ONLY the minimum context needed to greet them and continue the call:
 *   - customer name
 *   - known email (only for a single, positively identified customer)
 *   - property addresses
 *   - upcoming appointments (date/time/type/status)
 *   - recent service context (job type/status/date)
 *
 * It NEVER returns invoices, payment details, amounts/margins, private/internal
 * notes, credentials, QuickBooks ids, billing addresses, or any data belonging
 * to a different customer. The projection is whitelist-based: `buildCallerInfo`
 * only ever reads the fields declared on the narrow input interfaces below, so a
 * sensitive column cannot leak even if a caller row happens to carry it.
 *
 * ISOLATION & SHARED NUMBERS: a phone number can belong to more than one
 * customer (spouses, roommates, a business main line). When the normalized
 * number resolves to MORE THAN ONE distinct customer we cannot safely say who is
 * calling, so we return a neutral not-found result (`ambiguous: true`) and leak
 * no names. Property/appointment/service data is only ever attached to a SINGLE
 * resolved customer.
 */

import { and, desc, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appointments, customers, jobs, properties } from "../../drizzle/schema";
import { normalizePhone } from "../routers/customers";

// ─────────────────────────────────────────────────────────────
// Narrow, whitelist-only input shapes. buildCallerInfo can read
// nothing else — this is the privacy boundary.
// ─────────────────────────────────────────────────────────────

export interface CallerCustomerRow {
  id: number;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
}

export interface CallerPropertyRow {
  customerId: number;
  label?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface CallerAppointmentRow {
  customerId?: number | null;
  phone?: string | null;
  fullName?: string | null;
  email?: string | null;
  appointmentType?: string | null;
  serviceType?: string | null;
  status?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  scheduledAt?: Date | string | null;
}

export interface CallerServiceRow {
  customerId: number;
  title?: string | null;
  jobType?: string | null;
  status?: string | null;
  completedAt?: Date | string | null;
  scheduledStartAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface CallerDataBundle {
  /** Distinct customers whose phone/altPhone matched (capped by the loader). */
  customers: CallerCustomerRow[];
  /** Appointments matched by phone OR by one of the matched customer ids. */
  appointments: CallerAppointmentRow[];
  /** Properties belonging to the matched customer ids. */
  properties: CallerPropertyRow[];
  /** Recent jobs belonging to the matched customer ids. */
  serviceRecords: CallerServiceRow[];
}

// ─────────────────────────────────────────────────────────────
// Public result — this is the Vapi tool contract Jessica consumes.
// `found` + `name` are the fields the inbound prompt reads; the rest
// is additive, minimal context. No field here is sensitive.
// ─────────────────────────────────────────────────────────────

export interface CallerAppointmentSummary {
  date: string;
  time?: string;
  type?: string;
  status?: string;
}

export interface CallerServiceSummary {
  summary: string;
  status?: string;
  date?: string;
}

export interface CallerInfoResult {
  found: boolean;
  /** True when the number maps to more than one customer — identity unverified. */
  ambiguous?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  /** Backward-compat flag retained from the original tool contract. */
  hasExistingAppointment?: boolean;
  properties?: string[];
  upcomingAppointments?: CallerAppointmentSummary[];
  recentService?: CallerServiceSummary[];
}

const MAX_PROPERTIES = 5;
const MAX_UPCOMING = 3;
const MAX_SERVICE = 3;

const UPCOMING_STATUSES = new Set(["pending", "confirmed", "rescheduled", "arrived"]);

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function customerName(c: CallerCustomerRow): string {
  if (c.displayName?.trim()) return c.displayName.trim();
  if (c.companyName?.trim()) return c.companyName.trim();
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || "";
}

function formatAddress(p: CallerPropertyRow): string {
  const line1 = [p.addressLine1, p.addressLine2].filter(Boolean).join(" ").trim();
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  const tail = [cityState, p.zip].filter(Boolean).join(" ").trim();
  return [line1, tail].filter(Boolean).join(", ").trim();
}

function isUpcoming(a: CallerAppointmentRow, now: Date): boolean {
  const status = (a.status || "").toLowerCase();
  if (status === "completed" || status === "cancelled") return false;
  const when = toDate(a.scheduledAt);
  if (when) return when.getTime() >= now.getTime();
  // No concrete datetime yet: treat active-status bookings as upcoming.
  return UPCOMING_STATUSES.has(status) || status === "";
}

function summarizeAppointment(a: CallerAppointmentRow): CallerAppointmentSummary {
  const when = toDate(a.scheduledAt);
  const date = when ? when.toISOString().slice(0, 10) : (a.preferredDate || "").trim();
  return {
    date,
    time: (a.preferredTime || "").trim() || undefined,
    type: (a.appointmentType || a.serviceType || "").trim() || undefined,
    status: (a.status || "").trim() || undefined,
  };
}

function appointmentSortKey(a: CallerAppointmentRow): number {
  return toDate(a.scheduledAt)?.getTime() ?? 0;
}

function summarizeService(j: CallerServiceRow): CallerServiceSummary {
  const when = toDate(j.completedAt) ?? toDate(j.scheduledStartAt) ?? toDate(j.createdAt);
  return {
    summary: (j.title || j.jobType || "Service visit").toString().trim(),
    status: (j.status || "").trim() || undefined,
    date: when ? when.toISOString().slice(0, 10) : undefined,
  };
}

function serviceSortKey(j: CallerServiceRow): number {
  return (toDate(j.completedAt) ?? toDate(j.scheduledStartAt) ?? toDate(j.createdAt))?.getTime() ?? 0;
}

/**
 * Pure projection: turn a data bundle into the minimal, privacy-filtered result.
 * No I/O, no clock of its own (caller passes `now`) — fully unit-testable.
 */
export function buildCallerInfo(bundle: CallerDataBundle, phoneKey: string | null, now: Date): CallerInfoResult {
  const uniqueCustomers = dedupeById(bundle.customers);

  // Shared number → more than one customer → cannot identify caller safely.
  if (uniqueCustomers.length > 1) {
    return { found: false, ambiguous: true };
  }

  if (uniqueCustomers.length === 1) {
    return projectSingleCustomer(uniqueCustomers[0], bundle, phoneKey, now);
  }

  // No customer record. Fall back to appointment history for THIS exact number
  // (Jessica-booked callers who were never converted to a customer).
  return projectFromAppointmentsOnly(bundle.appointments, phoneKey, now);
}

function dedupeById(rows: CallerCustomerRow[]): CallerCustomerRow[] {
  const seen = new Map<number, CallerCustomerRow>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r);
  return Array.from(seen.values());
}

function projectSingleCustomer(
  customer: CallerCustomerRow,
  bundle: CallerDataBundle,
  phoneKey: string | null,
  now: Date,
): CallerInfoResult {
  // Isolation: only rows belonging to THIS customer. Appointments may also be
  // matched by the exact phone (Jessica bookings pre-linkage), but only because
  // the number already resolved to exactly one customer.
  const myAppointments = bundle.appointments.filter(
    a => a.customerId === customer.id || (phoneKey != null && normalizePhone(a.phone) === phoneKey),
  );
  const myProperties = bundle.properties.filter(p => p.customerId === customer.id);
  const myServices = bundle.serviceRecords.filter(j => j.customerId === customer.id);

  const upcoming = myAppointments
    .filter(a => isUpcoming(a, now))
    .sort((x, y) => appointmentSortKey(x) - appointmentSortKey(y))
    .slice(0, MAX_UPCOMING)
    .map(summarizeAppointment);

  const propertyAddresses = uniqueNonEmpty(myProperties.map(formatAddress)).slice(0, MAX_PROPERTIES);

  const recentService = myServices
    .slice()
    .sort((x, y) => serviceSortKey(y) - serviceSortKey(x))
    .slice(0, MAX_SERVICE)
    .map(summarizeService);

  const name = customerName(customer);
  const email = customer.email?.trim() || undefined;

  return {
    found: true,
    name,
    phone: customer.phone?.trim() || undefined,
    ...(email ? { email } : {}),
    hasExistingAppointment: upcoming.length > 0,
    ...(propertyAddresses.length ? { properties: propertyAddresses } : {}),
    ...(upcoming.length ? { upcomingAppointments: upcoming } : {}),
    ...(recentService.length ? { recentService } : {}),
  };
}

function projectFromAppointmentsOnly(
  allAppointments: CallerAppointmentRow[],
  phoneKey: string | null,
  now: Date,
): CallerInfoResult {
  const mine =
    phoneKey == null
      ? []
      : allAppointments.filter(a => normalizePhone(a.phone) === phoneKey);

  if (mine.length === 0) return { found: false };

  // If the number's appointments carry more than one distinct name, we again
  // cannot say who is calling — stay neutral rather than guess.
  const distinctNames = uniqueNonEmpty(mine.map(a => (a.fullName || "").trim().toLowerCase()));
  if (distinctNames.length > 1) return { found: false, ambiguous: true };

  const identity = mine.find(a => (a.fullName || "").trim()) ?? mine[0];
  const name = (identity.fullName || "").trim();

  const distinctEmails = uniqueNonEmpty(mine.map(a => (a.email || "").trim().toLowerCase()));
  const email = distinctEmails.length === 1 ? (identity.email?.trim() || undefined) : undefined;

  const upcoming = mine
    .filter(a => isUpcoming(a, now))
    .sort((x, y) => appointmentSortKey(x) - appointmentSortKey(y))
    .slice(0, MAX_UPCOMING)
    .map(summarizeAppointment);

  return {
    found: true,
    ...(name ? { name } : {}),
    phone: identity.phone?.trim() || undefined,
    ...(email ? { email } : {}),
    hasExistingAppointment: upcoming.length > 0,
    ...(upcoming.length ? { upcomingAppointments: upcoming } : {}),
  };
}

function uniqueNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// DB loader — the only I/O. Mechanical Enterprise CRM only.
// ─────────────────────────────────────────────────────────────

/** Match a phone/altPhone column against the normalized last-10 key. */
function phoneMatch(column: unknown, key: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${key}`;
}

const CUSTOMER_MATCH_CAP = 6; // enough to detect "more than one" without over-reading

async function loadCallerData(phoneKey: string): Promise<CallerDataBundle> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const customerRows = await db
    .select({
      id: customers.id,
      displayName: customers.displayName,
      firstName: customers.firstName,
      lastName: customers.lastName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      altPhone: customers.altPhone,
    })
    .from(customers)
    .where(
      and(
        or(phoneMatch(customers.phone, phoneKey), phoneMatch(customers.altPhone, phoneKey)),
        sql`${customers.status} <> 'archived'`,
      ),
    )
    .limit(CUSTOMER_MATCH_CAP);

  const ids = customerRows.map(c => c.id);

  const appointmentRows = await db
    .select({
      customerId: appointments.customerId,
      phone: appointments.phone,
      fullName: appointments.fullName,
      email: appointments.email,
      appointmentType: appointments.appointmentType,
      serviceType: appointments.serviceType,
      status: appointments.status,
      preferredDate: appointments.preferredDate,
      preferredTime: appointments.preferredTime,
      scheduledAt: appointments.scheduledAt,
    })
    .from(appointments)
    .where(
      ids.length
        ? or(phoneMatch(appointments.phone, phoneKey), inArray(appointments.customerId, ids))
        : phoneMatch(appointments.phone, phoneKey),
    )
    .orderBy(desc(appointments.createdAt))
    .limit(50);

  const propertyRows = ids.length
    ? await db
        .select({
          customerId: properties.customerId,
          label: properties.label,
          addressLine1: properties.addressLine1,
          addressLine2: properties.addressLine2,
          city: properties.city,
          state: properties.state,
          zip: properties.zip,
        })
        .from(properties)
        .where(inArray(properties.customerId, ids))
        .limit(25)
    : [];

  const serviceRows = ids.length
    ? await db
        .select({
          customerId: jobs.customerId,
          title: jobs.title,
          jobType: jobs.jobType,
          status: jobs.status,
          completedAt: jobs.completedAt,
          scheduledStartAt: jobs.scheduledStartAt,
          createdAt: jobs.createdAt,
        })
        .from(jobs)
        .where(and(inArray(jobs.customerId, ids), sql`${jobs.archivedAt} IS NULL`))
        .orderBy(desc(jobs.createdAt))
        .limit(25)
    : [];

  return {
    customers: customerRows,
    appointments: appointmentRows,
    properties: propertyRows,
    serviceRecords: serviceRows,
  };
}

/** Mask a phone for logs — never log the full number or any PII. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `***${digits.slice(-4)}`;
}

export type CallerDataLoader = (phoneKey: string) => Promise<CallerDataBundle>;

/**
 * Resolve caller context for a raw inbound phone number.
 *
 * Never throws: on any failure (bad input, DB down, query error) it logs safely
 * — with a masked number and no customer details — and returns a neutral
 * not-found result so the call can proceed. `loader`/`now` are injectable for
 * tests; production uses the real DB loader and the wall clock.
 */
export async function lookupCallerInfo(
  phoneRaw: string | null | undefined,
  opts: { loader?: CallerDataLoader; now?: Date } = {},
): Promise<CallerInfoResult> {
  const phoneKey = normalizePhone(phoneRaw);
  if (!phoneKey) {
    console.info(`[VapiTools][getCallerInfo] no usable phone provided (${maskPhone(phoneRaw)})`);
    return { found: false };
  }

  const loader = opts.loader ?? loadCallerData;
  const now = opts.now ?? new Date();

  try {
    const bundle = await loader(phoneKey);
    const result = buildCallerInfo(bundle, phoneKey, now);
    console.info(
      `[VapiTools][getCallerInfo] lookup ${maskPhone(phoneRaw)} → ` +
        `found=${result.found} ambiguous=${result.ambiguous ?? false} ` +
        `customerMatches=${dedupeById(bundle.customers).length}`,
    );
    return result;
  } catch (err) {
    // Log the failure shape only — no phone digits, no names, no rows.
    console.error(
      `[VapiTools][getCallerInfo] lookup failed for ${maskPhone(phoneRaw)}:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return { found: false };
  }
}
