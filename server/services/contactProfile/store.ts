import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { getDb } from "../../db";
import {
  customers,
  crmExternalContacts,
  crmCommunications,
} from "../../../drizzle/schema";
import { upsertExternalContact } from "../crmCommunications";
import { signatureCompany } from "./signature";
import { researchContact } from "./research";
import { VERIFIED_SOCIAL_LINKS } from "./verifiedSocialLinks";
import type { ContactProfile } from "../../../shared/contactProfile";
const profiles = mysqlTable("crmContactProfiles", {
  contactId: int("contactId").primaryKey(),
  identity: varchar("identity", { length: 1000 }).notNull(),
  profile: json("profile").$type<ContactProfile>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
let ready: Promise<unknown> | undefined;
async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  ready ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS crmContactProfiles (contactId int NOT NULL PRIMARY KEY, identity varchar(1000) NOT NULL, profile json NOT NULL, updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`
    )
    .catch(e => {
      ready = undefined;
      throw e;
    });
  await ready;
  return db;
}
export async function profileContact(input: {
  contactId?: number;
  customerId?: number;
}) {
  const db = await database();
  if (input.contactId) {
    const [c] = await db
      .select()
      .from(crmExternalContacts)
      .where(eq(crmExternalContacts.id, input.contactId))
      .limit(1);
    if (!c) throw new Error("Contact not found");
    return c;
  }
  const [c] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, input.customerId!))
    .limit(1);
  if (!c) throw new Error("Contact not found");
  return upsertExternalContact(db, {
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.displayName,
    email: c.email,
    phone: c.phone,
    company: c.companyName,
    customerId: c.id,
  });
}
/** Merge independently verified public links; never imply a follow or connection. */
function withVerifiedSocialLinks(profile: ContactProfile, email: string | null | undefined): ContactProfile {
  const entries = VERIFIED_SOCIAL_LINKS.filter(p => p.email === email?.trim().toLowerCase());
  if (!entries.length) return profile;
  const social = [...(profile.social ?? [])];
  const companySocial = [...(profile.companySocial ?? [])];
  for (const entry of entries) {
    const target = entry.kind === "company" ? companySocial : social;
    if (!target.some(p => p.url === entry.url))
      target.push({platform:entry.platform,url:entry.url,source:entry.source,evidence:entry.evidence});
  }
  return {...profile,social,companySocial,status:"matched"};
}

const running = new Map<number, Promise<ContactProfile>>();
export async function contactProfile(
  input: { contactId?: number; customerId?: number },
  refresh = false
): Promise<ContactProfile | null> {
  const db = await database();
  let c;
  if (refresh) c = await profileContact(input);
  else {
    if (input.contactId)
      [c] = await db
        .select()
        .from(crmExternalContacts)
        .where(eq(crmExternalContacts.id, input.contactId))
        .limit(1);
    else {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.customerId!))
        .limit(1);
      if (!customer) throw new Error("Contact not found");
      [c] = await db
        .select()
        .from(crmExternalContacts)
        .where(
          or(
            eq(crmExternalContacts.customerId, customer.id),
            customer.email
              ? eq(crmExternalContacts.email, customer.email)
              : undefined
          )
        )
        .limit(1);
    }
    if (!c) return null;
  }
  const identity = JSON.stringify({
    version: 2,
    name: c.name,
    email: c.email,
    company: c.company,
  });
  const [saved] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.contactId, c.id))
    .limit(1);
  if (!refresh)
    return saved?.identity === identity &&
      Date.now() - new Date(saved.profile.checkedAt).getTime() <
        24 * 60 * 60 * 1000
      ? saved.profile
      : null;
  if (
    saved?.identity === identity &&
    Date.now() - new Date(saved.profile.checkedAt).getTime() <
      24 * 60 * 60 * 1000
  )
    return saved.profile;
  if (running.has(c.id)) return running.get(c.id)!;
  const work = (async () => {
    const messages = c.email
      ? await db
          .select()
          .from(crmCommunications)
          .where(
            and(
              eq(crmCommunications.fromAddress, c.email),
              eq(crmCommunications.channel, "email"),
              eq(crmCommunications.direction, "inbound"),
              eq(crmCommunications.provider, "gmail")
            )
          )
          .orderBy(desc(crmCommunications.occurredAt))
          .limit(10)
      : [];
    const signature = messages
      .map(message => signatureCompany(c, message))
      .find(company => company.name);
    let profile: ContactProfile;
    try {
      profile = await researchContact({
        name: c.name,
        email: c.email,
        company: c.company || signature?.name?.value,
      });
    } catch {
      profile = {
        company: {},
        social: [],
        checkedAt: new Date().toISOString(),
        status: "unavailable",
        message:
          "Public lookup could not finish. Company details from email are shown when available.",
      };
    }
    profile.company = { ...signature, ...profile.company };
    profile = withVerifiedSocialLinks(profile, c.email);
    if (Object.keys(profile.company).length || profile.social.length)
      profile.status = "matched";
    await db
      .insert(profiles)
      .values({ contactId: c.id, identity, profile })
      .onDuplicateKeyUpdate({
        set: { identity, profile, updatedAt: new Date() },
      });
    return profile;
  })().finally(() => running.delete(c.id));
  running.set(c.id, work);
  return work;
}

/** One-time startup seed: attach only verified public LinkedIn links to existing exact-email CRM contacts. */
export async function backfillVerifiedSocialLinks() {
  const db = await database();
  let updated=0, unchanged=0, missing=0;
  const errors: Array<{email:string;error:string}>=[];
  const emails = Array.from(new Set(VERIFIED_SOCIAL_LINKS.map(x=>x.email)));
  for (const email of emails) {
    try {
      const [contact] = await db.select().from(crmExternalContacts)
        .where(eq(crmExternalContacts.email,email)).limit(1);
      if (!contact) {missing++;continue;}
      const [stored] = await db.select().from(profiles)
        .where(eq(profiles.contactId,contact.id)).limit(1);
      const base: ContactProfile = stored?.profile ?? {
        company:{},social:[],checkedAt:new Date().toISOString(),status:"not_found",
      };
      const merged=withVerifiedSocialLinks(base,contact.email);
      if (JSON.stringify(merged) === JSON.stringify(base)) {unchanged++;continue;}
      const identity=JSON.stringify({version:2,name:contact.name,email:contact.email,company:contact.company});
      await db.insert(profiles).values({contactId:contact.id,identity,profile:merged})
        .onDuplicateKeyUpdate({set:{identity,profile:merged,updatedAt:new Date()}});
      const [readback]=await db.select({profile:profiles.profile}).from(profiles)
        .where(eq(profiles.contactId,contact.id)).limit(1);
      const expected=VERIFIED_SOCIAL_LINKS.filter(p=>p.email===email);
      const actual=[...(readback?.profile?.social??[]),...(readback?.profile?.companySocial??[])];
      if (!expected.every(p=>actual.some(a=>a.url===p.url))) throw new Error("LinkedIn CRM write readback mismatch");
      updated++;
    } catch(e) {errors.push({email,error:e instanceof Error?e.message:"Unknown error"});}
  }
  return {verifiedLinks:VERIFIED_SOCIAL_LINKS.length,updated,unchanged,missing,errors};
}
export function startVerifiedSocialBackfill() {
  if(process.env.NODE_ENV!=="production" || process.env.CRM_VERIFIED_SOCIAL_BACKFILL_ENABLED==="false")return;
  const timer=setTimeout(()=>{
    void backfillVerifiedSocialLinks().then(result=>console.info("[CRM Verified LinkedIn]",JSON.stringify(result)))
      .catch(error=>console.error("[CRM Verified LinkedIn] backfill failed",error instanceof Error?error.message:"Unknown error"));
  },75_000);
  timer.unref();
}
