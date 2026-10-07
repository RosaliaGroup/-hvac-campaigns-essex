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
  }
) {
  if (!external.email) return null;
  const email = external.email.trim().toLowerCase();
  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(customers)
      .where(
        external.customerId
          ? eq(customers.id, external.customerId)
          : sql`lower(trim(${customers.email})) = ${email}`
      )
      .limit(1);
    let customerId = existing?.id;
    if (!customerId) {
      const result = await tx.insert(customers).values({
        displayName: external.name || email,
        email,
        phone: external.phone ?? null,
        companyName: external.company ?? null,
        source: "Gmail Sent",
        notes:
          "Contact imported from sent email. Relationship is a lead until CRM activity establishes otherwise.",
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
