/**
 * Explicit CRM intake. Gmail sync never creates a contact; the user selects a
 * specific synced correspondent and supplies a valid phone + verified name.
 * Manual entry also requires both email and phone. No outbound messages.
 */
import { desc, eq, sql } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { upsertExternalContact } from "./crmCommunications";
import { addresses, CRM_MAILBOX } from "./gmailCrm";
import { contactCompleteness } from "./automaticContactEnrichment";

export type ContactIntake = {
  name:string;email:string;phone:string;company?:string;title?:string;
  propertyName?:string;
};
function checked(input:ContactIntake) {
  const email=input.email.trim().toLowerCase();
  const phone=input.phone.trim();
  const status=contactCompleteness({email,phone});
  if(!status.complete) throw new Error(
    "A valid business email and a phone number (10–15 digits) are required before saving a Contact.");
  if(input.name.trim().length<2 || input.name.includes("@"))
    throw new Error("A verified contact name is required.");
  return {name:input.name.trim(),email,phone,company:input.company?.trim()||null,
    title:input.title?.trim()||null,propertyName:input.propertyName?.trim()||null};
}
async function dbOrThrow() {
  const db=await getDb();
  if(!db) throw new Error("CRM database unavailable");
  return db;
}
export async function listGmailContactCandidates(search="") {
  const db=await dbOrThrow();
  const recent=await db.select({
    from:crmCommunications.fromAddress,to:crmCommunications.toAddress,
    occurredAt:crmCommunications.occurredAt,
  }).from(crmCommunications)
    .where(eq(crmCommunications.provider,"gmail"))
    .orderBy(desc(crmCommunications.occurredAt)).limit(300);
  const seen=new Map<string,Date>();
  for(const message of recent){
    for(const email of [...addresses(message.from??""),...addresses(message.to??"")]){
      if(email===CRM_MAILBOX)continue;
      if(search && !email.includes(search.trim().toLowerCase()))continue;
      if(!seen.has(email))seen.set(email,message.occurredAt);
    }
  }
  const emails=Array.from(seen.keys()).slice(0,80);
  if(!emails.length)return [];
  const existing=await db.select({
    email:crmExternalContacts.email,phone:crmExternalContacts.phone,
    source:crmExternalContacts.source,
  }).from(crmExternalContacts)
    .where(sql`lower(trim(${crmExternalContacts.email})) IN (${sql.join(emails.map(x=>sql`${x}`),sql`,`)})`);
  const indexed=new Map(existing.map(x=>[x.email?.toLowerCase(),x]));
  return emails.map(email=>({
    email,lastMessageAt:seen.get(email)!.toISOString(),
    alreadySaved:Boolean(indexed.get(email)?.phone && indexed.get(email)?.source &&
      ["gmail-prospecting","verified-hvac-prospect","gmail-selected","crm-manual"].includes(indexed.get(email)!.source!)),
  }));
}
async function gmailContainsEmail(email:string) {
  const db=await dbOrThrow();
  const recent=await db.select({
    from:crmCommunications.fromAddress,to:crmCommunications.toAddress,
  }).from(crmCommunications).where(eq(crmCommunications.provider,"gmail"))
    .orderBy(desc(crmCommunications.occurredAt)).limit(300);
  return recent.some(x=>[...addresses(x.from??""),...addresses(x.to??"")].includes(email));
}
export async function createSelectedContact(input:ContactIntake,from:"manual"|"gmail") {
  const checkedInput=checked(input);
  if(from==="gmail" && !(await gmailContainsEmail(checkedInput.email)))
    throw new Error("Select an email address from the synced Gmail correspondents first.");
  const db=await dbOrThrow();
  const source=from==="gmail"?"gmail-selected":"crm-manual";
  const saved=await upsertExternalContact(db,{
    ...checkedInput,source,
    notes:from==="gmail"?"Selected for CRM Contacts by an authorized user from synced Gmail":
      "Added manually by an authorized CRM user",
  });
  const [readback]=await db.select().from(crmExternalContacts)
    .where(eq(crmExternalContacts.id,saved.id)).limit(1);
  if(!readback || !contactCompleteness({email:readback.email,phone:readback.phone}).complete ||
    readback.email!==checkedInput.email)
    throw new Error("Contact save could not be verified. Review the CRM record.");
  // Link only messages whose parsed From/To contains the EXACT selected email.
  if(from==="gmail"){
    const messages=await db.select({
      id:crmCommunications.id,from:crmCommunications.fromAddress,to:crmCommunications.toAddress,
    }).from(crmCommunications).where(eq(crmCommunications.provider,"gmail"))
      .orderBy(desc(crmCommunications.occurredAt)).limit(300);
    for(const message of messages){
      if([...addresses(message.from??""),...addresses(message.to??"")].includes(checkedInput.email)){
        await db.update(crmCommunications).set({externalContactId:readback.id})
          .where(eq(crmCommunications.id,message.id));
      }
    }
  }
  return {contactId:readback.id,email:readback.email,phone:readback.phone,source};
}
