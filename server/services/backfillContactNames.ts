import { splitContactPersonName } from "../../shared/contactName";
import { queueContactEnrichment, contactEnrichmentJobs } from "./automaticContactEnrichment";
import { asc, sql } from "drizzle-orm";
import { crmExternalContacts, customers } from "../../drizzle/schema";
import { getDb } from "../db";
import { ensureSentEmailContact } from "./sentEmailContact";

/** Bounded, idempotent repair of existing approved Contacts. No emails or guessed names. */
export function startContactNameBackfill() {
  if(process.env.NODE_ENV!=="production" || process.env.CRM_CONTACT_NAME_BACKFILL_ENABLED==="false") return;
  let cursor=0, running=false;
  const run=async()=>{
    if(running)return;
    running=true;
    try {
      const db=await getDb(); if(!db)return;
      const contacts=await db.select().from(crmExternalContacts)
        .where(sql`${crmExternalContacts.id} > ${cursor} AND ${crmExternalContacts.source} IN ('gmail-prospecting','verified-hvac-prospect','crm-manual','gmail-selected')`)
        .orderBy(asc(crmExternalContacts.id)).limit(50);
      for(const c of contacts){
        await ensureSentEmailContact(db,c);
        if(!splitContactPersonName(c.name,c.company)) {
          await queueContactEnrichment(c.id);
          await db.update(contactEnrichmentJobs).set({status:"pending",nextAttemptAt:new Date(),reason:"Verified person-name research required"})
            .where(sql`${contactEnrichmentJobs.contactId} = ${c.id} AND ${contactEnrichmentJobs.status} IN ('complete','review') AND ${contactEnrichmentJobs.attempts} < 3`);
        }
        cursor=c.id;
      }
      // Existing staff-entered person fields are authoritative; do not replace them
      // with a company merely because this customer originated outside outreach.
      await db.update(customers).set({displayName:sql`TRIM(CONCAT_WS(' ', NULLIF(TRIM(${customers.firstName}),''), NULLIF(TRIM(${customers.lastName}),'')))`})
        .where(sql`${customers.firstName} IS NOT NULL AND TRIM(${customers.firstName}) <> '' AND ${customers.lastName} IS NOT NULL AND TRIM(${customers.lastName}) <> '' AND ${customers.firstName} NOT LIKE '%@%' AND ${customers.lastName} NOT LIKE '%@%' AND TRIM(CONCAT_WS(' ',${customers.firstName},${customers.lastName})) <> COALESCE(${customers.companyName},'') AND ${customers.displayName} <> TRIM(CONCAT_WS(' ',${customers.firstName},${customers.lastName}))`);
      console.info("[CRM Contact Names]",{processed:contacts.length,cursor});
      if(contacts.length<50)clearInterval(timer);
    } catch(error){console.warn("[CRM Contact Names] repair failed",error instanceof Error?error.message:"unknown");}
    finally{running=false;}
  };
  const timer=setInterval(()=>void run(),60_000);timer.unref();
  const first=setTimeout(()=>void run(),30_000);first.unref();
}
