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
