/**
 * Contact-page SMS selection. Only explicit first-party, form-versioned
 * consent linked to this customer — or a documented consent record with
 * retrievable evidence (services/smsConsentEvidence) — permits an SMS send. Purchased lists,
 * generic 'active' contacts, carrier START, and leads with default opt_in
 * are NOT evidence of promotional SMS consent.
 */
import { z } from "zod";
import { and, eq, inArray, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { customers, leadCaptures, smsInboxMessages } from "../../drizzle/schema";
import { TCPA_FORM_VERSION } from "../../shared/leadFormVersion";
import { toE164 } from "../services/telnyxSms";
import { isPhoneOptedOut, inboxPhoneMatch, sendAndRecordSms } from "../services/smsOutbound";
import { isSmsRecipientSuppressed } from "../services/outreachSuppression";
import { getJob, startJob } from "../services/asyncLaneJob";
import { activeConsentByCustomer, phone10 } from "../services/smsConsentEvidence";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type Reason = "missing_contact" | "archived" | "missing_phone" |
  "no_verified_sms_consent" | "duplicate_phone" | "opted_out" |
  "do_not_contact" | "recent_duplicate" | "verification_error";
export type ConsentSource = "web_form" | "documented_record";
export type Recipient = {
  id: number; name: string; phone: string | null; eligible: boolean; reason: Reason | null;
  status: string | null; purchasedList: boolean; consentSource: ConsentSource | null;
};
export const PURCHASED_LIST_SOURCES = new Set(["hvac-list-07105"]);

const base = z.object({
  customerIds: z.array(z.number().int().positive()).min(1).max(20)
    .refine(ids => new Set(ids).size === ids.length, "Duplicate selected contact IDs"),
  message: z.string().trim().min(1).max(1200),
});
const sendInput = base.extend({ requestId: z.string().uuid() });
const BRAND_PREFIX = "Mechanical Enterprise: ";
const STOP_FOOTER = "\nReply STOP to opt out.";

function outgoingText(raw: string): string {
  const message = raw.trim();
  const noFoot = message.replace(/\s*Reply STOP to opt out\.?\s*$/i, "").trim();
  return (noFoot.toLowerCase().startsWith("mechanical enterprise")
    ? noFoot : BRAND_PREFIX + noFoot) + STOP_FOOTER;
}

/**
 * This is intentionally far stricter than an SMS delivery opt-out check.
 * Consent — not CRM status — is the gate: an "inactive" prospect with
 * documented consent may be texted; an "active" contact without it may not.
 * Pass `text` = null to skip the 24h identical-message check (audits).
 */
export async function reviewRecipients(db: Db, ids: number[], text: string | null): Promise<Recipient[]> {
  if (!ids.length) return [];
  const records = await db.select({
    id: customers.id, name: customers.displayName, phone: customers.phone,
    status: customers.status, source: customers.source,
  }).from(customers).where(inArray(customers.id, ids));
  const byId = new Map(records.map(r => [r.id, r]));

  // Batch consent lookups (one query each) so a 1,100-row audit stays fast.
  // 1) First-party versioned web-form opt-in linked to the customer.
  const formPhones = new Map<number, Set<string>>();
  // 2) Documented consent records (smsConsentEvidence).
  let documented = new Map<number, unknown>();
  let consentLookupFailed = false;
  try {
    const captures = await db.select({ customerId: leadCaptures.customerId, phone: leadCaptures.phone })
      .from(leadCaptures).where(and(
        inArray(leadCaptures.customerId, ids),
        eq(leadCaptures.consentStatus, "opt_in"),
        eq(leadCaptures.formVersion, TCPA_FORM_VERSION),
      ));
    for (const c of captures) {
      if (c.customerId == null) continue;
      const set = formPhones.get(c.customerId) ?? new Set<string>();
      set.add(phone10(c.phone));
      formPhones.set(c.customerId, set);
    }
    documented = await activeConsentByCustomer(db, records.map(r => ({ id: r.id, phone: r.phone })));
  } catch {
    consentLookupFailed = true;
  }

  const seenPhone = new Set<string>();
  const recipients: Recipient[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      recipients.push({ id, name: "Contact unavailable", phone: null, eligible: false, reason: "missing_contact",
        status: null, purchasedList: false, consentSource: null });
      continue;
    }
    const phone = toE164(row.phone);
    let reason: Reason | null = null;
    let consentSource: ConsentSource | null = null;
    if (!phone) reason = "missing_phone";
    else if (seenPhone.has(phone)) reason = "duplicate_phone";
    else if (row.status === "archived") reason = "archived";
    else if (consentLookupFailed) reason = "verification_error";
    else {
      // A purchased data record (which has no per-person evidence) never passes.
      if (formPhones.get(id)?.has(phone.slice(-10))) consentSource = "web_form";
      else if (documented.has(id)) consentSource = "documented_record";
      if (!consentSource) reason = "no_verified_sms_consent";
      else {
        try {
          if (await isSmsRecipientSuppressed(db, phone)) reason = "do_not_contact";
          else if (await isPhoneOptedOut(db, phone)) reason = "opted_out";
          else if (text !== null) {
            const [recent] = await db.select({ id: smsInboxMessages.id })
              .from(smsInboxMessages).where(and(
                inboxPhoneMatch(phone), eq(smsInboxMessages.direction, "outbound"),
                eq(smsInboxMessages.message, text),
                gte(smsInboxMessages.createdAt, new Date(Date.now() - 24 * 60 * 60_000)),
              )).limit(1);
            if (recent) reason = "recent_duplicate";
          }
        } catch {
          reason = "verification_error";
        }
      }
    }
    if (phone) seenPhone.add(phone);
    recipients.push({
      id, name: row.name, phone, eligible: reason === null, reason, status: row.status,
      purchasedList: PURCHASED_LIST_SOURCES.has(row.source ?? ""),
      consentSource: reason === null ? consentSource : null,
    });
  }
  return recipients;
}

export const contactBulkSmsRouter = router({
  preview: protectedProcedure.input(base).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const text = outgoingText(input.message);
    const recipients = await reviewRecipients(db, input.customerIds, text);
    return { text, recipients, eligible: recipients.filter(r => r.eligible).length,
      blocked: recipients.filter(r => !r.eligible).length };
  }),

  send: protectedProcedure.input(sendInput).mutation(({ input }) => {
    const text = outgoingText(input.message);
    const ids = [...input.customerIds];
    return startJob({
      kind: "customer-bulk-sms",
      key: "customer-bulk-sms:" + input.requestId,
      fn: async ({ setTotal, tick }) => {
        const db = await getDb();
        if (!db) throw new Error("CRM database unavailable");
        // Re-evaluate at dispatch time: never trust client preview or cached consent.
        const recipients = await reviewRecipients(db, ids, text);
        setTotal(recipients.length);
        let sent = 0, failed = 0, skipped = 0;
        const results: Array<{ id: number; status: "sent" | "failed" | "skipped"; reason?: string; messageId?: string }> = [];
        for (const recipient of recipients) {
          if (!recipient.eligible || !recipient.phone) {
            skipped++; results.push({ id: recipient.id, status: "skipped", reason: recipient.reason ?? "unavailable" });
            tick(); continue;
          }
          // Check consent/opt-out AND recent duplicate again immediately before each send.
          const [again] = await reviewRecipients(db, [recipient.id], text);
          if (!again?.eligible) {
            skipped++; results.push({ id: recipient.id, status: "skipped", reason: again?.reason ?? "unavailable" });
            tick(); continue;
          }
          try {
            const response = await sendAndRecordSms(db, {
              phone: recipient.phone, message: text, source: "campaign",
              customerId: recipient.id, sentByName: "CRM Selected Contacts",
            });
            if (response.success && response.messageId) {
              sent++; results.push({ id: recipient.id, status: "sent", messageId: response.messageId });
            } else {
              failed++; results.push({ id: recipient.id, status: "failed", reason: response.error ?? "No Telnyx message ID" });
            }
          } catch (err) {
            failed++; results.push({ id: recipient.id, status: "failed", reason: err instanceof Error ? err.message : "Unexpected error" });
          }
          tick();
        }
        return { sent, failed, skipped, total: recipients.length, results };
      },
    });
  }),

  job: protectedProcedure.input(z.object({ jobId: z.string().min(1) }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      return job?.kind === "customer-bulk-sms" ? job : null;
    }),
});
