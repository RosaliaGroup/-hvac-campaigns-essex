/**
 * Documented SMS marketing consent that did NOT come through one of our own
 * versioned web forms (leadCaptures). Every record must point at real,
 * retrievable evidence that THIS person agreed to receive marketing texts
 * from Mechanical Enterprise at THIS phone number.
 *
 * What is NOT consent and is rejected here:
 *  - Being on a purchased / compiled data list (e.g. Dataman hvac-list-07105).
 *  - A vendor statement that a list is "opt-in" without per-person consent
 *    language naming Mechanical Enterprise.
 *  - Changing a customer's CRM status to "active".
 *
 * A later STOP / do-not-contact always wins over a consent record (those
 * checks run after consent in reviewRecipients).
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { boolean, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { getDb } from "../db";
import { smsInboxMessages } from "../../drizzle/schema";
import { inboxPhoneMatch } from "./smsOutbound";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const SMS_CONSENT_METHODS = [
  "signed_written_form",     // paper or e-signed form / contract with SMS marketing clause
  "external_web_form",       // a web/landing/ad form outside our leadCaptures pipeline
  "consumer_text_request",   // the consumer texted us asking to receive texts
  "third_party_lead_form",   // a lead-gen form whose consent language names Mechanical Enterprise
] as const;
export type SmsConsentMethod = typeof SMS_CONSENT_METHODS[number];

export const SMS_CONSENT_METHOD_LABELS: Record<SmsConsentMethod, string> = {
  signed_written_form: "Signed written / e-signed form",
  external_web_form: "Web or ad form outside the CRM",
  consumer_text_request: "Consumer texted us requesting texts",
  third_party_lead_form: "Lead-gen form naming Mechanical Enterprise",
};

export const smsConsentRecords = mysqlTable("smsConsentRecords", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  phone10: varchar("phone10", { length: 10 }).notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  consentLanguage: text("consentLanguage").notNull(),
  evidenceReference: varchar("evidenceReference", { length: 500 }).notNull(),
  evidenceNotes: text("evidenceNotes"),
  obtainedAt: timestamp("obtainedAt").notNull(),
  attested: boolean("attested").notNull(),
  recordedByUserId: int("recordedByUserId"),
  recordedByName: varchar("recordedByName", { length: 255 }),
  revokedAt: timestamp("revokedAt"),
  revokedReason: varchar("revokedReason", { length: 500 }),
  revokedByName: varchar("revokedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SmsConsentRecord = typeof smsConsentRecords.$inferSelect;

let tableReady: Promise<unknown> | undefined;
export async function ensureConsentStore(db: Db) {
  tableReady ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS smsConsentRecords (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customerId int NOT NULL,
      phone10 varchar(10) NOT NULL,
      method varchar(40) NOT NULL,
      consentLanguage text NOT NULL,
      evidenceReference varchar(500) NOT NULL,
      evidenceNotes text NULL,
      obtainedAt timestamp NOT NULL,
      attested boolean NOT NULL,
      recordedByUserId int NULL,
      recordedByName varchar(255) NULL,
      revokedAt timestamp NULL,
      revokedReason varchar(500) NULL,
      revokedByName varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX smsConsentRecords_customer_idx (customerId),
      INDEX smsConsentRecords_phone_idx (phone10)
    )
  `).catch(error => { tableReady = undefined; throw error; });
  await tableReady;
}

export const phone10 = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);

export type ConsentEvidenceInput = {
  method: string;
  consentLanguage: string;
  evidenceReference: string;
  evidenceNotes?: string | null;
  obtainedAt: Date;
  attested: boolean;
};

/** Pure validation. Returns a list of human-readable problems (empty = acceptable). */
export function validateConsentEvidence(input: ConsentEvidenceInput, now = new Date()): string[] {
  const problems: string[] = [];
  if (!(SMS_CONSENT_METHODS as readonly string[]).includes(input.method))
    problems.push("Unsupported consent method. Purchased or compiled lists are not a consent method.");
  const language = input.consentLanguage.trim();
  if (language.length < 40)
    problems.push("Paste the exact consent wording the person agreed to (at least 40 characters).");
  if (!/mechanical\s+enterprise/i.test(language))
    problems.push("The consent wording must name Mechanical Enterprise as the business allowed to text.");
  if (!/\b(text|sms|messag)/i.test(language))
    problems.push("The consent wording must cover text/SMS messages.");
  if (input.evidenceReference.trim().length < 5)
    problems.push("Give a retrievable evidence reference (file link, signed-document ID, form submission ID or message ID).");
  if (Number.isNaN(input.obtainedAt.getTime()) || input.obtainedAt.getTime() > now.getTime() + 60_000)
    problems.push("The date consent was obtained must be a real date that is not in the future.");
  if (!input.attested)
    problems.push("Confirm that you have reviewed the evidence and it shows this person's own agreement.");
  // The list purchase itself (source tag / invoice) is never per-person evidence.
  if (/hvac-list-07105|\b144253\b|^\s*dataman\b/i.test(input.evidenceReference))
    problems.push("The purchased-list record or invoice is not consent. Reference the person's own opt-in evidence.");
  return problems;
}

/** Customer IDs (from `ids`) with at least one unrevoked consent record for their current phone. */
export async function activeConsentByCustomer(
  db: Db, rows: Array<{ id: number; phone: string | null }>,
): Promise<Map<number, SmsConsentRecord>> {
  const out = new Map<number, SmsConsentRecord>();
  if (!rows.length) return out;
  await ensureConsentStore(db);
  const records = await db.select().from(smsConsentRecords).where(and(
    inArray(smsConsentRecords.customerId, rows.map(r => r.id)),
    isNull(smsConsentRecords.revokedAt),
  )).orderBy(desc(smsConsentRecords.id));
  const phoneById = new Map(rows.map(r => [r.id, phone10(r.phone)]));
  for (const record of records) {
    if (out.has(record.customerId)) continue;
    // Consent is tied to a number: a changed phone does not inherit it.
    if (record.phone10 === phoneById.get(record.customerId)) out.set(record.customerId, record);
  }
  return out;
}

export async function hasInboundFrom(db: Db, phoneE164: string): Promise<boolean> {
  const [row] = await db.select({ id: smsInboxMessages.id }).from(smsInboxMessages)
    .where(and(eq(smsInboxMessages.direction, "inbound"), inboxPhoneMatch(phoneE164))).limit(1);
  return Boolean(row);
}

export async function listConsentRecords(db: Db, customerId: number) {
  await ensureConsentStore(db);
  return db.select().from(smsConsentRecords)
    .where(eq(smsConsentRecords.customerId, customerId)).orderBy(desc(smsConsentRecords.id));
}
