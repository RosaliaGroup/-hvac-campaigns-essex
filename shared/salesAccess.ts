/**
 * Sales role — client-facing CRM access only.
 *
 * A team member with role "sales" works the phones: she can look up leads and
 * contacts, book and reschedule appointments, add notes, update lead status and
 * add new leads/contacts. She must NOT see financials (QuickBooks, invoices,
 * estimates, opportunity values, jobs), marketing (ads, SEO, campaigns,
 * attribution, analytics), AI/automation settings or administration.
 *
 * Enforcement is DENY BY DEFAULT on the server: a sales session may only call
 * the tRPC procedures listed below (see server/_core/trpc.ts). Anything new that
 * is added to the app stays hidden from sales until it is deliberately added
 * here. The client-side lists further down only decide what the sidebar shows;
 * they are not the security boundary.
 */

export const SALES_ROLE = "sales" as const;

/** Every tRPC procedure path a sales session may call. Nothing else. */
export const SALES_ALLOWED_PROCEDURES: ReadonlySet<string> = new Set([
  // Session
  "auth.me",
  "auth.logout",
  // Own notifications (rows are per-recipient)
  "notifications.list",
  "notifications.unreadCount",
  "notifications.markRead",
  "notifications.markAllRead",

  // Leads — view, edit details, notes, status
  "leadCaptures.list",
  "leadCaptures.stats",
  "leadCaptures.getById",
  "leadCaptures.update",
  "leadCaptures.updateStatus",
  "leadCaptures.addNote",
  "leadCaptures.appointments",

  // Contacts — view, add (new lead/contact), edit details and notes, properties
  "customers.list",
  "customers.getById", // money relations are stripped for sales (redactCustomerDetailForSales)
  "customers.searchForScheduling",
  "customers.listProperties",
  "customers.createWithProperty",
  "customers.update",
  "customers.addProperty",
  "customers.updateProperty",

  // Appointments — book, reschedule, status
  "appointments.list",
  "appointments.assignees",
  "appointments.teamRoster",
  "appointments.attendees",
  "appointments.create",
  "appointments.update",
  "appointments.updateStatus",
  "appointments.linkProperty",

  // Recorded click-to-call + call history/recordings
  "calls.status",
  "calls.start",
  "calls.listForContact",
  "calls.recordingUrl",
  // Browser dialer (headset) + QC on her own calls (calls.qcForCall checks ownership)
  "calls.webrtcToken",
  "calls.webrtcStart",
  "calls.webrtcFinish",
  "calls.qcForCall",

  // Read-only call/text history on a contact the rep has open
  "crmCommunications.timeline",
  "crmCommunications.contactForCustomer",
  "smsCampaigns.listInboxMessages", // a phone or contact is required for sales

  // CRM email inbox (/contacts/communications): read threads, email a contact and
  // reply, sent from the rep's own verified @mechanicalenterprise.com alias
  // (gmailSendAs). Texting, Gmail sync controls and contact-card edits stay off.
  "crmCommunications.contacts",
  "crmCommunications.recent",
  // Lead Scoring page (hot / warm / cold leads)
  "leadScoring.getScoreStats",
  "leadScoring.getTopLeads",
  "leadScoring.getScoredLeads",
  "leadScoring.recalculateScore",
  "crmCommunications.saveContactCard",
  "crmCommunications.contactCard",
  "crmCommunications.gmailStatus",
  "crmCommunications.leadOptions",
  "crmCommunications.openCustomerContact",
  "crmCommunications.openLeadContact",
  "crmCommunications.composeEmail",
  "crmCommunications.replyEmail",
  "crmCommunications.sendJob",
  // Text from the Mechanical line (STOP / do-not-contact enforced in sendAndRecordSms)
  "crmCommunications.sendText",
  // Team Hub inside the CRM (tasks, clock, reports)
  "teamHub.link",
  "teamHub.assignment",
  "teamHub.ping",
]);

/**
 * Procedures that act on one contact or lead. For a sales session the server
 * also checks that the contact/lead is assigned to them (server/_core/trpc.ts).
 */
type OwnedTarget = { type: "customer" | "lead"; id: number } | null;
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cust = (v: unknown): OwnedTarget => (n(v) != null ? { type: "customer", id: v as number } : null);
const lead = (v: unknown): OwnedTarget => (n(v) != null ? { type: "lead", id: v as number } : null);
export const SALES_OWNED_TARGETS: Readonly<Record<string, (input: any) => OwnedTarget>> = {
  "customers.getById": (i) => cust(i?.id),
  "customers.update": (i) => cust(i?.id),
  "customers.listProperties": (i) => cust(i?.customerId),
  "customers.addProperty": (i) => cust(i?.customerId),
  "leadCaptures.getById": (i) => lead(i?.id),
  "leadCaptures.update": (i) => lead(i?.id),
  "leadCaptures.updateStatus": (i) => lead(i?.id),
  "leadCaptures.addNote": (i) => lead(i?.id),
  "leadCaptures.appointments": (i) => lead(i?.id),
  "crmCommunications.contactForCustomer": (i) => cust(i?.customerId),
  "crmCommunications.openCustomerContact": (i) => cust(i?.customerId),
  "crmCommunications.openLeadContact": (i) => (i?.kind === "capture" ? lead(i?.id) : null),
  "calls.listForContact": (i) => cust(i?.customerId) ?? lead(i?.leadCaptureId),
};

export function isSalesAllowedProcedure(path: string): boolean {
  return SALES_ALLOWED_PROCEDURES.has(path);
}

type MaybeTeamUser = { teamRole?: string | null } | null | undefined;

export function isSalesUser(user: MaybeTeamUser): boolean {
  return user?.teamRole === SALES_ROLE;
}

/** Marketing-attribution fields on a lead capture that sales does not see. */
const LEAD_MARKETING_FIELDS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "gclid",
  "firstTouchLandingPath",
  "referrerHost",
  "pageUrl",
] as const;

export function redactLeadCaptureForSales<T extends Record<string, unknown>>(lead: T): T {
  const out: Record<string, unknown> = { ...lead };
  for (const k of LEAD_MARKETING_FIELDS) if (k in out) out[k] = null;
  return out as T;
}

/**
 * customers.getById for a sales session: keep the contact, properties,
 * appointments, leads, call log and notes; drop everything with money in it
 * (opportunities, estimates, invoices, jobs, rebate calculations, revenue
 * summary) and the QuickBooks sync fields on the contact itself.
 */
export function redactCustomerDetailForSales<
  T extends {
    customer: Record<string, unknown>;
    captures?: Array<Record<string, unknown>>;
    counts?: Record<string, unknown>;
    summary?: Record<string, unknown>;
  },
>(detail: T): T {
  const customer: Record<string, unknown> = { ...detail.customer };
  for (const k of Object.keys(customer)) {
    if (k.startsWith("quickbooks") || k === "hasQboConflicts") customer[k] = null;
  }
  customer.hasQboConflicts = false;
  return {
    ...detail,
    customer,
    captures: (detail.captures ?? []).map(redactLeadCaptureForSales),
    rebateCalculations: [],
    opportunities: [],
    estimates: [],
    invoices: [],
    jobs: [],
    counts: { ...(detail.counts ?? {}), opportunities: 0, jobs: 0, estimates: 0, invoices: 0 },
    summary: {
      ...(detail.summary ?? {}),
      activeJobs: 0,
      openOpportunities: 0,
      estimates: 0,
      invoices: 0,
      collectedRevenue: 0,
      outstandingBalance: 0,
      invoicedTotal: 0,
      wonOpportunityValue: 0,
    },
  };
}

/* ── Client side (navigation only — not a security boundary) ─────────────── */

/** CRM routes a sales user can open. Everything else redirects to the Daily Hub. */
export const SALES_ROUTE_PREFIXES: readonly string[] = [
  "/leads",
  "/customers",
  "/calendar",
  "/contacts/communications",
  "/team-hub",
  "/lead-scoring",
];

export const SALES_HOME = "/team-hub";

export function isSalesRoute(location: string): boolean {
  const path = (location || "/").split(/[?#]/)[0] || "/";
  if (path === "/customers/sms-consent" || path.startsWith("/customers/sms-consent/")) return false;
  return SALES_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
