import { splitContactPersonName, contactDisplayName } from "../../shared/contactName";
import { eq, sql } from "drizzle-orm";
import { customers, crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Promote sent-email correspondents into the main Contacts list, without
 * overwriting staff-entered details or claiming the prospect is a won client. */
export async function ensureSentEmailContact(
  db: Db,
  external: {
    id: number;
    email?: string | null;
    name?: string;
    company?: string | null;
    phone?: string | null;
    customerId?: number | null;
    source?: string | null;
  }
) {
  if (!external.email) return null;
  const email = external.email.trim().toLowerCase();
  const person = splitContactPersonName(external.name, external.company);
  const source = external.source==="crm-manual" ? "CRM Manual"
    : external.source==="gmail-selected" ? "Gmail Selected"
    : "HVAC Prospecting Task";
  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(customers)
      // A shared business phone or stale customerId must never merge two
      // different people. Match the exact normalized email address only.
      .where(sql`lower(trim(${customers.email})) = ${email}`)
      .limit(1);
    let customerId = existing?.id;
    if(existing){
      // Legacy bulk Gmail imports must be explicitly selected before they
      // become approved Contacts. Preserve all other existing customer data.
      const patch:Partial<typeof customers.$inferInsert> = {};
      if(existing.source==="Gmail Sent") patch.source=source;
      if(!existing.phone?.trim() && external.phone?.trim()) patch.phone=external.phone;
      if(!existing.companyName?.trim() && external.company?.trim()) patch.companyName=external.company;
      if(existing.type==="residential" && external.company?.trim()) patch.type="commercial";
      if(person && !splitContactPersonName([existing.firstName,existing.lastName].filter(Boolean).join(" "),existing.companyName)) {
        patch.firstName=person.firstName;
        patch.lastName=person.lastName;
      }
      const preferred=contactDisplayName({...existing,...patch});
      if(preferred!==existing.displayName && (existing.firstName?.trim() || existing.lastName?.trim() || person))
        patch.displayName=preferred;
      if(Object.keys(patch).length)
        await tx.update(customers).set(patch).where(eq(customers.id,existing.id));
    }
    if (!customerId) {
      const result = await tx.insert(customers).values({
        firstName: person?.firstName ?? null,
        lastName: person?.lastName ?? null,
        displayName: person ? contactDisplayName(person) : external.name || email,
        email,
        phone: external.phone ?? null,
        companyName: external.company ?? null,
        type: external.company?.trim() ? "commercial" : "residential",
        source,
        notes:
          "Approved CRM outreach contact; missing phone requires public research. Source: "+source,
      });
      customerId = Number(
        (result as unknown as [{ insertId: number }])[0].insertId
      );
    }
    await tx
      .update(crmExternalContacts)
      .set({ customerId })
      .where(eq(crmExternalContacts.id, external.id));
    return customerId;
  });
}
