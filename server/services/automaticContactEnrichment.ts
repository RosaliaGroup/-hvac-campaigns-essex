/**
 * Automatic CRM enrichment is restricted to task prospects and explicitly
 * selected Gmail/manual contacts. Incoming Gmail/SMS/leads remain in their
 * original history, not automatically promoted to completed Contacts.
 *
 * Public-source research only. No paid lookup providers.
 */
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { crmExternalContacts, customers } from "../../drizzle/schema";
import { getDb } from "../db";
import { getContactEnrichment } from "./crmContactEnrichment";

import { contactProfile } from "./contactProfile/store";
import { isOutreachSuppressed } from "./outreachSuppression";

export const contactEnrichmentJobs = mysqlTable("crmContactEnrichmentJobs", {
  contactId: int("contactId").primaryKey(),
  status: mysqlEnum("status", ["pending","processing","complete","review","blocked"]).notNull().default("pending"),
  reason: varchar("reason",{length:500}),
  attempts: int("attempts").notNull().default(0),
  nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

let ready: Promise<unknown> | undefined;
async function database() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS crmContactEnrichmentJobs (
      contactId int NOT NULL PRIMARY KEY,
      status enum('pending','processing','complete','review','blocked') NOT NULL DEFAULT 'pending',
      reason varchar(500) NULL,
      attempts int NOT NULL DEFAULT 0,
      nextAttemptAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX crmContactEnrichmentJobs_due_idx (status,nextAttemptAt)
    )`);

  })().catch(e => {ready=undefined;throw e;});
  await ready;
  return db;
}
/** Only explicitly selected or TASK-sourced prospects enter automatic enrichment. */
export const APPROVED_CONTACT_SOURCES = [
  "gmail-prospecting","verified-hvac-prospect","crm-manual","gmail-selected",
] as const;
export function approvedContactSource(source:string|null|undefined) {
  return APPROVED_CONTACT_SOURCES.includes(source as typeof APPROVED_CONTACT_SOURCES[number]);
}
const validEmail = (email: string | null | undefined) =>
  Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
const validPhone = (phone: string | null | undefined) =>
  Boolean(phone && phone.replace(/\D/g,"").length >= 10 && phone.replace(/\D/g,"").length <= 15);

export function contactCompleteness(input:{email?:string|null;phone?:string|null}) {
  const emailValid=validEmail(input.email),phoneValid=validPhone(input.phone);
  return {complete:emailValid&&phoneValid,emailValid,phoneValid,
    missing: [...(!emailValid?["email"]:[]),...(!phoneValid?["phone"]:[])]};
}
const tomorrow=()=>new Date(Date.now()+24*60*60_000);
export async function queueContactEnrichment(contactId:number, force=false) {
  const db=await database();
  const [contact]=await db.select({source:crmExternalContacts.source})
    .from(crmExternalContacts).where(eq(crmExternalContacts.id,contactId)).limit(1);
  if(!contact || !approvedContactSource(contact.source))
    return {queued:false,contactId,reason:"Not a task prospect or explicitly imported contact"};
  await db.execute(sql`
    INSERT INTO crmContactEnrichmentJobs(contactId,status,nextAttemptAt)
    VALUES (${contactId},'pending',CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      status = IF(${force},'pending',status),
      nextAttemptAt = IF(${force},CURRENT_TIMESTAMP,nextAttemptAt)
  `);
  return {queued:true,contactId};
}
export async function contactEnrichmentStatus(contactId:number) {
  const db=await database();
  const [job]=await db.select().from(contactEnrichmentJobs)
    .where(eq(contactEnrichmentJobs.contactId,contactId)).limit(1);
  const [contact]=await db.select({
    email:crmExternalContacts.email,phone:crmExternalContacts.phone,
    linkedPhone:customers.phone,
  }).from(crmExternalContacts)
    .leftJoin(customers,eq(crmExternalContacts.customerId,customers.id))
    .where(eq(crmExternalContacts.id,contactId)).limit(1);
  if (!contact) throw new Error("Contact not found");
  return {...contactCompleteness({email:contact.email,phone:contact.phone||contact.linkedPhone}),
    status:job?.status??"pending",reason:job?.reason??null,
    attempts:job?.attempts??0};
}
async function finish(id:number,status:"pending"|"complete"|"review"|"blocked",reason:string,delay?:Date) {
  const db=await database();
  await db.update(contactEnrichmentJobs).set({
    status,reason:reason.slice(0,500),nextAttemptAt:delay??new Date(),
  }).where(eq(contactEnrichmentJobs.contactId,id));
}
export async function processContactEnrichment(contactId:number) {
  const db=await database();
  const claimed=await db.update(contactEnrichmentJobs).set({
    status:"processing",attempts:sql`${contactEnrichmentJobs.attempts}+1`,
  }).where(and(
    eq(contactEnrichmentJobs.contactId,contactId),
    eq(contactEnrichmentJobs.status,"pending"),
    lte(contactEnrichmentJobs.nextAttemptAt,new Date()),
  ));
  if(Number((claimed as any)?.[0]?.affectedRows??0)!==1) return {status:"not-due"};
  try {
    const [c]=await db.select().from(crmExternalContacts)
      .where(eq(crmExternalContacts.id,contactId)).limit(1);
    if(!c){await finish(contactId,"blocked","Contact no longer exists");return {status:"blocked"};}
    if(!approvedContactSource(c.source)){
      await finish(contactId,"blocked","Source not approved for automatic enrichment");
      return {status:"blocked"};
    }
    const existing=await getContactEnrichment(contactId);
    // Task-sourced email recipients are contacts immediately, even if phone research is pending.
    if(validEmail(c.email) && (c.source==="gmail-prospecting" || c.source==="verified-hvac-prospect")) {
      const {ensureSentEmailContact}=await import("./sentEmailContact");
      await ensureSentEmailContact(db,c);
    }
    if(!validEmail(c.email)){
      await finish(contactId,"review","Email required; keep incoming lead/message staged");
      return {status:"review",reason:"missing-email"};
    }
    if(existing.phone && !validPhone(existing.phone)){
      await finish(contactId,"review","Saved phone is invalid; needs human correction");
      return {status:"review",reason:"invalid-phone"};
    }
    if(await isOutreachSuppressed(db,c.email!)){
      await finish(contactId,"blocked","Suppressed or opted out; no provider enrichment attempted");
      return {status:"blocked"};
    }
    const needsPhone=!validPhone(existing.phone);
    const needsIdentity=!c.company?.trim()||!c.name?.trim()||c.name.includes("@");
    if(needsIdentity && needsPhone){
      // Try verified public company/social research automatically, even when
      // the Gmail task has only an email address. A company name may be
      // established from a matching official domain, but never guess a person.
      try {
        const profile=await contactProfile({contactId},true);
        const verifiedCompany=profile?.company?.name?.value?.trim();
        if(verifiedCompany && !c.company?.trim()){
          await db.update(crmExternalContacts).set({company:verifiedCompany})
            .where(eq(crmExternalContacts.id,contactId));
        }
      }catch(error){
        console.warn("[CRM Auto Enrich] Public identity lookup unavailable",contactId,
          error instanceof Error?error.message:"unknown");
      }
      // A name equal to the email is still unverified; do not guess identity
      // Never fabricate a direct phone number.
      await finish(contactId,"review","Public research attempted; verify person name and company through public sources");
      return {status:"review",reason:"missing-identity"};
    }
    if(needsIdentity && !needsPhone){
      // This is already a complete contact. Research available public details
      // without guessing an employer or spending identity-mismatched credits.
      try{await contactProfile({contactId},true);}
      catch(error){console.warn("[CRM Auto Enrich] Public profile lookup unavailable",contactId,
        error instanceof Error?error.message:"unknown");}
      await finish(contactId,"complete","Email and phone saved; additional identity fields require review");
      return {status:"complete"};
    }
    // Refresh public evidence once; fill only missing company identity.
    try {
      const profile=await contactProfile({contactId},true);
      const company=profile?.company?.name?.value?.trim();
      if(company && !c.company?.trim())
        await db.update(crmExternalContacts).set({company})
          .where(eq(crmExternalContacts.id,contactId));
    } catch(error) {
      console.warn("[CRM Auto Enrich] Public research unavailable",contactId,
        error instanceof Error?error.message:"unknown");
    }
    const after=await getContactEnrichment(contactId);
    // Preserve task-only intake and keep unrelated Gmail correspondents excluded.
    if(c.source==="gmail-prospecting" || c.source==="verified-hvac-prospect"){
      const {ensureSentEmailContact}=await import("./sentEmailContact");
      const [fresh]=await db.select().from(crmExternalContacts)
        .where(eq(crmExternalContacts.id,contactId)).limit(1);
      if(fresh?.email)
        await ensureSentEmailContact(db,{...fresh,phone:fresh.phone||after.phone});
    }
    await finish(contactId,validPhone(after.phone)?"complete":"review",
      validPhone(after.phone)?"Public research completed":"Phone missing after public research");
    return {status:validPhone(after.phone)?"complete":"review"};
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown provider error";
    const [job]=await db.select({attempts:contactEnrichmentJobs.attempts})
      .from(contactEnrichmentJobs).where(eq(contactEnrichmentJobs.contactId,contactId)).limit(1);
    const transient=/429|rate limit|network|timeout|HTTP 5\d\d/i.test(message);
    await finish(contactId,transient&&(job?.attempts??0)<3?"pending":"review",
      message,transient?tomorrow():undefined);
    console.warn("[CRM Auto Enrich] Contact processing failed",contactId,message);
    return {status:"error",reason:message};
  }
}
let running=false;
export async function runContactEnrichmentBatch(limit=3) {
  if(running)return {processed:0,skipped:"already-running"};
  running=true;
  try{
    const db=await database();
    // An interrupted paid lookup must not be silently retried and charged
    // again. Surface it for human review instead.
    await db.update(contactEnrichmentJobs).set({
      status:"review",reason:"Worker interrupted; review before retrying public research",
    }).where(and(eq(contactEnrichmentJobs.status,"processing"),
      lte(contactEnrichmentJobs.updatedAt,new Date(Date.now()-30*60_000))));
    // Backfill only task-sourced or explicitly imported contacts.
    const missing=await db.select({id:crmExternalContacts.id}).from(crmExternalContacts)
      .leftJoin(contactEnrichmentJobs,eq(contactEnrichmentJobs.contactId,crmExternalContacts.id))
      .where(and(
        isNull(contactEnrichmentJobs.contactId),
        sql`${crmExternalContacts.source} IN ('gmail-prospecting','verified-hvac-prospect','crm-manual','gmail-selected')`,
      ))
      .orderBy(asc(crmExternalContacts.id)).limit(25);
    for(const item of missing)await queueContactEnrichment(item.id);
    const jobs=await db.select({id:contactEnrichmentJobs.contactId}).from(contactEnrichmentJobs)
      .where(and(eq(contactEnrichmentJobs.status,"pending"),
        lte(contactEnrichmentJobs.nextAttemptAt,new Date())))
      .orderBy(asc(contactEnrichmentJobs.nextAttemptAt)).limit(Math.max(1,Math.min(limit,5)));
    const results=[];
    for(const item of jobs)results.push(await processContactEnrichment(item.id));
    return {processed:results.length,results};
  }finally{running=false;}
}
export function startAutomaticContactEnrichment() {
  if(process.env.NODE_ENV!=="production"||process.env.CRM_AUTO_ENRICH_ENABLED==="false")return;
  const run=()=>{void runContactEnrichmentBatch().catch(error=>
    console.error("[CRM Auto Enrich] Scheduler failed",
      error instanceof Error?error.message:"unknown"));};
  const first=setTimeout(run,15_000);first.unref();
  const interval=setInterval(run,60_000);interval.unref();
}
