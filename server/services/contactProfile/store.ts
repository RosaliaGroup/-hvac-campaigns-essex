import { reserveProfileResearch } from "./dailyBudget";
import { ProfileLookupError, ProfileProviderError } from "./anthropicSearch";
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

// Reuse verified results for 30 days and unmatched results for seven days.
export function profileCacheMs(profile: ContactProfile) {
  if (profile.message || profile.status === "unavailable") return 5 * 60 * 1000;
  return (profile.status === "matched" ? 30 : 7) * 24 * 60 * 60 * 1000;
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
  let identity = JSON.stringify({
    version: 3,
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
        profileCacheMs(saved.profile)
      ? saved.profile
      : null;
  if (
    saved?.identity === identity &&
    Date.now() - new Date(saved.profile.checkedAt).getTime() <
      profileCacheMs(saved.profile)
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
      if (!await reserveProfileResearch()) {
        return saved?.profile ?? {company: {}, social: [], checkedAt: new Date().toISOString(),
          status: "unavailable", message: "Daily research allowance reached. Automatic research resumes tomorrow; saved contact details remain available."};
      }
      profile = await researchContact({
        name: c.name,
        email: c.email,
        company: c.company || signature?.name?.value,
      });
    } catch (error) {
      // Never log request bodies, keys, contact identifiers or provider text.
      const status = error instanceof Error ? error.message.match(/\((\d{3})\)/)?.[1] : undefined;
      const reason = error instanceof ProfileProviderError ? error.reason
        : error instanceof ProfileLookupError ? error.category
        : error instanceof Error && error.name === "TimeoutError" ? "request_timeout"
        : "lookup_failed";
      console.warn("[CRM Profile Research]", { contactId: c.id, status: status || "lookup_failed", reason });
      profile = {
        company: {},
        social: [],
        checkedAt: new Date().toISOString(),
        status: "unavailable",
        message:
          `Public lookup could not finish${reason === "billing_required" ? ": AI provider credit balance needs attention" : ""}${status ? ` (provider HTTP ${status})` : ""}. Retry after 5 minutes. Company details from email are shown when available.`,
      };
    }
    if(profile.person) {
      const firstName=profile.person.firstName.value, lastName=profile.person.lastName.value;
      // Keep a conflicting staff-entered person name for review; only replace placeholders.
      const {splitContactPersonName}=await import("../../../shared/contactName");
      if(!splitContactPersonName(c.name,c.company) || c.name.trim().toLowerCase()===`${firstName} ${lastName}`.toLowerCase()) {
        await db.update(crmExternalContacts).set({name:`${firstName} ${lastName}`}).where(eq(crmExternalContacts.id,c.id));
        identity=JSON.stringify({version:3,name:`${firstName} ${lastName}`,email:c.email,company:c.company});
        const {ensureSentEmailContact}=await import("../sentEmailContact");
        if(c.customerId || ["gmail-prospecting","verified-hvac-prospect","crm-manual","gmail-selected"].includes(c.source || ""))
          await ensureSentEmailContact(db,{...c,name:`${firstName} ${lastName}`});
      }
    }
    // Save a verified published business phone onto the contact when it has none.
    // Provenance goes to the phone metadata; type stays "unknown" (never implies SMS consent).
    if (profile.phone && (!c.phone || c.phone.replace(/\D/g, "").length < 10)) {
      try {
        await db.update(crmExternalContacts).set({ phone: profile.phone.value }).where(eq(crmExternalContacts.id, c.id));
        await db.execute(sql`INSERT INTO crmContactPhoneMetadata (contactId, phone, type, sourceUrl)
          VALUES (${c.id}, ${profile.phone.value}, 'unknown', ${profile.phone.source.slice(0, 2000)})
          ON DUPLICATE KEY UPDATE phone = VALUES(phone), type = 'unknown', sourceUrl = VALUES(sourceUrl), verifiedAt = NULL`);
        console.info("[CRM Profile Research]", { contactId: c.id, phone: "saved_from_public_source" });
      } catch (error) {
        console.warn("[CRM Profile Research]", { contactId: c.id, phone: "save_failed", reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
      }
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
      const identity=JSON.stringify({version:3,name:contact.name,email:contact.email,company:contact.company});
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

/** Persist a Lusha-matched LinkedIn person profile only after strict CRM name/employer validation.
 * Never marks the person followed or connected. */
export async function saveVerifiedLushaLinkedIn(contactId: number, linkedinUrl: string) {
  const db = await database();
  const [contact] = await db.select().from(crmExternalContacts)
    .where(eq(crmExternalContacts.id,contactId)).limit(1);
  if (!contact) throw new Error("CRM contact not found");
  const u = new URL(linkedinUrl);
  if (u.protocol !== "https:" || !/^(www\.)?linkedin\.com$/.test(u.hostname) ||
      !u.pathname.startsWith("/in/")) throw new Error("Invalid LinkedIn person profile");
  const [saved] = await db.select().from(profiles).where(eq(profiles.contactId,contactId)).limit(1);
  const base: ContactProfile = saved?.profile ?? {
    company:{},social:[],checkedAt:new Date().toISOString(),status:"not_found",
  };
  const social = [...base.social];
  if (!social.some(p=>p.url===u.href)) social.push({
    platform:"LinkedIn",url:u.href,source:"https://www.lusha.com/",
    evidence:"Lusha business contact matched by exact name and current employer",
  });
  const identity=JSON.stringify({version:3,name:contact.name,email:contact.email,company:contact.company});
  const profile:ContactProfile = {...base,social,status:"matched",checkedAt:new Date().toISOString()};
  await db.insert(profiles).values({contactId,identity,profile})
    .onDuplicateKeyUpdate({set:{identity,profile,updatedAt:new Date()}});
  const [readback]=await db.select({profile:profiles.profile}).from(profiles)
    .where(eq(profiles.contactId,contactId)).limit(1);
  if (!readback?.profile?.social?.some(p=>p.url===u.href))
    throw new Error("CRM LinkedIn write readback failed");
  return {saved:true,url:u.href,followed:false};
}
