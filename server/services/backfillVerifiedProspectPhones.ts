/** One-time idempotent enrichment of existing outreach contacts from public business directories.
 * Never creates contacts, overwrites an existing number, or changes SMS consent.
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { VERIFIED_PROSPECT_PHONES } from "./verifiedProspectPhones";

export async function backfillVerifiedProspectPhones() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  let updated = 0, alreadyPresent = 0, missingContact = 0;
  const errors: Array<{email: string; error: string}> = [];
  for (const entry of VERIFIED_PROSPECT_PHONES) {
    try {
      const [contact] = await db.select({
        id: crmExternalContacts.id, phone: crmExternalContacts.phone,
      }).from(crmExternalContacts)
        .where(eq(crmExternalContacts.email, entry.email)).limit(1);
      if (!contact) { missingContact++; continue; }
      if (contact.phone?.trim()) { alreadyPresent++; continue; }
      await db.update(crmExternalContacts).set({ phone: entry.phone })
        .where(and(
          eq(crmExternalContacts.id, contact.id),
          or(isNull(crmExternalContacts.phone), eq(crmExternalContacts.phone, "")),
        ));
      const [readback] = await db.select({ phone: crmExternalContacts.phone })
        .from(crmExternalContacts).where(eq(crmExternalContacts.id, contact.id)).limit(1);
      if (readback?.phone === entry.phone) updated++;
      else if (readback?.phone?.trim()) alreadyPresent++;
      else errors.push({ email: entry.email, error: "CRM phone write was not verified" });
    } catch (error) {
      errors.push({email: entry.email,error: error instanceof Error ? error.message : "Unknown CRM error"});
    }
  }
  return { verifiedSources: VERIFIED_PROSPECT_PHONES.length, updated, alreadyPresent, missingContact, errors };
}

/** Production startup backfill. Only source-verified business phones, no SMS sending. */
export function startVerifiedProspectPhoneBackfill() {
  if (process.env.NODE_ENV !== "production" ||
      process.env.CRM_VERIFIED_PHONE_BACKFILL_ENABLED === "false") return;
  const timer = setTimeout(() => {
    void backfillVerifiedProspectPhones().then(result => {
      console.info("[CRM Verified Phones] Backfill:", JSON.stringify(result));
    }).catch(error => {
      console.error("[CRM Verified Phones] Backfill failed:",
        error instanceof Error ? error.message : "Unknown error");
    });
  }, 60_000);
  timer.unref();
}
