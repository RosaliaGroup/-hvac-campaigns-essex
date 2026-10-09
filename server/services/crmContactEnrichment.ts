/**
 * CRM enrichment metadata: phone type and social follow confirmation.
 * Never guesses a phone, mobile status, social URL, or actual LinkedIn follow.
 * Existing CRM contacts remain the source of truth for contact details.
 */
import { and, asc, count, eq, isNull, or, sql } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { crmExternalContacts, customers } from "../../drizzle/schema";
import { getDb } from "../db";
import { VERIFIED_PROSPECT_PHONES } from "./verifiedProspectPhones";
import { contactProfile } from "./contactProfile/store";

export type PhoneType = "business" | "cell" | "unknown";
const phoneMeta = mysqlTable("crmContactPhoneMetadata", {
  contactId: int("contactId").primaryKey(),
  phone: varchar("phone", { length: 50 }).notNull(),
  type: mysqlEnum("type", ["business", "cell", "unknown"]).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2000 }),
  verifiedAt: timestamp("verifiedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
const socialFollow = mysqlTable("crmContactSocialFollows", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 40 }).notNull(),
  followedAt: timestamp("followedAt").notNull(),
}, t => ({ unique: uniqueIndex("crmContactSocialFollows_contact_url_uq").on(t.contactId, t.url) }));

let ready: Promise<unknown> | undefined;
export async function enrichmentDb() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS crmContactPhoneMetadata (
      contactId int NOT NULL PRIMARY KEY, phone varchar(50) NOT NULL,
      type enum('business','cell','unknown') NOT NULL,
      sourceUrl varchar(2000) NULL, verifiedAt timestamp NULL,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS crmContactSocialFollows (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY, contactId int NOT NULL,
      url varchar(500) NOT NULL, platform varchar(40) NOT NULL,
      followedAt timestamp NOT NULL,
      UNIQUE KEY crmContactSocialFollows_contact_url_uq (contactId,url)
    )`);
  })().catch(e => { ready = undefined; throw e; });
  await ready;
  return db;
}
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
function verifiedListedPhone(email: string | null, phone: string | null) {
  if (!email || !phone) return null;
  return VERIFIED_PROSPECT_PHONES.find(p =>
    p.email === email.toLowerCase() && digits(p.phone) === digits(phone)) ?? null;
}
async function resolveContact(id: number) {
  const db = await enrichmentDb();
  const [contact] = await db.select().from(crmExternalContacts)
    .where(eq(crmExternalContacts.id, id)).limit(1);
  if (!contact) throw new Error("Contact not found");
  const [customer] = contact.customerId
    ? await db.select({ phone: customers.phone }).from(customers)
        .where(eq(customers.id, contact.customerId)).limit(1)
    : [];
  return { db, contact, phone: contact.phone || customer?.phone || null };
}
export async function getContactEnrichment(contactId: number) {
  const { db, contact, phone } = await resolveContact(contactId);
  const [meta] = await db.select().from(phoneMeta)
    .where(eq(phoneMeta.contactId, contactId)).limit(1);
  const known = verifiedListedPhone(contact.email, phone);
  const consistent = meta && digits(meta.phone) === digits(phone);
  const followed = await db.select({ url: socialFollow.url, platform: socialFollow.platform, followedAt: socialFollow.followedAt })
    .from(socialFollow).where(eq(socialFollow.contactId, contactId));
  return {
    contactId, phone, phoneType: !phone ? "missing" :
      consistent ? meta.type : known ? "business" : "unknown",
    phoneSource: consistent ? meta.sourceUrl : known?.sourceUrl ?? null,
    verifiedAt: consistent ? meta.verifiedAt : null,
    followed,
  };
}
export async function classifyContactPhone(input: {
  contactId: number; phoneType: PhoneType; sourceUrl?: string;
  confirmedByUser: boolean;
}) {
  const { db, phone } = await resolveContact(input.contactId);
  if (!phone || digits(phone).length < 10) throw new Error("Save a valid phone number on the contact first.");
  if (input.phoneType !== "unknown" && !input.confirmedByUser)
    throw new Error("Confirm that the number type was verified before classifying.");
  const source = input.sourceUrl?.trim() || null;
  if (source) {
    const url = new URL(source);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid source URL");
  }
  await db.insert(phoneMeta).values({
    contactId: input.contactId, phone, type: input.phoneType,
    sourceUrl: source, verifiedAt: input.phoneType === "unknown" ? null : new Date(),
  }).onDuplicateKeyUpdate({ set: {
    phone, type: input.phoneType, sourceUrl: source,
    verifiedAt: input.phoneType === "unknown" ? null : new Date(),
  } });
  const result = await getContactEnrichment(input.contactId);
  if (result.phoneType !== input.phoneType) throw new Error("CRM phone classification could not be verified.");
  return result;
}
function canonicalSocialUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password) throw new Error("Invalid social URL");
  u.hash = "";
  return u.href.replace(/\/$/, "");
}
export async function setFollowConfirmed(input: { contactId: number; url: string; followed: boolean }) {
  const { db } = await resolveContact(input.contactId);
  const url = canonicalSocialUrl(input.url);
  const profile = await contactProfile({ contactId: input.contactId });
  const profiles = [...(profile?.social ?? []), ...(profile?.companySocial ?? [])];
  const match = profiles.find(p => canonicalSocialUrl(p.url) === url);
  if (!match) throw new Error("Social profile must be publicly verified before it can be marked followed.");
  if (input.followed) {
    await db.insert(socialFollow).values({
      contactId: input.contactId, url, platform: match.platform, followedAt: new Date(),
    }).onDuplicateKeyUpdate({ set: { platform: match.platform } });
  } else {
    await db.delete(socialFollow).where(and(
      eq(socialFollow.contactId, input.contactId), eq(socialFollow.url, url),
    ));
  }
  const result = await getContactEnrichment(input.contactId);
  if (result.followed.some(x => x.url === url) !== input.followed)
    throw new Error("CRM social follow status could not be verified.");
  return result;
}
export async function listContactEnrichmentQueue(input: {
  filter: "all" | "missing_phone" | "unknown_type"; offset: number; limit: number;
}) {
  const db = await enrichmentDb();
  const rows = db.select({
    id: crmExternalContacts.id, name: crmExternalContacts.name,
    email: crmExternalContacts.email, company: crmExternalContacts.company,
    phone: crmExternalContacts.phone, savedType: phoneMeta.type, savedPhone: phoneMeta.phone,
  }).from(crmExternalContacts).leftJoin(phoneMeta, eq(crmExternalContacts.id, phoneMeta.contactId));
  const filter = input.filter === "missing_phone"
    ? or(isNull(crmExternalContacts.phone), eq(crmExternalContacts.phone, ""))
    : input.filter === "unknown_type"
      ? and(sql`${crmExternalContacts.phone} IS NOT NULL AND ${crmExternalContacts.phone} <> ''`,
          or(isNull(phoneMeta.type), eq(phoneMeta.type, "unknown"), sql`${phoneMeta.phone} <> ${crmExternalContacts.phone}`))
      : undefined;
  const [items, totals] = await Promise.all([
    rows.where(filter).orderBy(asc(crmExternalContacts.id)).limit(input.limit).offset(input.offset),
    db.select({ total: count() }).from(crmExternalContacts)
      .leftJoin(phoneMeta, eq(crmExternalContacts.id, phoneMeta.contactId)).where(filter),
  ]);
  return { items, total: Number(totals[0]?.total ?? 0) };
}
