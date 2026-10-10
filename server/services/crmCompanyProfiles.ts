import { eq, sql } from "drizzle-orm";
import { int, mysqlTable, varchar, timestamp, json } from "drizzle-orm/mysql-core";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import type { ContactProfile } from "../../shared/contactProfile";

export const crmCompanies = mysqlTable("crmCompanies", {
  id: int("id").autoincrement().primaryKey(),
  domain: varchar("domain",{length:255}).notNull().unique(),
  name: varchar("name",{length:255}),
  website: varchar("website",{length:500}),
  industry: varchar("industry",{length:255}),
  location: varchar("location",{length:500}),
  description: varchar("description",{length:1500}),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const crmContactCompanies = mysqlTable("crmContactCompanies",{
  contactId:int("contactId").primaryKey(),
  companyId:int("companyId").notNull(),
  businessType:varchar("businessType",{length:100}),
  relationship:varchar("relationship",{length:100}).notNull().default("prospect"),
  outreachStatus:varchar("outreachStatus",{length:100}).notNull().default("contacted"),
});
const personal=new Set(["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","aol.com","live.com","proton.me","protonmail.com","msn.com","me.com","ymail.com"]);
export function classifyBusinessType(value:string):string {
  const v=value.toLowerCase();
  if(/property management|property manager/.test(v))return "property-management";
  if(/condo|hoa|association|board/.test(v))return "condo-hoa";
  if(/developer|development|construction/.test(v))return "developer";
  if(/realty|real estate|realtor|broker/.test(v))return "real-estate";
  if(/engineer|facilities|superintendent/.test(v))return "building-operations";
  return "other-business";
}
export function verifiedCompanyDomain(email:string):string|null {
  const domain=email.trim().toLowerCase().split("@")[1];
  return domain && /^[a-z0-9.-]+\\.[a-z]{2,}$/.test(domain) && !personal.has(domain) ? domain : null;
}
let initialized:Promise<unknown>|undefined;
export async function linkCompanyProfile(contactId:number, profile?:ContactProfile|null) {
  const db=await getDb();if(!db)throw Error("CRM database unavailable");
  initialized ??= (async()=>{
    await db.execute(sql`CREATE TABLE IF NOT EXISTS crmCompanies (id int NOT NULL AUTO_INCREMENT PRIMARY KEY,domain varchar(255) NOT NULL UNIQUE,name varchar(255),website varchar(500),industry varchar(255),location varchar(500),description varchar(1500),updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS crmContactCompanies (contactId int NOT NULL PRIMARY KEY,companyId int NOT NULL,businessType varchar(100),relationship varchar(100) NOT NULL DEFAULT 'prospect',outreachStatus varchar(100) NOT NULL DEFAULT 'contacted',INDEX (companyId))`);
  })().catch(e=>{initialized=undefined;throw e;});
  await initialized;
  const [contact]=await db.select().from(crmExternalContacts).where(eq(crmExternalContacts.id,contactId)).limit(1);
  if(!contact?.email)return {linked:false,reason:"missing-email"};
  const domain=verifiedCompanyDomain(contact.email);
  if(!domain)return {linked:false,reason:"personal-or-invalid-domain"};
  const company=profile?.company;
  const name=company?.name?.value||contact.company||null;
  const values={domain,name,website:company?.website?.value||null,industry:company?.industry?.value||null,location:company?.location?.value||null,description:company?.description?.value||null};
  await db.insert(crmCompanies).values(values).onDuplicateKeyUpdate({set:{
    name:sql`COALESCE(${crmCompanies.name},VALUES(name))`,
    website:sql`COALESCE(${crmCompanies.website},VALUES(website))`,
    industry:sql`COALESCE(${crmCompanies.industry},VALUES(industry))`,
    location:sql`COALESCE(${crmCompanies.location},VALUES(location))`,
    description:sql`COALESCE(${crmCompanies.description},VALUES(description))`,
  }});
  const [saved]=await db.select().from(crmCompanies).where(eq(crmCompanies.domain,domain)).limit(1);
  if(!saved)throw Error("Company profile not saved");
  const businessType=classifyBusinessType([contact.title,contact.company,company?.industry?.value,company?.description?.value].filter(Boolean).join(" "));
  await db.insert(crmContactCompanies).values({contactId,companyId:saved.id,businessType}).onDuplicateKeyUpdate({set:{companyId:saved.id}});
  return {linked:true,companyId:saved.id,businessType};
}
