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
      if(existing.displayName===email && external.name && external.name!==email)
        patch.displayName=external.name;
      if(Object.keys(patch).length)
        await tx.update(customers).set(patch).where(eq(customers.id,existing.id));
    }
    if (!customerId) {
      const result = await tx.insert(customers).values({
        displayName: external.name || email,
        email,
        phone: external.phone ?? null,
        companyName: external.company ?? null,
        source,
        notes:
          "Approved CRM outreach contact. Missing phone is pending public research when unavailable. Source: "+source,
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
