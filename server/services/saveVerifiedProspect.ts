import { getDb } from "../db";
import { upsertExternalContact } from "./crmCommunications";
import {
  categorizeProspect, isVerifiedProspect, normalizeProspectEmail,
} from "./outreachProspectRules";

export type VerifiedProspectInput = {
  name: string;
  title: string;
  company: string;
  email: string;
  verificationUrl: string;
  phone?: string;
  propertyName?: string;
  category?: string;
};

/**
 * Store a researched prospect in the existing CRM contact bridge.
 * This function NEVER sends email or assumes that an email has been sent.
 * Only callers with authenticated CRM access should invoke it.
 */
export async function saveVerifiedProspect(input: VerifiedProspectInput) {
  if (!isVerifiedProspect(input)) {
    throw new Error("A named decision-maker and public business-email source are required.");
  }
  const email = normalizeProspectEmail(input.email)!;
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  const category = categorizeProspect(input.title, input.company);
  const contact = await upsertExternalContact(db, {
    name: input.name.trim(),
    company: input.company.trim(),
    title: input.title.trim(),
    email,
    phone: input.phone?.trim() || null,
    propertyName: input.propertyName?.trim() || null,
    source: "verified-hvac-prospect",
    notes: `Outreach category: ${category}\nVerification source: ${input.verificationUrl}\nStatus: Research verified; not sent`,
  });
  return { contactId: contact.id, email, category, status: "research-verified" as const };
}
