/**
 * Recording documented SMS consent, revoking it, and auditing a purchased-list
 * cohort contact-by-contact. Recording is admin-only; revoking is open to any
 * non-viewer (removing permission is always the safe direction).
 */
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, memberProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { customers } from "../../drizzle/schema";
import { toE164 } from "../services/telnyxSms";
import {
  SMS_CONSENT_METHODS, ensureConsentStore, hasInboundFrom, listConsentRecords, phone10,
  smsConsentRecords, validateConsentEvidence,
} from "../services/smsConsentEvidence";
import { reviewRecipients, type Reason } from "./contactBulkSms";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

export const REASON_LABELS: Record<Reason | "eligible", string> = {
  eligible: "Eligible — documented consent, not opted out",
  no_verified_sms_consent: "No documented SMS consent for this person and number",
  archived: "Archived contact",
  missing_phone: "No valid US phone number",
  duplicate_phone: "Same phone as another contact in this set",
  opted_out: "Replied STOP / opted out",
  do_not_contact: "On CRM do-not-contact / suppression list",
  recent_duplicate: "Same text already sent within 24 hours",
  missing_contact: "Contact missing",
  verification_error: "Could not verify — treated as blocked",
};

export const smsConsentRouter = router({
  forCustomer: memberProcedure.input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [review] = await reviewRecipients(db, [input.customerId], null);
      return { review, records: await listConsentRecords(db, input.customerId) };
    }),

  record: adminProcedure.input(z.object({
    customerId: z.number().int().positive(),
    method: z.enum(SMS_CONSENT_METHODS),
    consentLanguage: z.string().trim().max(4000),
    evidenceReference: z.string().trim().max(500),
    evidenceNotes: z.string().trim().max(4000).optional(),
    obtainedAt: z.string().min(8),
    attested: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [customer] = await db.select({ id: customers.id, phone: customers.phone })
      .from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
    const e164 = toE164(customer.phone);
    if (!e164) throw new TRPCError({ code: "BAD_REQUEST", message: "Contact has no valid US phone number" });
    const obtainedAt = new Date(input.obtainedAt);
    const problems = validateConsentEvidence({ ...input, obtainedAt });
    if (input.method === "consumer_text_request" && !(await hasInboundFrom(db, e164)))
      problems.push("No inbound text from this number exists in the SMS Inbox to support a consumer text request.");
    if (problems.length) throw new TRPCError({ code: "BAD_REQUEST", message: problems.join(" ") });
    await ensureConsentStore(db);
    await db.insert(smsConsentRecords).values({
      customerId: customer.id, phone10: phone10(customer.phone), method: input.method,
      consentLanguage: input.consentLanguage, evidenceReference: input.evidenceReference,
      evidenceNotes: input.evidenceNotes || null, obtainedAt, attested: true,
      recordedByUserId: ctx.user.id, recordedByName: ctx.user.name || ctx.user.email || "CRM admin",
    });
    const [review] = await reviewRecipients(db, [customer.id], null);
    return { review };
  }),

  revoke: memberProcedure.input(z.object({
    customerId: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await ensureConsentStore(db);
    await db.update(smsConsentRecords).set({
      revokedAt: new Date(), revokedReason: input.reason,
      revokedByName: ctx.user.name || ctx.user.email || "CRM user",
    }).where(and(eq(smsConsentRecords.customerId, input.customerId), isNull(smsConsentRecords.revokedAt)));
    const [review] = await reviewRecipients(db, [input.customerId], null);
    return { review };
  }),

  /** Contact-by-contact SMS eligibility for a whole source cohort, plus data-quality counts. */
  cohortAudit: memberProcedure.input(z.object({
    source: z.string().min(1).max(255).default("hvac-list-07105"),
  })).query(async ({ input }) => {
    const db = await requireDb();
    const [summary] = await db.select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(${customers.status} = 'active')`,
      inactive: sql<number>`SUM(${customers.status} = 'inactive')`,
      archived: sql<number>`SUM(${customers.status} = 'archived')`,
      withValidPhone: sql<number>`SUM(LENGTH(REGEXP_REPLACE(COALESCE(${customers.phone}, ''), '[^0-9]', '')) IN (10, 11))`,
      withEmail: sql<number>`SUM(${customers.email} LIKE '%@%.%' AND ${customers.email} NOT LIKE '%placeholder%')`,
      placeholderEmail: sql<number>`SUM(${customers.email} LIKE '%placeholder%')`,
      createdOct27: sql<number>`SUM(${customers.createdAt} >= '2026-10-27 04:00:00' AND ${customers.createdAt} < '2026-10-28 04:00:00')`,
      distinctPhones: sql<number>`COUNT(DISTINCT RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10))`,
    }).from(customers).where(eq(customers.source, input.source));
    const ids = (await db.select({ id: customers.id }).from(customers)
      .where(eq(customers.source, input.source)).orderBy(customers.id)).map(r => r.id);
    const rows = await reviewRecipients(db, ids, null);
    const byReason: Record<string, number> = {};
    for (const r of rows) {
      const key = r.eligible ? "eligible" : (r.reason ?? "verification_error");
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
    const num = (v: unknown) => Number(v ?? 0);
    return {
      source: input.source,
      generatedAt: new Date().toISOString(),
      summary: Object.fromEntries(Object.entries(summary ?? {}).map(([k, v]) => [k, num(v)])) as Record<string, number>,
      byReason,
      reasonLabels: REASON_LABELS,
      rows: rows.map(r => ({
        id: r.id, name: r.name, phone: r.phone, status: r.status, eligible: r.eligible,
        reason: r.reason, consentSource: r.consentSource,
      })),
    };
  }),
});
